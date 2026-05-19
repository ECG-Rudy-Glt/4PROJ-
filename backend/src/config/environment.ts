import dotenv from 'dotenv';
import path from 'path';

const repoEnvPath = path.resolve(__dirname, '../../../.env');

// The repo-root .env is the single source of truth for Docker and local backend runs.
// dotenv does not override values already provided by Docker or the shell.
dotenv.config({ path: repoEnvPath });
