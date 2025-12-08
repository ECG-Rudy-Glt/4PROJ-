/**
 * @author GAULT Rudy
 * @company Cloud Temple
 * @created_at 2025-12-08 14:23:28
 * @updated_by GAULT Rudy
 * @updated_at 2025-12-08 14:23:30
 */

import pg from "pg";
import { getDbConfig } from "./secrets.js";
import fs from "fs";

const { Pool } = pg;

// Configuration sécurisée avec Docker secrets
const dbConfig = getDbConfig();

// Afficher la configuration complète (sans le mot de passe complet)
const debugConfig = {
  ...dbConfig,
  password: dbConfig.password
    ? `${dbConfig.password.substring(0, 3)}...`
    : undefined,
};
console.log(
  "🔧 Configuration de la base de données:",
  JSON.stringify(debugConfig, null, 2)
);

// Vérifier les variables d'environnement pertinentes
console.log("📋 Variables d'environnement liées à la base de données:");
console.log("- DB_HOST:", process.env.DB_HOST);
console.log("- DB_PORT:", process.env.DB_PORT);
console.log("- DB_NAME:", process.env.DB_NAME);
console.log("- POSTGRES_DB:", process.env.POSTGRES_DB);
console.log("- POSTGRES_USER:", process.env.POSTGRES_USER);
console.log(
  "- POSTGRES_PASSWORD:",
  process.env.POSTGRES_PASSWORD ? "défini" : "non défini"
);

// Vérifier si les secrets sont disponibles
console.log("🔐 Vérification des secrets Docker:");
const secretsPath = "/run/secrets";
if (fs.existsSync(secretsPath)) {
  console.log("- Dossier /run/secrets existe");
  try {
    const secrets = fs.readdirSync(secretsPath);
    console.log(`- Secrets disponibles: ${secrets.join(", ")}`);
  } catch (error) {
    console.error(
      "- Erreur lors de la lecture du dossier secrets:",
      error.message
    );
  }
} else {
  console.log("- Dossier /run/secrets n'existe pas");
}

console.log(
  `🔗 Tentative de connexion à la base de données: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
);

const pool = new Pool(dbConfig);

// Test de connexion au démarrage
pool
  .connect()
  .then((client) => {
    console.log("✅ Connexion à PostgreSQL établie avec succès");
    client.release();
  })
  .catch((err) => {
    console.error("❌ Erreur de connexion à PostgreSQL:", err.message);
    console.error("📌 Code d'erreur PostgreSQL:", err.code);
    console.error("📌 Détails de l'erreur:", err.detail || "Non disponible");
  });

export default pool;
