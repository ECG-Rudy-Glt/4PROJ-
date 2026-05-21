import dotenv from 'dotenv';
import path from 'path';

const repoEnvPath = path.resolve(__dirname, '../../../.env');

dotenv.config({ path: repoEnvPath });
