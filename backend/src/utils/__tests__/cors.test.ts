import { buildAllowedOrigins, isOriginAllowed } from '../cors';

const ORIGINAL_ENV = process.env;

describe('cors utils', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_PORT;
    delete process.env.HOST_IP;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('allows the configured host IP frontend origin', () => {
    process.env.HOST_IP = '192.168.217.1';
    process.env.FRONTEND_PORT = '3000';

    const allowedOrigins = buildAllowedOrigins();

    expect(allowedOrigins).toContain('http://192.168.217.1:3000');
    expect(isOriginAllowed(allowedOrigins, 'http://192.168.217.1:3000')).toBe(true);
  });

  it('keeps explicit CORS origins and normalizes trailing slashes', () => {
    process.env.FRONTEND_URL = 'http://localhost:3000/';
    process.env.CORS_ALLOWED_ORIGINS = 'http://example.test:3000/';

    const allowedOrigins = buildAllowedOrigins();

    expect(allowedOrigins).toContain('http://localhost:3000');
    expect(allowedOrigins).toContain('http://example.test:3000');
  });

  it('allows requests without an origin header', () => {
    expect(isOriginAllowed(buildAllowedOrigins(), null)).toBe(true);
  });
});
