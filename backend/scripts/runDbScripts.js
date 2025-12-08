import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pool from '../config/dbConnection.js';

// Obtenir le chemin du répertoire courant (compatible avec ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chemin vers le répertoire des scripts SQL
const dbScriptsDir = path.join(__dirname, '..', 'db_scripts');

// Exécuter tous les scripts SQL dans le répertoire db_scripts
export async function runDbScripts() {
  try {
    console.log('Exécution des scripts SQL...');
    
    // Vérifier si le répertoire existe
    if (!fs.existsSync(dbScriptsDir)) {
      console.error(`Le répertoire ${dbScriptsDir} n'existe pas.`);
      return;
    }
    
    // Lire tous les fichiers .sql dans le répertoire
    const sqlFiles = fs.readdirSync(dbScriptsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Trier les fichiers pour les exécuter dans l'ordre alphabétique
    
    if (sqlFiles.length === 0) {
      console.log('Aucun script SQL à exécuter.');
      return;
    }
    
    console.log(`${sqlFiles.length} scripts SQL trouvés.`);
    
    // Exécuter chaque script SQL
    for (const sqlFile of sqlFiles) {
      try {
        const filePath = path.join(dbScriptsDir, sqlFile);
        const sqlScript = fs.readFileSync(filePath, 'utf8');
        
        console.log(`Exécution du script: ${sqlFile}`);
        await pool.query(sqlScript);
        console.log(`✅ Script ${sqlFile} exécuté avec succès.`);
      } catch (error) {
        // On continue même si un script échoue 
        // (ex: si la table existe déjà ou si une contrainte est violée)
        console.error(`❌ Erreur lors de l'exécution du script ${sqlFile}:`, error.message);
        console.log('Continuation avec le script suivant...');
      }
    }
    
    console.log('Exécution des scripts SQL terminée.');
  } catch (error) {
    console.error('Erreur lors de l\'exécution des scripts SQL:', error);
    throw error;
  }
}

// Si le script est exécuté directement (et non importé)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDbScripts()
    .then(() => {
      console.log('Scripts exécutés avec succès.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erreur lors de l\'exécution des scripts:', error);
      process.exit(1);
    });
}