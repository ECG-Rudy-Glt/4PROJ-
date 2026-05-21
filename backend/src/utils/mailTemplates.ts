const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const appLink = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const mailLogoUrl = () => {
  const url = (process.env.MAIL_LOGO_URL || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return '';
  }

  // SVG and local frontend URLs are poorly supported by email clients like Gmail.
  return /\.svg(?:[?#].*)?$/i.test(url) ? '' : url;
};

const permissionLabels = (permissions?: {
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
}) => {
  const labels: string[] = [];
  if (permissions?.canRead) labels.push('lecture');
  if (permissions?.canWrite) labels.push('écriture');
  if (permissions?.canDelete) labels.push('suppression');
  if (permissions?.canShare) labels.push('partage');
  return labels.length ? labels.join(', ') : 'lecture';
};

const renderTransactionalEmail = (params: {
  lang: string;
  subject: string;
  preheader: string;
  title: string;
  paragraphs: string[];
  ctaLink?: string;
  ctaText?: string;
  footerNote?: string;
}) => {
  const isEn = params.lang.startsWith('en');
  const logoUrl = mailLogoUrl();
  const currentYear = new Date().getFullYear();
  const safeCtaLink = params.ctaLink ? escapeHtml(params.ctaLink) : undefined;
  const text = [
    params.title,
    '',
    ...params.paragraphs,
    ...(params.ctaLink ? ['', `${params.ctaText || (isEn ? 'Open SupFile' : 'Ouvrir SupFile')} : ${params.ctaLink}`] : []),
    ...(params.footerNote ? ['', params.footerNote] : []),
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html lang="${isEn ? 'en' : 'fr'}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(params.subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preheader)}</div>
      <div style="max-width:620px;margin:0 auto;padding:24px 16px;">
        <div style="text-align:center;margin-bottom:20px;">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="SupFile" style="width:180px;max-width:100%;height:auto;">` : '<h1 style="margin:0;color:#4a8c3f;">SupFile</h1>'}
        </div>
        <div style="background:#ffffff;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,0.08);padding:28px;">
          <h2 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#4a8c3f;text-align:center;">${escapeHtml(params.title)}</h2>
          ${params.paragraphs.map((paragraph) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#4b5563;">${escapeHtml(paragraph)}</p>`).join('')}
          ${safeCtaLink && params.ctaText ? `
            <div style="text-align:center;margin:24px 0;">
              <a href="${safeCtaLink}" style="display:inline-block;background:#4a8c3f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">${escapeHtml(params.ctaText)}</a>
            </div>
          ` : ''}
          ${params.footerNote ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;"><p style="margin:0;font-size:14px;color:#6b7280;">${escapeHtml(params.footerNote)}</p></div>` : ''}
        </div>
        <div style="text-align:center;margin-top:18px;color:#6b7280;font-size:12px;line-height:1.6;">
          <p style="margin:0;">© ${currentYear} SupFile. ${isEn ? 'All rights reserved.' : 'Tous droits réservés.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject: params.subject, html, text };
};

export const generateHtmlTemplate = (title: string, bodyText: string, ctaLink?: string, ctaText?: string, footerText?: string) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f9fafb;
          margin: 0;
          padding: 0;
          color: #374151;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .header {
          background-color: #4a8c3f;
          padding: 24px 32px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          padding: 32px;
          font-size: 16px;
          line-height: 1.6;
        }
        .content p {
          margin-top: 0;
          margin-bottom: 24px;
        }
        .cta-container {
          text-align: center;
          margin: 32px 0;
        }
        .cta-button {
          display: inline-block;
          background-color: #4a8c3f;
          color: #ffffff;
          text-decoration: none;
          padding: 12px 28px;
          border-radius: 8px;
          font-weight: 500;
          font-size: 16px;
          box-shadow: 0 4px 6px rgba(74, 140, 63, 0.2);
        }
        .footer {
          background-color: #f3f4f6;
          padding: 24px 32px;
          text-align: center;
          font-size: 14px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SupFile</h1>
        </div>
        <div class="content">
          ${bodyText}
          ${ctaLink && ctaText ? `
            <div class="cta-container">
              <a href="${ctaLink}" class="cta-button">${ctaText}</a>
            </div>
          ` : ''}
        </div>
        <div class="footer">
          ${footerText ? `<p>${footerText}</p>` : ''}
          <p>&copy; ${new Date().getFullYear()} SupFile. Tous droits réservés.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getShareNotificationEmail = (
  lang: string,
  input: {
    sharedBy: string;
    itemName: string;
    itemType: 'file' | 'folder';
    link?: string;
    permissions?: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
    };
  }
) => {
  const isEn = lang.startsWith('en');
  const itemLabel = input.itemType === 'file'
    ? (isEn ? 'file' : 'fichier')
    : (isEn ? 'folder' : 'dossier');
  const permissions = permissionLabels(input.permissions);
  const link = input.link || `${appLink()}/shared?tab=pending`;

  return renderTransactionalEmail({
    lang,
    subject: isEn
      ? `${input.sharedBy} shared a ${itemLabel} with you`
      : `${input.sharedBy} a partagé un ${itemLabel} avec vous`,
    preheader: isEn
      ? `A SupFile ${itemLabel} is waiting for you.`
      : `Un ${itemLabel} SupFile vous attend.`,
    title: isEn ? 'New share on SupFile' : 'Nouveau partage SupFile',
    paragraphs: isEn
      ? [
        `${input.sharedBy} shared the ${itemLabel} "${input.itemName}" with you.`,
        `Permissions: ${permissions}.`,
        'Sign in to SupFile to review and accept the share if needed.',
      ]
      : [
        `${input.sharedBy} a partagé le ${itemLabel} "${input.itemName}" avec vous.`,
        `Permissions : ${permissions}.`,
        'Connectez-vous à SupFile pour consulter et accepter le partage si nécessaire.',
      ],
    ctaLink: link,
    ctaText: isEn ? 'Open SupFile' : 'Ouvrir SupFile',
    footerNote: isEn
      ? 'This email does not contain any private access token.'
      : 'Cet email ne contient aucun jeton d’accès privé.',
  });
};

export const getDelegationGrantedEmail = (
  lang: string,
  delegateName: string,
  ownerName: string,
  permissions?: {
    canRead?: boolean;
    canWrite?: boolean;
    canDelete?: boolean;
    canShare?: boolean;
  },
  expiresAt?: Date | null
) => {
  const isEn = lang.startsWith('en');
  const expiry = expiresAt
    ? (isEn ? `Expires on ${expiresAt.toISOString()}.` : `Expire le ${expiresAt.toISOString()}.`)
    : (isEn ? 'No expiration date is configured.' : 'Aucune date d’expiration n’est configurée.');

  return renderTransactionalEmail({
    lang,
    subject: isEn ? 'SupFile account delegation granted' : 'Délégation de compte SupFile accordée',
    preheader: isEn ? 'A SupFile account delegation is available.' : 'Une délégation de compte SupFile est disponible.',
    title: isEn ? 'Account delegation granted' : 'Délégation de compte accordée',
    paragraphs: isEn
      ? [
        `Hello ${delegateName},`,
        `${ownerName} granted you delegated access to their SupFile account.`,
        `Permissions: ${permissionLabels(permissions)}. ${expiry}`,
      ]
      : [
        `Bonjour ${delegateName},`,
        `${ownerName} vous a accordé une délégation d’accès à son compte SupFile.`,
        `Permissions : ${permissionLabels(permissions)}. ${expiry}`,
      ],
    ctaLink: appLink() || undefined,
    ctaText: isEn ? 'Open SupFile' : 'Ouvrir SupFile',
    footerNote: isEn
      ? 'Only use delegation for actions authorized by the account owner.'
      : 'Utilisez la délégation uniquement pour les actions autorisées par le propriétaire du compte.',
  });
};

export const getDelegationRevokedEmail = (lang: string, delegateName: string, ownerName: string) => {
  const isEn = lang.startsWith('en');

  return renderTransactionalEmail({
    lang,
    subject: isEn ? 'SupFile account delegation revoked' : 'Délégation de compte SupFile révoquée',
    preheader: isEn ? 'A SupFile account delegation has been revoked.' : 'Une délégation de compte SupFile a été révoquée.',
    title: isEn ? 'Account delegation revoked' : 'Délégation de compte révoquée',
    paragraphs: isEn
      ? [
        `Hello ${delegateName},`,
        `${ownerName} revoked your delegated access to their SupFile account.`,
        'The delegation can no longer be used.',
      ]
      : [
        `Bonjour ${delegateName},`,
        `${ownerName} a révoqué votre délégation d’accès à son compte SupFile.`,
        'La délégation ne peut plus être utilisée.',
      ],
    ctaLink: appLink() || undefined,
    ctaText: isEn ? 'Open SupFile' : 'Ouvrir SupFile',
  });
};

export const getAccountStatusEmail = (
  lang: string,
  userName: string,
  status: 'ACTIVE' | 'SUSPENDED',
  reason?: string
) => {
  const isEn = lang.startsWith('en');
  const isSuspended = status === 'SUSPENDED';

  return renderTransactionalEmail({
    lang,
    subject: isEn
      ? `SupFile account ${isSuspended ? 'suspended' : 'reactivated'}`
      : `Compte SupFile ${isSuspended ? 'suspendu' : 'réactivé'}`,
    preheader: isEn
      ? `Your SupFile account has been ${isSuspended ? 'suspended' : 'reactivated'}.`
      : `Votre compte SupFile a été ${isSuspended ? 'suspendu' : 'réactivé'}.`,
    title: isEn
      ? `Account ${isSuspended ? 'suspended' : 'reactivated'}`
      : `Compte ${isSuspended ? 'suspendu' : 'réactivé'}`,
    paragraphs: isEn
      ? [
        `Hello ${userName},`,
        isSuspended
          ? 'Your SupFile account has been suspended by an administrator.'
          : 'Your SupFile account has been reactivated by an administrator.',
        reason ? `Reason: ${reason}` : 'No reason was provided.',
      ]
      : [
        `Bonjour ${userName},`,
        isSuspended
          ? 'Votre compte SupFile a été suspendu par un administrateur.'
          : 'Votre compte SupFile a été réactivé par un administrateur.',
        reason ? `Raison : ${reason}` : 'Aucune raison n’a été renseignée.',
      ],
    ctaLink: !isSuspended ? appLink() || undefined : undefined,
    ctaText: isEn ? 'Open SupFile' : 'Ouvrir SupFile',
    footerNote: isSuspended
      ? (isEn
        ? 'Existing sessions have been revoked for security.'
        : 'Les sessions existantes ont été révoquées par sécurité.')
      : undefined,
  });
};

export const getPasswordResetEmail = (lang: string, userName: string, resetLink: string) => {
  const isEn = lang.startsWith('en');
  const logoUrl = mailLogoUrl();
  const currentYear = new Date().getFullYear();
  const subject = isEn ? 'Reset your SupFile password' : 'Réinitialisation de votre mot de passe SupFile';
  const preheader = isEn
    ? 'Use this secure link to reset your password. Link valid for 1 hour.'
    : 'Utilisez ce lien sécurisé pour réinitialiser votre mot de passe. Lien valable 1 heure.';
  const greetingHtml = isEn ? `Hello ${escapeHtml(userName)},` : `Bonjour ${escapeHtml(userName)},`;
  const resetLinkHtml = escapeHtml(resetLink);
  const title = isEn ? 'Password reset request' : 'Réinitialisation de votre mot de passe';
  const description = isEn
    ? 'We received a request to reset your SupFile password. Click the button below to create a new one.'
    : 'Nous avons reçu une demande de réinitialisation de votre mot de passe SupFile. Cliquez sur le bouton ci-dessous pour en créer un nouveau.';
  const warning = isEn
    ? 'This link will expire in 1 hour.'
    : 'Ce lien expirera dans 1 heure.';
  const ctaText = isEn ? 'Reset my password' : 'Réinitialiser mon mot de passe';
  const ignoreText = isEn
    ? 'If you did not request this reset, you can safely ignore this email.'
    : 'Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.';
  const footer = isEn
    ? `© ${currentYear} SupFile. All rights reserved.`
    : `© ${currentYear} SupFile. Tous droits réservés.`;
  const text = isEn
    ? `Password reset request for your SupFile account.\n\n${warning}\n\nReset link: ${resetLink}\n\n${ignoreText}`
    : `Demande de réinitialisation de mot de passe pour votre compte SupFile.\n\n${warning}\n\nLien de réinitialisation : ${resetLink}\n\n${ignoreText}`;

  const html = `
    <!DOCTYPE html>
    <html lang="${isEn ? 'en' : 'fr'}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:0;background:#F5F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1F2937;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
      <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

        <!-- Header -->
        <div style="background:#4a8c3f;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
          ${logoUrl
            ? `<img src="${logoUrl}" alt="SupFile" style="height:36px;max-width:160px;">`
            : '<span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">SupFile</span>'
          }
        </div>

        <!-- Card -->
        <div style="background:#ffffff;padding:36px 32px;box-shadow:0 4px 24px rgba(37,68,65,0.10);">


          <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#4a8c3f;text-align:center;">${title}</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#6B7280;text-align:center;">${greetingHtml}</p>

          <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#374151;">${description}</p>

          <!-- CTA -->
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${resetLinkHtml}" style="display:inline-block;background:#4a8c3f;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.2px;">${ctaText}</a>
          </div>

          <!-- Warning -->
          <div style="background:#FFF7ED;border-left:4px solid #F59E0B;border-radius:6px;padding:12px 16px;">
            <p style="margin:0;font-size:13px;color:#92400E;font-weight:500;">⏱ ${warning}</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#e6f2f1;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;color:#4B5563;">${ignoreText}</p>
          <p style="margin:0;font-size:11px;color:#9CA3AF;">${footer}</p>
        </div>

      </div>
    </body>
    </html>
  `;

  return {
    subject,
    html,
    text,
  };
};

export const getWelcomeEmail = (lang: string, userName: string) => {
  const isEn = lang.startsWith('en');

  return renderTransactionalEmail({
    lang,
    subject: isEn ? 'Welcome to SupFile!' : 'Bienvenue sur SupFile !',
    preheader: isEn
      ? 'Your secure SupFile workspace is ready.'
      : 'Votre espace SupFile sécurisé est prêt.',
    title: isEn ? 'Welcome to SupFile' : 'Bienvenue sur SupFile',
    paragraphs: isEn
      ? [
        `Hello ${userName},`,
        'Your SupFile account is ready. You can now store, preview, edit and share your files securely.',
        'Open SupFile to start managing your documents.',
      ]
      : [
        `Bonjour ${userName},`,
        'Votre compte SupFile est prêt. Vous pouvez maintenant stocker, prévisualiser, modifier et partager vos fichiers en toute sécurité.',
        'Ouvrez SupFile pour commencer à gérer vos documents.',
      ],
    ctaLink: appLink() || undefined,
    ctaText: isEn ? 'Open SupFile' : 'Ouvrir SupFile',
    footerNote: isEn
      ? 'Keep this email for information only. SupFile will never ask for your password by email.'
      : 'Conservez cet email à titre informatif. SupFile ne vous demandera jamais votre mot de passe par email.',
  });
};

export const getPasswordChangeNotification = (lang: string, userName: string) => {
  const isEn = lang.startsWith('en');

  return renderTransactionalEmail({
    lang,
    subject: isEn ? 'Security Alert: Password Changed' : 'Alerte de sécurité : Mot de passe modifié',
    preheader: isEn
      ? 'Your SupFile password was changed.'
      : 'Le mot de passe de votre compte SupFile a été modifié.',
    title: isEn ? 'Password changed' : 'Mot de passe modifié',
    paragraphs: isEn
      ? [
        `Hello ${userName},`,
        'The password for your SupFile account was changed recently.',
        'If you made this change, no action is required.',
      ]
      : [
        `Bonjour ${userName},`,
        'Le mot de passe de votre compte SupFile a été modifié récemment.',
        'Si vous êtes à l’origine de cette action, aucune action supplémentaire n’est nécessaire.',
      ],
    ctaLink: appLink() || undefined,
    ctaText: isEn ? 'Open SupFile' : 'Ouvrir SupFile',
    footerNote: isEn
      ? 'If you did not make this change, contact support immediately and review your active sessions.'
      : 'Si vous n’êtes pas à l’origine de cette action, contactez immédiatement le support et vérifiez vos sessions actives.',
  });
};

export const getExpirationAlertEmail = (
  lang: string,
  userName: string,
  itemName: string,
  daysLeft: number,
  link: string
) => {
  const isEn = lang.startsWith('en');

  return renderTransactionalEmail({
    lang,
    subject: isEn
      ? `Your share "${itemName}" expires in ${daysLeft} day(s)`
      : `Votre partage "${itemName}" expire dans ${daysLeft} jour(s)`,
    preheader: isEn
      ? 'A SupFile public link will expire soon.'
      : 'Un lien public SupFile va bientôt expirer.',
    title: isEn ? 'Share expiration reminder' : 'Expiration prochaine du partage',
    paragraphs: isEn
      ? [
        `Hello ${userName},`,
        `Your public share link for "${itemName}" will expire in ${daysLeft} day(s).`,
        'After this date, the link will no longer be accessible.',
      ]
      : [
        `Bonjour ${userName},`,
        `Votre lien de partage public pour "${itemName}" va expirer dans ${daysLeft} jour(s).`,
        'Après cette date, le lien ne sera plus accessible.',
      ],
    ctaLink: link,
    ctaText: isEn ? 'Manage my shares' : 'Gérer mes partages',
    footerNote: isEn
      ? 'This reminder is informational. No private token is included in this email.'
      : 'Ce rappel est informatif. Aucun jeton privé n’est inclus dans cet email.',
  });
};
