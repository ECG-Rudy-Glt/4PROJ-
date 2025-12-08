// check-db-connection.js
import pg from "pg";
import fs from "fs";

// Fonction pour lire les secrets
const readSecret = (secretName) => {
  try {
    const secretPath = `/run/secrets/${secretName}`;
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, "utf8").trim();
    }
    console.error(`Secret ${secretName} not found at ${secretPath}`);
    return null;
  } catch (error) {
    console.error(`Error reading secret ${secretName}:`, error);
    return null;
  }
};

// Lire les secrets
const dbUser = readSecret("db_user");
const dbPassword = readSecret("db_password");

console.log("DB User from secret:", dbUser);
console.log(
  "DB Password from secret (first 3 chars):",
  dbPassword ? dbPassword.substring(0, 3) + "..." : "null"
);

// Lire depuis les variables d'environnement
console.log("DB_HOST env:", process.env.DB_HOST);
console.log("POSTGRES_DB env:", process.env.POSTGRES_DB);

// Configuration de la base de données
const config = {
  user: dbUser,
  password: dbPassword,
  host: process.env.DB_HOST || "postgres",
  port: process.env.DB_PORT || 5432,
  database: process.env.POSTGRES_DB || "supchat",
  ssl: false,
};

console.log("Connection config:", {
  user: config.user,
  host: config.host,
  port: config.port,
  database: config.database,
  ssl: config.ssl,
});

// Tester la connexion
const client = new pg.Client(config);
client
  .connect()
  .then(() => {
    console.log("✅ Connection successful!");
    return client.query("SELECT version()");
  })
  .then((res) => {
    console.log("PostgreSQL version:", res.rows[0].version);
    client.end();
  })
  .catch((err) => {
    console.error("❌ Connection error:", err.message);
    process.exit(1);
  });
