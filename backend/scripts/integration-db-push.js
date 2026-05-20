const { spawnSync } = require('node:child_process');

const DATABASE_URL = 'postgresql://postgres:postgres_itest@[IP_ADDRESS]/supfile_test?schema=supfile_itest';

if (!DATABASE_URL.includes('supfile_test') || !DATABASE_URL.includes('schema=supfile_itest')) {
  throw new Error('Refusing to run integration db push outside the isolated test database');
}

const prismaCli = require.resolve('prisma/build/index.js');
const result = spawnSync(
  process.execPath,
  [prismaCli, 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL,
    },
    shell: false,
  }
);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
