process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres_itest@127.0.0.1:15433/supfile_test?schema=supfile_itest';
process.env.S3_ENDPOINT = 'http://127.0.0.1:19000';
process.env.S3_REGION = 'us-east-1';
process.env.S3_BUCKET = 'supfile-test-uploads';
process.env.S3_ACCESS_KEY_ID = 'supfile_test_key';
process.env.S3_SECRET_ACCESS_KEY = 'supfile_test_secret';
process.env.FILE_ENCRYPTION_KEY = 'test-file-encryption-key-32chars';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MFA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

if (!process.env.DATABASE_URL.includes('supfile_test') || !process.env.DATABASE_URL.includes('schema=supfile_itest')) {
  throw new Error('Integration tests must use the isolated supfile_test database and supfile_itest schema');
}

if (process.env.S3_BUCKET !== 'supfile-test-uploads') {
  throw new Error('Integration tests must use the isolated supfile-test-uploads bucket');
}
