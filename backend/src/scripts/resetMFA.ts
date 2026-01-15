import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetMFA() {
    console.log('Resetting MFA for all users...');
    try {
        const result = await prisma.user.updateMany({
            data: {
                mfaEnabled: false,
                mfaSecret: null,
                mfaBackupCodes: [],
                mfaSetupAt: null,
            },
        });
        console.log(`MFA reset for ${result.count} users.`);

        // Also clear trusted devices
        const devices = await prisma.trustedDevice.deleteMany({});
        console.log(`Deleted ${devices.count} trusted devices.`);

    } catch (error) {
        console.error('Error resetting MFA:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetMFA();
