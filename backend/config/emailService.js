import nodemailer from "nodemailer";
import { getEmailConfig } from "./secrets.js";

// Configuration sécurisée de l'email
const emailConfig = getEmailConfig();

console.log(
  `📧 Configuration email: ${emailConfig.user}@${emailConfig.host}:${emailConfig.port}`
);

const transporter = nodemailer.createTransport({
  host: emailConfig.host,
  port: emailConfig.port,
  secure: emailConfig.secure,
  auth: {
    user: emailConfig.user,
    pass: emailConfig.password,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const sendInvitation = async (
  toEmail,
  workspaceId,
  workspaceName,
  senderName = "Un membre de SUPCHAT"
) => {
  // URL de base dynamique basée sur l'environnement
  const baseUrl = process.env.FRONTEND_URL || "https://supchat.fr";
  const inviteLink = `${baseUrl}/join-workspace?id=${workspaceId}&email=${encodeURIComponent(
    toEmail
  )}`;
  const currentYear = new Date().getFullYear();

  const mailOptions = {
    from: '"SUPCHAT" <noreply@supchat.fr>',
    to: toEmail,
    subject: `${senderName} vous invite à rejoindre ${workspaceName} sur SUPCHAT`,
    text: `${senderName} vous invite à rejoindre l'espace de travail ${workspaceName} sur SUPCHAT. Cliquez ici pour rejoindre : ${inviteLink}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://s3-supchat.s3.fr-par.scw.cloud/supchat/icon.svg" alt="SUPCHAT Logo" style="width: 150px; border-radius: 12px;">
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #6A0DAD; text-align: center; margin-bottom: 20px;">Invitation à rejoindre un espace de travail</h1>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; text-align: center;">
            ${
              senderName
                ? `<strong>${senderName}</strong>`
                : "Un membre de SUPCHAT"
            } vous invite à rejoindre l'espace de travail :
          </p>
          
          <div style="background-color: #e6e6fa; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <span style="font-size: 24px; font-weight: bold; color: #6A0DAD;">${workspaceName}</span>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" 
               style="background-color: #6A0DAD; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold; 
                      display: inline-block;">
              Rejoindre l'espace de travail
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; 
                    margin-top: 20px; padding: 10px; background-color: #fff4e5; border-radius: 5px;">
            ⚡️ Ce lien d'invitation expirera dans 24 heures
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.</p>
          <p>&copy; ${currentYear} SUPCHAT. Tous droits réservés.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Invitation email sent successfully to:", toEmail);
    return true;
  } catch (error) {
    console.error("Error sending invitation email:", error.stack);
    throw error;
  }
};

export default sendInvitation;
