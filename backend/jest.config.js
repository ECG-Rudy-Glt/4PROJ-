/** @type {import('ts-jest').JestConfigWithTsJest} */
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.JWT_MFA_SECRET ||= 'test-jwt-mfa-secret';
process.env.DEK_WRAP_SECRET ||= 'test-dek-wrap-secret';
process.env.FILE_ENCRYPTION_KEY ||= 'test-file-encryption-key-32chars';
process.env.ONLYOFFICE_JWT_SECRET ||= 'test-onlyoffice-jwt-secret';
process.env.MFA_ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['\\.integration\\.test\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  clearMocks: true,
  coverageProvider: 'v8',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
};
