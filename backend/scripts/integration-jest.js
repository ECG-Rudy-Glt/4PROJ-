const { spawnSync } = require('node:child_process');

const jestCli = require.resolve('jest/bin/jest');
const passthroughArgs = process.argv.slice(2);
const existingNodeOptions = process.env.NODE_OPTIONS || '';
const nodeOptions = `${existingNodeOptions} --experimental-vm-modules`.trim();

const result = spawnSync(
  process.execPath,
  [jestCli, '-c', 'jest.integration.config.js', ...passthroughArgs],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
    },
    shell: false,
  }
);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
