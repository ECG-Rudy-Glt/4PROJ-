import '../src/config/environment';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const firstUser = await prisma.user.findFirst({
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      createdAt: true,
    },
  });

  if (!firstUser) {
    console.error('No user found. Create an account first.');
    process.exitCode = 1;
    return;
  }

  if (firstUser.role === Role.ADMIN) {
    console.log(`First account is already admin: ${firstUser.email} (${firstUser.id})`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[DRY-RUN] Would promote first account to admin: ${firstUser.email} (${firstUser.id})`);
    console.log(`Current account status: ${firstUser.accountStatus}`);
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: firstUser.id },
    data: { role: Role.ADMIN },
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      createdAt: true,
    },
  });

  console.log(`First account promoted to admin: ${updatedUser.email} (${updatedUser.id})`);
  console.log(`Account status unchanged: ${updatedUser.accountStatus}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
