// Migration des anciennes clés S3 vers des URLs complètes
import pool from "../config/dbConnection.js";
import { getS3Config } from "../config/secrets.js";

// Configuration S3 sécurisée avec secrets Docker
const s3Config = getS3Config();

/**
 * Formate une clé S3 en URL complète
 * @param {string} photoKey - La clé S3 à transformer
 * @returns {string} L'URL complète
 */
const formatS3Url = (photoKey) => {
  if (!photoKey) return null;

  // Si c'est déjà une URL complète ou une URL locale, ne rien faire
  if (photoKey.startsWith("http") || photoKey.startsWith("/uploads/")) {
    return photoKey;
  }

  // Construire l'URL complète pour les clés S3
  const s3Endpoint = s3Config.endpoint;
  const bucketName = s3Config.bucketName;
  return `${s3Endpoint}${bucketName}/${photoKey}`.replace(
    /([^:])\/\/+/g,
    "$1/"
  );
};

/**
 * Fonction principale pour migrer les URLs des photos
 */
const migratePhotoUrls = async () => {
  const client = await pool.connect();

  try {
    console.log("Début de la migration des URLs des photos...");

    // Récupérer tous les utilisateurs qui ont des photos stockées comme des clés S3
    // (ni URLs HTTP complètes ni chemins locaux)
    const { rows } = await client.query(
      `SELECT id_utilisateur, photo_de_profil
       FROM utilisateur
       WHERE photo_de_profil IS NOT NULL
       AND photo_de_profil NOT LIKE 'http%'
       AND photo_de_profil NOT LIKE '/uploads/%'`
    );

    console.log(`${rows.length} photos à migrer.`);

    // Pour chaque utilisateur, mettre à jour l'URL de la photo
    for (const user of rows) {
      const oldPhotoKey = user.photo_de_profil;
      const newPhotoUrl = formatS3Url(oldPhotoKey);

      if (oldPhotoKey !== newPhotoUrl) {
        await client.query(
          `UPDATE utilisateur
           SET photo_de_profil = $1
           WHERE id_utilisateur = $2`,
          [newPhotoUrl, user.id_utilisateur]
        );
        console.log(
          `Utilisateur ${user.id_utilisateur}: ${oldPhotoKey} -> ${newPhotoUrl}`
        );
      }
    }

    console.log("Migration terminée avec succès!");
  } catch (error) {
    console.error("Erreur lors de la migration:", error);
  } finally {
    client.release();
  }
};

// Exécuter la migration
migratePhotoUrls()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erreur fatale:", err);
    process.exit(1);
  });
