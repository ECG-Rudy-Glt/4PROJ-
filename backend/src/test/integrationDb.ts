import './integrationEnv';
import prisma from '../config/database';

const INTEGRATION_SCHEMA = 'supfile_itest';

export async function cleanIntegrationDb(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      table_list text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
      INTO table_list
      FROM pg_tables
      WHERE schemaname = '${INTEGRATION_SCHEMA}';

      IF table_list IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
      END IF;
    END $$;
  `);
}

export async function disconnectIntegrationDb(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
