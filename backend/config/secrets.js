import fs from "fs";
import path from "path";

/**
 * Fonction utilitaire pour lire les secrets Docker
 * @param {string} secretName - Nom du secret (nom du fichier sans .txt)
 * @param {string} envVarName - Nom de la variable d'environnement de fallback
 * @returns {string} - Valeur du secret
 */
export const getSecret = (secretName, envVarName = null) => {
  try {
    // En production, les secrets sont montés dans /run/secrets/
    const secretPath = `/run/secrets/${secretName}`;
    const fallbackSecretPath = path.join("/tmp/secrets", secretName);

    // CORRECTION: Essayer le chemin principal avec gestion d'erreur améliorée
    try {
      if (fs.existsSync(secretPath)) {
        const secret = fs.readFileSync(secretPath, "utf8").trim();
        console.log(`✅ Secret '${secretName}' lu depuis /run/secrets/`);
        return secret;
      }
    } catch (e) {
      console.warn(
        `⚠️ Erreur lors de l'accès à /run/secrets/${secretName}: ${e.message}`
      );

      // Tentative de création de répertoire (diagnostic uniquement)
      try {
        fs.mkdirSync("/run/secrets", { recursive: true });
      } catch (mkdirErr) {
        console.warn(
          `⚠️ Impossible de créer /run/secrets: ${mkdirErr.message}`
        );
      }
    }

    // CORRECTION: Essayer le chemin de secours
    try {
      if (fs.existsSync(fallbackSecretPath)) {
        const secret = fs.readFileSync(fallbackSecretPath, "utf8").trim();
        console.log(
          `✅ Secret '${secretName}' lu depuis le chemin alternatif /tmp/secrets`
        );
        return secret;
      }
    } catch (e) {
      console.warn(
        `⚠️ Erreur lors de l'accès à /tmp/secrets/${secretName}: ${e.message}`
      );
    }

    // En développement, chercher dans le dossier secrets local
    // CORRECTION: Chemin plus robuste avec __dirname
    const localSecretPath = path.resolve(
      process.cwd(),
      "..",
      "secrets",
      `${secretName}.txt`
    );

    try {
      if (fs.existsSync(localSecretPath)) {
        const secret = fs.readFileSync(localSecretPath, "utf8").trim();
        console.log(
          `✅ Secret '${secretName}' lu depuis le fichier local: ${localSecretPath}`
        );
        return secret;
      }
    } catch (e) {
      console.warn(
        `⚠️ Erreur lors de l'accès au fichier local ${localSecretPath}: ${e.message}`
      );
    }

    // CORRECTION: Cas spécifiques pour la connexion DB
    // Si le secret n'est pas trouvé et qu'il s'agit du mot de passe DB, essayer de lire à partir de l'environnement
    if (secretName === "db_password" && process.env.POSTGRES_PASSWORD) {
      console.log(
        `⚠️ Utilisation de POSTGRES_PASSWORD comme fallback pour db_password`
      );
      return process.env.POSTGRES_PASSWORD;
    }

    if (secretName === "db_user" && process.env.POSTGRES_USER) {
      console.log(
        `⚠️ Utilisation de POSTGRES_USER comme fallback pour db_user`
      );
      return process.env.POSTGRES_USER;
    }

    // Fallback vers les variables d'environnement
    if (envVarName && process.env[envVarName]) {
      console.log(
        `⚠️ Secret '${secretName}' lu depuis la variable d'environnement ${envVarName}`
      );
      return process.env[envVarName];
    }

    // CORRECTION: Valeurs par défaut pour le développement local
    // Ces valeurs ne sont utilisées qu'en dernier recours
    const devDefaults = {
      db_user: "admin",
      db_password: "SuperSecretPassword2024!",
      jwt_secret: "dev_jwt_secret",
    };

    if (devDefaults[secretName]) {
      console.log(
        `⚠️ ATTENTION: Utilisation de la valeur par défaut pour '${secretName}' (environnement de développement uniquement)`
      );
      return devDefaults[secretName];
    }

    throw new Error(`Secret '${secretName}' introuvable`);
  } catch (error) {
    console.error(
      `❌ Erreur lors de la lecture du secret '${secretName}':`,
      error.message
    );

    // En dernier recours, on pourrait vouloir une valeur de fallback même en cas d'erreur
    if (envVarName && process.env[envVarName]) {
      console.log(`🔄 Utilisation de secours de ${envVarName}`);
      return process.env[envVarName];
    }

    throw error;
  }
};

/**
 * Fonction pour obtenir la configuration de la base de données
 * @returns {Object} - Configuration de la base de données
 */
export const getDbConfig = () => {
  // CORRECTION: Capture des erreurs pour chaque secret
  let user, password;

  try {
    user = getSecret("db_user", "DB_USER");
  } catch (e) {
    console.error(
      "❌ Impossible de lire l'utilisateur DB, utilisation de 'admin' par défaut"
    );
    user = "admin";
  }

  try {
    password = getSecret("db_password", "DB_PASSWORD");
  } catch (e) {
    console.error(
      "❌ Impossible de lire le mot de passe DB, utilisation de la valeur par défaut"
    );
    password = "SuperSecretPassword2024!";
  }

  return {
    user,
    password,
    host: process.env.DB_HOST || "postgres",
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || process.env.POSTGRES_DB || "supchat",
    // Pour Docker Compose/local, toujours désactiver SSL (sinon erreur de handshake)
    ssl: false, // ⚠️ En production cloud, activer SSL si nécessaire
  };
};

/**
 * Fonction pour charger la configuration S3/Scaleway
 * @returns {Object} - Configuration S3 avec secrets
 */
export const getS3Config = () => {
  let endpoint, region, bucketName;
  try {
    endpoint = getSecret("scw_endpoint", "SCW_ENDPOINT");
    if (!endpoint) throw new Error();
  } catch (e) {
    endpoint = "https://s3.fr-par.scw.cloud";
    console.warn(
      "⚠️ Secret 'scw_endpoint' absent, utilisation de l'endpoint par défaut : https://s3.fr-par.scw.cloud"
    );
  }
  try {
    region = getSecret("scw_region", "SCW_REGION");
    if (!region) throw new Error();
  } catch (e) {
    region = "fr-par";
    console.warn(
      "⚠️ Secret 'scw_region' absent, utilisation de la région par défaut : fr-par"
    );
  }
  try {
    bucketName = getSecret("s3_bucket_name", "S3_BUCKET_NAME");
    if (!bucketName) throw new Error();
  } catch (e) {
    bucketName = "s3-supchat";
    console.warn(
      "⚠️ Secret 's3_bucket_name' absent, utilisation du bucket par défaut : s3-supchat"
    );
  }
  let accessKeyId, secretAccessKey;

  try {
    accessKeyId = getSecret("scw_access_key", "SCW_ACCESS_KEY_ID");
    if (!accessKeyId) throw new Error();
  } catch (e) {
    accessKeyId = "";
    console.warn(
      "⚠️ Secret 'scw_access_key' absent, l'upload de fichiers ne fonctionnera pas correctement"
    );
  }

  try {
    secretAccessKey = getSecret("scw_secret_key", "SCW_SECRET_ACCESS_KEY");
    if (!secretAccessKey) throw new Error();
  } catch (e) {
    secretAccessKey = "";
    console.warn(
      "⚠️ Secret 'scw_secret_key' absent, l'upload de fichiers ne fonctionnera pas correctement"
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    endpoint,
    region,
    bucketName,
  };
};

/**
 * Fonction pour charger la configuration OAuth
 * @returns {Object} - Configuration OAuth avec secrets
 */
export const getOAuthConfig = () => {
  return {
    google: {
      clientId: getSecret("google_client_id", "GOOGLE_CLIENT_ID"),
      clientSecret: getSecret("google_client_secret", "GOOGLE_CLIENT_SECRET"),
    },
    github: {
      clientId: getSecret("github_client_id", "GITHUB_CLIENT_ID"),
      clientSecret: getSecret("github_client_secret", "GITHUB_CLIENT_SECRET"),
    },
  };
};

/**
 * Fonction pour charger la configuration de l'envoi d'emails
 * @returns {Object} - Configuration SMTP avec secrets
 */
export const getEmailConfig = () => {
  return {
    user: getSecret("email_user", "EMAIL_USER"),
    password: getSecret("email_password", "EMAIL_PASSWORD"), // Changé de 'pass' à 'password'
    host: process.env.EMAIL_HOST || "mail86.lwspanel.com", // Configuration LWS
    port: parseInt(process.env.EMAIL_PORT || "465", 10), // Port sécurisé LWS
    secure: process.env.EMAIL_SECURE !== "false", // true par défaut pour le port 465
  };
};

/**
 * Fonction pour charger la clé JWT
 * @returns {string} - Clé secrète JWT
 */
export const getJwtSecret = () => {
  return getSecret("jwt_secret", "JWT_SECRET");
};

/**
 * Fonction pour charger la clé API Strawpoll
 * @returns {string} - Clé API Strawpoll
 */
export const getStrawpollApiKey = () => {
  return getSecret("strawpoll_api_key", "STRAWPOLL_API_KEY");
};

/**
 * Fonction pour charger la clé API Mistral
 * @returns {string} - Clé API Mistral
 */
export const getMistralApiKey = () => {
  return getSecret("mistral_api_key", "MISTRAL_API_KEY");
};
