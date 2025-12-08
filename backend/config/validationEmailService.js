import nodemailer from "nodemailer";
import { getEmailConfig } from "./secrets.js";

// Configuration sécurisée de l'email
const emailConfig = getEmailConfig();

console.log(
  `📧 Configuration email validation: ${emailConfig.user}@${emailConfig.host}:${emailConfig.port}`
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

// Verify the SMTP connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("SMTP connection successful");
  }
});

const sendValidationEmail = async (email, validationCode) => {
  const currentYear = new Date().getFullYear();

  const mailOptions = {
    from: '"SUPCHAT" <noreply@supchat.fr>',
    to: email,
    subject: "Code de validation SUPCHAT",
    text: `Votre code de validation SUPCHAT est : ${validationCode}. Ce code est valable pendant 30 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://s3-supchat.s3.fr-par.scw.cloud/supchat/icon.svg" alt="SUPCHAT Logo" style="width: 150px; border-radius: 12px;">
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #6A0DAD; text-align: center; margin-bottom: 20px;">Vérification de votre adresse email</h1>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; text-align: center;">
            Merci de vous être inscrit à SUPCHAT. Voici votre code de validation :
          </p>
          
          <div style="background-color: #e6e6fa; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <span style="font-size: 24px; font-weight: bold; color: #6A0DAD; letter-spacing: 2px;">${validationCode}</span>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; 
                    margin-top: 20px; padding: 10px; background-color: #fff4e5; border-radius: 5px;">
            ⚠️ Ce code est valable pendant 30 minutes
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>Si vous n'avez pas créé de compte SUPCHAT, vous pouvez ignorer cet email.</p>
          <p>&copy; ${currentYear} SUPCHAT. Tous droits réservés.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Erreur d'envoi email:", error);
    throw error;
  }
};

export default sendValidationEmail;
