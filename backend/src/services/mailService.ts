import nodemailer from 'nodemailer';
import logger from '../config/logger';
import { getWelcomeEmail, getPasswordChangeNotification, getPasswordResetEmail } from '../utils/mailTemplates';

interface MailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export class MailService {
    private static transporter: nodemailer.Transporter | null = null;

    private static getTransporter(): nodemailer.Transporter {
        if (this.transporter) {
            return this.transporter;
        }

        const smtpHost = process.env.SMTP_HOST;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
        const secure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

        if (!smtpHost || !smtpUser || !smtpPass) {
            throw new Error('SMTP configuration incomplete');
        }

        this.transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure,
            requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false',
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        return this.transporter;
    }

    static async sendMail(options: MailOptions): Promise<boolean> {
        const smtpMock = process.env.SMTP_MOCK === 'true';
        if (smtpMock) {
            logger.info({ options }, '[MailService] SMTP not configured. Mocking email send:');
            return true;
        }

        try {
            const transporter = this.getTransporter();
            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || '"SupFile" <noreply@supfile.com>',
                ...options,
            });

            logger.info('[MailService] Message sent: %s', info.messageId);
            return true;
        } catch (error) {
            logger.error({ err: error }, '[MailService] Error sending email:');
            return false;
        }
    }

    static async sendShareNotification(
        to: string,
        sharedBy: string,
        itemName: string,
        itemType: 'file' | 'folder',
        link?: string
    ) {
        const subject = `${sharedBy} a partagé un ${itemType === 'file' ? 'fichier' : 'dossier'} avec vous`;
        const text = `Bonjour,\n\n${sharedBy} a partagé le ${itemType} "${itemName}" avec vous.\n\n${link ? `Vous pouvez y accéder ici : ${link}` : 'Connectez-vous à SupFile pour y accéder.'}\n\nCordialement,\nL'équipe SupFile`;

        return this.sendMail({
            to,
            subject,
            text,
        });
    }

    static async sendWelcomeNotification(to: string, name: string, lang: string = 'fr') {
        const template = getWelcomeEmail(lang, name);

        return this.sendMail({
            to,
            subject: template.subject,
            text: `Bonjour ${name},\n\nBienvenue sur SupFile ! Nous sommes ravis de vous compter parmi nous.`,
            html: template.html,
        });
    }

    static async sendPasswordChangeNotification(to: string, name: string, lang: string = 'fr') {
        const template = getPasswordChangeNotification(lang, name);

        return this.sendMail({
            to,
            subject: template.subject,
            text: `Bonjour ${name},\n\nLe mot de passe de votre compte SupFile a été modifié récemment. Si vous n'êtes pas à l'origine de cette action, veuillez contacter le support immédiatement.`,
            html: template.html,
        });
    }

    static async sendPasswordResetMail(to: string, name: string, resetLink: string, lang: string = 'fr') {
        const template = getPasswordResetEmail(lang, name, resetLink);

        return this.sendMail({
            to,
            subject: template.subject,
            text: template.text || `Vous avez demandé à réinitialiser votre mot de passe. Utilisez ce lien: ${resetLink}`,
            html: template.html,
        });
    }

    static async sendExpirationAlert(to: string, name: string, itemName: string, daysLeft: number, link: string) {
        const subject = `Attention : Votre partage "${itemName}" expire dans ${daysLeft} jour(s)`;
        const text = `Bonjour ${name},\n\nVotre lien de partage pour "${itemName}" va expirer dans ${daysLeft} jour(s).\n\nAprès cette date, le lien ne sera plus accessible.\n\nVous pouvez gérer vos partages ici : ${link}\n\nCordialement,\nL'équipe SupFile`;

        return this.sendMail({
            to,
            subject,
            text,
        });
    }
}
