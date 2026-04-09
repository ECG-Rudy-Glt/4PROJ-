/**
 * Script de migration : déplace les fichiers locaux existants vers MinIO.
 *
 * Usage (depuis la racine du projet) :
 *   cd backend && npx tsx ../scripts/migrate-to-s3.ts
 *
 * Options :
 *   --dry-run   Affiche ce qui serait migré sans rien modifier
 *   --batch=50  Nombre de fichiers traités par lot (défaut: 50)
 *
 * Comportement :
 *   - Traite les fichiers dont storagePath commence par "/", "./" ou "uploads/" (chemins locaux)
 *   - Uploade l'objet déjà chiffré vers S3 (pas de re-chiffrement)
 *   - Met à jour storagePath en base avec la clé S3
 *   - Passe les fichiers déjà en S3 (storagePath = "files/…")
 *   - Continue en cas d'erreur sur un fichier (log + compteur)
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
// Run from backend/: cd backend && npx tsx ../scripts/migrate-to-s3.ts
// Path below resolves when tsx runs from backend/ dir (node_modules lookup)
// @ts-ignore — resolved at runtime from backend/node_modules
import { PrismaClient } from '../backend/node_modules/@prisma/client';
import { StorageService } from '../backend/src/services/storageService';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const batchArg = args.find((a) => a.startsWith('--batch='));
const BATCH_SIZE = batchArg ? parseInt(batchArg.split('=')[1], 10) : 50;

function isLocalPath(p: string): boolean {
  return p.startsWith('/') || p.startsWith('./') || p.startsWith('uploads/');
}

async function migrateFiles() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' Migration fichiers locaux → MinIO');
  console.log(`  Mode : ${DRY_RUN ? 'DRY-RUN (aucune modification)' : 'PRODUCTION'}`);
  console.log(`  Lot  : ${BATCH_SIZE} fichiers`);
  console.log('═══════════════════════════════════════════════════════\n');

  // ── Fichiers principaux ──────────────────────────────────────────────────
  const totalFiles = await prisma.file.count({
    where: { isDeleted: false },
  });
  console.log(`Fichiers actifs en base : ${totalFiles}`);

  let offset = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  while (offset < totalFiles) {
    const files = await prisma.file.findMany({
      where: { isDeleted: false },
      select: { id: true, userId: true, storagePath: true, name: true },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: BATCH_SIZE,
    });

    for (const file of files) {
      if (!isLocalPath(file.storagePath)) {
        skipped++;
        continue;
      }

      const localPath = file.storagePath.startsWith('/')
        ? file.storagePath
        : path.resolve(file.storagePath);

      if (!fs.existsSync(localPath)) {
        console.warn(`  [WARN] Fichier introuvable sur disque : ${localPath} (id: ${file.id})`);
        errors++;
        continue;
      }

      const s3Key = `files/${file.userId}/${file.id}-${path.basename(localPath)}`;

      console.log(`  [→] ${file.name} (${file.id})`);
      console.log(`      ${localPath} → ${s3Key}`);

      if (!DRY_RUN) {
        try {
          await StorageService.uploadFromFile(s3Key, localPath);
          await prisma.file.update({
            where: { id: file.id },
            data: { storagePath: s3Key },
          });
          migrated++;
        } catch (err: any) {
          console.error(`  [ERROR] ${file.name} : ${err.message}`);
          errors++;
        }
      } else {
        migrated++;
      }
    }

    offset += BATCH_SIZE;
    console.log(`  Lot traité : ${offset}/${totalFiles}`);
  }

  // ── Versions ─────────────────────────────────────────────────────────────
  console.log('\n--- Versions de fichiers ---');
  const versions = await prisma.fileVersion.findMany({
    select: { id: true, fileId: true, storagePath: true, name: true },
  });

  let vMigrated = 0;
  let vSkipped = 0;
  let vErrors = 0;

  for (const version of versions) {
    if (!isLocalPath(version.storagePath)) {
      vSkipped++;
      continue;
    }

    const localPath = version.storagePath.startsWith('/')
      ? version.storagePath
      : path.resolve(version.storagePath);

    if (!fs.existsSync(localPath)) {
      console.warn(`  [WARN] Version introuvable : ${localPath} (id: ${version.id})`);
      vErrors++;
      continue;
    }

    const s3Key = `versions/${version.fileId}/${version.id}-${path.basename(localPath)}`;
    console.log(`  [→] version ${version.name} → ${s3Key}`);

    if (!DRY_RUN) {
      try {
        await StorageService.uploadFromFile(s3Key, localPath);
        await prisma.fileVersion.update({
          where: { id: version.id },
          data: { storagePath: s3Key },
        });
        vMigrated++;
      } catch (err: any) {
        console.error(`  [ERROR] version ${version.id} : ${err.message}`);
        vErrors++;
      }
    } else {
      vMigrated++;
    }
  }

  // ── Résumé ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' Résumé');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Fichiers migrés   : ${migrated}`);
  console.log(`  Fichiers ignorés  : ${skipped} (déjà sur S3)`);
  console.log(`  Fichiers en erreur: ${errors}`);
  console.log(`  Versions migrées  : ${vMigrated}`);
  console.log(`  Versions ignorées : ${vSkipped}`);
  console.log(`  Versions en erreur: ${vErrors}`);

  if (DRY_RUN) {
    console.log('\n  ⚠  DRY-RUN : aucune modification effectuée.');
    console.log('     Relancez sans --dry-run pour appliquer la migration.');
  } else if (errors === 0 && vErrors === 0) {
    console.log('\n  ✓  Migration terminée sans erreur.');
    console.log('     Vous pouvez supprimer le volume uploads_data une fois validé.');
  } else {
    console.log('\n  ⚠  Migration terminée avec des erreurs (voir ci-dessus).');
  }
}

migrateFiles()
  .catch((err) => {
    console.error('Erreur fatale :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
