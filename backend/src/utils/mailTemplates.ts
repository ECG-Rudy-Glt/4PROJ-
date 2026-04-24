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
  const subject = isEn ? 'Password Reset Request' : 'Réinitialisation de votre mot de passe';
  const title = isEn ? 'Reset Password' : 'Mot de passe oublié';
  const bodyText = `
    <p>${isEn ? `Hello ${userName},` : `Bonjour ${userName},`}</p>
    <p>${isEn ? 'You requested a password reset. Click the button below to create a new password. This link will expire in 1 hour.' : 'Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe. Ce lien expire dans 1 heure.'}</p>
  `;
  const ctaText = isEn ? 'Reset my password' : 'Réinitialiser mon mot de passe';
  const footerText = isEn ? 'If you did not make this request, you can safely ignore this email.' : 'Si vous n\'avez pas fait cette demande, vous pouvez ignorer cet email en toute sécurité.';

  return {
    subject,
    html: generateHtmlTemplate(title, bodyText, resetLink, ctaText, footerText)
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
