import { authService } from '../authService';

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    defaults: { baseURL: 'http://localhost:5001/api', headers: { common: {} } },
  },
}));

import api from '../api';

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  firstName: 'Jean',
  lastName: 'Dupont',
  quotaUsed: 0,
  quotaLimit: 32212254720,
  theme: 'light',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('authService.login', () => {
  it('returns user and token on successful login', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { user: baseUser, token: 'jwt-token' },
    });

    const result = await authService.login({ email: 'user@example.com', password: 'P@ssword1!' });

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@example.com',
      password: 'P@ssword1!',
    });
    expect(result).toMatchObject({ user: { id: 'user-1' }, token: 'jwt-token' });
  });

  it('returns mfaRequired response when MFA is needed', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { mfaRequired: true, tempToken: 'temp-token' },
    });

    const result = await authService.login({ email: 'user@example.com', password: 'P@ssword1!' });

    expect(result).toMatchObject({ mfaRequired: true, tempToken: 'temp-token' });
  });

  it('unwraps success envelope from the backend', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { success: true, data: { user: baseUser, token: 'jwt-token' } },
    });

    const result = await authService.login({ email: 'user@example.com', password: 'P@ssword1!' });

    expect(result).toMatchObject({ user: { id: 'user-1' }, token: 'jwt-token' });
  });

  it('propagates network errors', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('Network Error'));

    await expect(authService.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow('Network Error');
  });
});

describe('authService.register', () => {
  it('sends registration payload and returns mfaSetupRequired on first registration', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { mfaSetupRequired: true, tempToken: 'temp-token', userId: 'user-1' },
    });

    const payload = {
      email: 'new@example.com',
      password: 'P@ssword1!',
      firstName: 'Jean',
      lastName: 'Dupont',
    };
    const result = await authService.register(payload);

    expect(api.post).toHaveBeenCalledWith('/auth/register', payload);
    expect(result).toMatchObject({ mfaSetupRequired: true });
  });

  it('returns token directly when MFA is not required', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { user: baseUser, token: 'jwt-token' },
    });

    const result = await authService.register({
      email: 'new@example.com',
      password: 'P@ssword1!',
      firstName: 'Jean',
      lastName: 'Dupont',
    });

    expect(result).toMatchObject({ token: 'jwt-token' });
  });
});

describe('authService.verifyMfa', () => {
  it('sends the MFA code with a bearer token and returns auth data', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { user: baseUser, token: 'jwt-final-token' },
    });

    const result = await authService.verifyMfa({ code: '123456', tempToken: 'temp-token' });

    expect(api.post).toHaveBeenCalledWith(
      '/mfa/verify',
      { token: '123456', rememberDevice: false },
      { headers: { Authorization: 'Bearer temp-token' } },
    );
    expect(result).toMatchObject({ token: 'jwt-final-token' });
  });

  it('sends rememberDevice flag when trustDevice is true', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { user: baseUser, token: 'token' } });

    await authService.verifyMfa({ code: '000000', tempToken: 'temp', trustDevice: true });

    expect(api.post).toHaveBeenCalledWith(
      '/mfa/verify',
      { token: '000000', rememberDevice: true },
      expect.any(Object),
    );
  });
});

describe('authService.getProfile', () => {
  it('fetches the authenticated user profile', async () => {
    const session = { authType: 'DIRECT', rootUserId: 'user-1', actorUserId: 'user-1' };
    (api.get as jest.Mock).mockResolvedValue({
      data: { user: baseUser, session },
    });

    const result = await authService.getProfile();

    expect(api.get).toHaveBeenCalledWith('/auth/profile');
    expect(result).toMatchObject({ user: { id: 'user-1' }, session: { authType: 'DIRECT' } });
  });
});

describe('authService.updateProfile', () => {
  it('sends partial profile update and returns updated user', async () => {
    const updated = { ...baseUser, firstName: 'Pierre' };
    (api.put as jest.Mock).mockResolvedValue({ data: { user: updated } });

    const result = await authService.updateProfile({ firstName: 'Pierre' });

    expect(api.put).toHaveBeenCalledWith('/auth/profile', { firstName: 'Pierre' });
    expect(result).toMatchObject({ user: { firstName: 'Pierre' } });
  });
});

describe('authService.logout', () => {
  it('posts the refresh token to the logout endpoint', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    await authService.logout('refresh-token-value');

    expect(api.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-token-value' });
  });
});

describe('authService.logoutAll', () => {
  it('posts to logout-all without a body', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    await authService.logoutAll();

    expect(api.post).toHaveBeenCalledWith('/auth/logout-all');
  });
});

describe('authService.changePassword', () => {
  it('sends old and new password to the change-password endpoint', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    await authService.changePassword('old-pass', 'new-pass');

    expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
      oldPassword: 'old-pass',
      newPassword: 'new-pass',
    });
  });
});
