import prisma from '../config/database';
import { MailService } from './mailService';
import { ShareService } from './shareService';

export class ShareInvitationService {
  static async inviteByEmailToFolder(params: {
    folderId: string;
    ownerId: string;
    ownerName: string;
    targetEmail: string;
  }): Promise<void> {
    const folder = await prisma.folder.findFirst({
      where: { id: params.folderId, userId: params.ownerId },
    });

    if (!folder) {
      throw Object.assign(new Error('Dossier non trouvé'), { status: 404 });
    }

    const signupLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?email=${encodeURIComponent(params.targetEmail)}`;

    await MailService.sendMail({
      to: params.targetEmail,
      subject: `${params.ownerName} souhaite partager un dossier avec vous`,
      text: `Bonjour,\n\n${params.ownerName} souhaite partager le dossier "${folder.name}" avec vous.\n\nVous n'avez pas encore de compte sur SupFile. Veuillez créer un compte gratuitement via ce lien pour pouvoir y accéder : ${signupLink}\n\nUne fois votre compte créé, demandez à l'utilisateur de vous repartager le dossier.\n\nL'équipe SupFile`,
    });
  }

  static async inviteByEmailToFile(params: {
    fileId: string;
    ownerId: string;
    ownerName: string;
    targetEmail: string;
    ownerWrappedDek?: string;
  }): Promise<{ token: string }> {
    const file = await prisma.file.findFirst({
      where: { id: params.fileId, userId: params.ownerId, isDeleted: false },
    });

    if (!file) {
      throw Object.assign(new Error('Fichier non trouvé'), { status: 404 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const shareLink = await ShareService.createShareLink(params.ownerId, params.fileId, {
      expiresAt,
      ownerWrappedDek: params.ownerWrappedDek,
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${shareLink.token}`;

    await MailService.sendMail({
      to: params.targetEmail,
      subject: `${params.ownerName} a partagé un fichier avec vous`,
      text: `Bonjour,\n\n${params.ownerName} souhaite partager le fichier "${file.name}" avec vous.\n\nVous n'avez pas encore de compte sur SupFile. Vous pouvez accéder au fichier via ce lien sécurisé (valable 7 jours) : ${inviteLink}\n\nSi vous souhaitez collaborer davantage, n'hésitez pas à créer un compte gratuitement !\n\nL'équipe SupFile`,
    });

    return { token: shareLink.token };
  }
}
