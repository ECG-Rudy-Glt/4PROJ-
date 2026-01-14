import nodemailer from 'nodemailer';

interface MailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export class MailService {
    private static transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    static async sendMail(options: MailOptions): Promise<boolean> {
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
            console.log('[MailService] SMTP not configured. Mocking email send:', options);
            return true;
        }

        try {
            const info = await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"SupFile" <noreply@supfile.com>',
                ...options,
            });

            console.log('[MailService] Message sent: %s', info.messageId);
            return true;
        } catch (error) {
            console.error('[MailService] Error sending email:', error);
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

    static async sendWelcomeNotification(to: string, name: string) {
        const subject = 'Bienvenue sur SupFile !';
        const text = `Bonjour ${name},\n\nBienvenue sur SupFile ! Nous sommes ravis de vous compter parmi nous.\n\nVous pouvez maintenant stocker, partager et gérer vos fichiers en toute sécurité.\n\nCordialement,\nL'équipe SupFile`;

        return this.sendMail({
            to,
            subject,
            text,
        });
    }

    static async sendPasswordChangeNotification(to: string, name: string) {
        const subject = 'Alerte de sécurité : Mot de passe modifié';
        const text = `Bonjour ${name},\n\nLe mot de passe de votre compte SupFile a été modifié récemment. Si vous n'êtes pas à l'origine de cette action, veuillez contacter le support immédiatement.\n\nCordialement,\nL'équipe SupFile`;

        return this.sendMail({
            to,
            subject,
            text,
        });
    }
}
