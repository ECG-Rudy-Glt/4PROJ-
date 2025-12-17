import prisma from '../config/database';

/**
 * Script pour mettre à jour les catégories des fichiers existants
 */
async function migrateCategories() {
  console.log('🔄 Migration des catégories de fichiers...');

  try {
    // Récupérer tous les fichiers sans catégorie ou avec catégorie null
    const files = await prisma.file.findMany({
      where: {
        OR: [
          { category: null },
          { category: '' },
        ],
      },
    });

    console.log(`📁 ${files.length} fichiers à mettre à jour`);

    let updated = 0;
    for (const file of files) {
      let category = 'other';

      if (file.mimeType.startsWith('image/')) {
        category = 'image';
      } else if (file.mimeType.startsWith('video/')) {
        category = 'video';
      } else if (file.mimeType.startsWith('audio/')) {
        category = 'audio';
      } else if (
        file.mimeType.includes('pdf') ||
        file.mimeType.includes('document') ||
        file.mimeType.includes('word') ||
        file.mimeType.includes('excel') ||
        file.mimeType.includes('spreadsheet') ||
        file.mimeType.includes('presentation') ||
        file.mimeType.includes('powerpoint') ||
        file.mimeType.includes('text/')
      ) {
        category = 'doc';
      }

      await prisma.file.update({
        where: { id: file.id },
        data: { category },
      });

      updated++;
      console.log(`✅ ${file.name} → ${category}`);
    }

    console.log(`\n✨ Migration terminée : ${updated} fichiers mis à jour`);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la migration
migrateCategories();
