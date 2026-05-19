import logger from '../../config/logger';
import { MailService } from '../mailService';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('MailService SMTP mock logging', () => {
  const originalSmtpMock = process.env.SMTP_MOCK;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_MOCK = 'true';
  });

  afterEach(() => {
    if (originalSmtpMock === undefined) {
      delete process.env.SMTP_MOCK;
    } else {
      process.env.SMTP_MOCK = originalSmtpMock;
    }
  });

  it('logs only metadata and not sensitive reset links when SMTP is mocked', async () => {
    await MailService.sendMail({
      to: 'user@example.com',
      subject: 'Reset',
      text: 'Reset link: https://supfile.example/reset-password?token=secret-token',
      html: '<a href="https://supfile.example/reset-password?token=secret-token">Reset</a>',
    });

    expect(logger.info).toHaveBeenCalledWith(
      { to: 'user@example.com', subject: 'Reset', hasHtml: true },
      '[MailService] SMTP not configured. Mocking email send:'
    );
    expect(JSON.stringify((logger.info as jest.Mock).mock.calls[0][0])).not.toContain('secret-token');
  });
});
