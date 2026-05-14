import nodemailer from 'nodemailer';
import logger from '../config/logger';
import {
    getAccountStatusEmail,
    getDelegationGrantedEmail,
    getDelegationRevokedEmail,
    getExpirationAlertEmail,
    getPasswordChangeNotification,
    getPasswordResetEmail,
    getShareNotificationEmail,
    getWelcomeEmail,
} from '../utils/mailTemplates';

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
        link?: string,
        lang: string = 'fr',
        permissions?: {
            canRead?: boolean;
            canWrite?: boolean;
            canDelete?: boolean;
            canShare?: boolean;
        }
    ) {
        const template = getShareNotificationEmail(lang, {
            sharedBy,
            itemName,
            itemType,
            link,
            permissions,
        });

        return this.sendMail({
            to,
            subject: template.subject,
            text: template.text,
            html: template.html,
        });
    }

    static async sendDelegationGrantedNotification(
        to: string,
        delegateName: string,
        ownerName: string,
        permissions?: {
            canRead?: boolean;
            canWrite?: boolean;
            canDelete?: boolean;
            canShare?: boolean;
        },
        expiresAt?: Date | null,
        lang: string = 'fr'
    ) {
        const template = getDelegationGrantedEmail(lang, delegateName, ownerName, permissions, expiresAt);

        return this.sendMail({
            to,
            subject: template.subject,
            text: template.text,
            html: template.html,
        });
    }

    static async sendDelegationRevokedNotification(
        to: string,
        delegateName: string,
        ownerName: string,
        lang: string = 'fr'
    ) {
        const template = getDelegationRevokedEmail(lang, delegateName, ownerName);

        return this.sendMail({
            to,
            subject: template.subject,
            text: template.text,
            html: template.html,
        });
    }

    static async sendAccountStatusNotification(
        to: string,
        userName: string,
        status: 'ACTIVE' | 'SUSPENDED',
        reason?: string,
        lang: string = 'fr'
    ) {
        const template = getAccountStatusEmail(lang, userName, status, reason);

        return this.sendMail({
            to,
            subject: template.subject,
            text: template.text,
            html: template.html,
        });
    }

    static async sendWelcomeNotification(to: string, name: string, lang: string = 'fr') {
        const template = getWelcomeEmail(lang, name);

        return this.sendMail({
            to,
            subject: template.subject,
            text: template.text,
            html: template.html,
        });
    }

    static async sendPasswordChangeNotification(to: string, name: string, lang: string = 'fr') {
        const template = getPasswordChangeNotification(lang, name);

        return this.sendMail({
            to,
            subject: template.subject,
            text: template.text,
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

    static async sendExpirationAlert(
        to: string,
        name: string,
        itemName: string,
        daysLeft: number,
        link: string,
        lang: string = 'fr'
    ) {
        const template = getExpirationAlertEmail(lang, name, itemName, daysLeft, link);

        return this.sendMail({
            to,
            subject: template.subject,
            text: template.text,
            html: template.html,
        });
    }
}
