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
          background-color: #6366f1;
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
          background-color: #6366f1;
          color: #ffffff;
          text-decoration: none;
          padding: 12px 28px;
          border-radius: 8px;
          font-weight: 500;
          font-size: 16px;
          box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2);
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

export const getPasswordResetEmail = (lang: string, userName: string, resetLink: string) => {
  const isEn = lang.startsWith('en');
  const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const logoUrl = process.env.MAIL_LOGO_URL || (frontendBase ? `${frontendBase}/icon-full-light.svg` : '');
  const currentYear = new Date().getFullYear();
  const subject = isEn ? 'Reset your SupFile password' : 'Réinitialisation de votre mot de passe SupFile';
  const preheader = isEn
    ? 'Use this secure link to reset your password. Link valid for 1 hour.'
    : 'Utilisez ce lien sécurisé pour réinitialiser votre mot de passe. Lien valable 1 heure.';
  const greeting = isEn ? `Hello ${userName},` : `Bonjour ${userName},`;
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
    <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
      <div style="max-width:620px;margin:0 auto;padding:24px 16px;">
        <div style="text-align:center;margin-bottom:20px;">
          ${logoUrl ? `<img src="${logoUrl}" alt="SupFile Logo" style="width:180px;max-width:100%;height:auto;">` : '<h1 style="margin:0;color:#4f46e5;">SupFile</h1>'}
        </div>
        <div style="background:#ffffff;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,0.08);padding:28px;">
          <h2 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#4f46e5;text-align:center;">${title}</h2>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#4b5563;">${greeting}</p>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#4b5563;">${description}</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${resetLink}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">${ctaText}</a>
          </div>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;text-align:center;">
            <p style="margin:0;font-size:14px;color:#9a3412;">⚠️ ${warning}</p>
          </div>
        </div>
        <div style="text-align:center;margin-top:18px;color:#6b7280;font-size:12px;line-height:1.6;">
          <p style="margin:0 0 8px;">${ignoreText}</p>
          <p style="margin:0;">${footer}</p>
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
  const subject = isEn ? 'Welcome to SupFile!' : 'Bienvenue sur SupFile !';
  const title = isEn ? 'Welcome!' : 'Bienvenue !';
  const bodyText = `
    <p>${isEn ? `Hello ${userName},` : `Bonjour ${userName},`}</p>
    <p>${isEn ? 'Welcome to SupFile! We are thrilled to have you on board.' : 'Bienvenue sur SupFile ! Nous sommes ravis de vous compter parmi nous.'}</p>
    <p>${isEn ? 'You can now securely store, share, and manage your files.' : 'Vous pouvez maintenant stocker, partager et gérer vos fichiers en toute sécurité.'}</p>
  `;

  return {
    subject,
    html: generateHtmlTemplate(title, bodyText)
  };
};

export const getPasswordChangeNotification = (lang: string, userName: string) => {
  const isEn = lang.startsWith('en');
  const subject = isEn ? 'Security Alert: Password Changed' : 'Alerte de sécurité : Mot de passe modifié';
  const title = isEn ? 'Password Changed' : 'Mot de passe modifié';
  const bodyText = `
    <p>${isEn ? `Hello ${userName},` : `Bonjour ${userName},`}</p>
    <p>${isEn ? 'Your SupFile account password was recently changed.' : 'Le mot de passe de votre compte SupFile a été modifié récemment.'}</p>
    <p><strong>${isEn ? 'If you did not make this change, please contact support immediately.' : 'Si vous n\'êtes pas à l\'origine de cette action, veuillez contacter le support immédiatement.'}</strong></p>
  `;

  return {
    subject,
    html: generateHtmlTemplate(title, bodyText)
  };
};
