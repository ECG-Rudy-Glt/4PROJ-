/**
 * Reindex all files in the database for RAG (Bobby)
 */
import prisma from '../src/config/database';
import { FileIndexService } from '../src/services/fileIndexService';

async function main() {
  const files = await prisma.file.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, userId: true }
  });

  console.log(`Found ${files.length} files to reindex`);

  for (const file of files) {
    console.log(`Reindexing: ${file.name}`);
    try {
      await FileIndexService.indexFile(file.id, file.userId);
      console.log('  ✓ OK');
    } catch (e: any) {
      console.log(`  ✗ Error: ${e.message}`);
    }
  }

  await prisma.$disconnect();
  console.log('Done!');
}

main().catch(console.error);
