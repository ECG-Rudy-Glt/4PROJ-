import { cleanIntegrationDb, disconnectIntegrationDb, prisma } from '../test/integrationDb';
import {
  cleanupIntegrationStorage,
  deleteIntegrationObject,
  putIntegrationObject,
  readIntegrationObject,
} from '../test/integrationStorage';

describe('integration smoke: Prisma and MinIO', () => {
  beforeEach(async () => {
    await cleanIntegrationDb();
  });

  afterEach(async () => {
    await cleanupIntegrationStorage();
    await cleanIntegrationDb();
  });

  afterAll(async () => {
    await cleanupIntegrationStorage();
    await disconnectIntegrationDb();
  });

  it('writes, reads and deletes a minimal user with Prisma', async () => {
    const email = `itest-${Date.now()}@supfile.test`;

    const created = await prisma.user.create({
      data: {
        email,
        password: 'hashed-password',
        mfaBackupCodes: [],
      },
    });

    const found = await prisma.user.findUnique({ where: { id: created.id } });
    expect(found?.email).toBe(email);

    await prisma.user.delete({ where: { id: created.id } });
    await expect(prisma.user.findUnique({ where: { id: created.id } })).resolves.toBeNull();
  });

  it('writes, reads and deletes an object in MinIO', async () => {
    const key = `itest/${Date.now()}-${process.pid}/smoke.txt`;
    const content = 'supfile integration smoke';

    await putIntegrationObject(key, content);

    const readBack = await readIntegrationObject(key);
    expect(readBack.toString()).toBe(content);

    await deleteIntegrationObject(key);
    await expect(readIntegrationObject(key)).rejects.toBeTruthy();
  });
});
