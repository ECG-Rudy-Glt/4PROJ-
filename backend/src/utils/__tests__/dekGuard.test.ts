import { ensureDekUnlocked, requiresDekUnlock } from '../dekGuard';

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('dekGuard', () => {
  it('should require unlock for encrypted accounts without dekBuffer', () => {
    const req: any = { user: { encryptedDek: 'encrypted-dek' } };
    const res = createRes();

    expect(requiresDekUnlock(req)).toBe(true);
    expect(ensureDekUnlocked(req, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Le compte utilise un chiffrement utilisateur et doit etre deverrouille avant cette operation.',
      code: 'DEK_UNLOCK_REQUIRED',
    });
  });

  it('should allow encrypted accounts when dekBuffer is available', () => {
    const req: any = { user: { encryptedDek: 'encrypted-dek' }, dekBuffer: Buffer.from('dek') };
    const res = createRes();

    expect(requiresDekUnlock(req)).toBe(false);
    expect(ensureDekUnlocked(req, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should allow accounts without encrypted DEK', () => {
    const req: any = { user: { encryptedDek: null } };
    const res = createRes();

    expect(requiresDekUnlock(req)).toBe(false);
    expect(ensureDekUnlocked(req, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });
});
