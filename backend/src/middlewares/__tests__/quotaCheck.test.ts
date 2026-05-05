import { checkQuotaBeforeUpload } from '../quotaCheck';
import { PlanService } from '../../services/planService';
import { deleteFile } from '../../utils/fileUtils';

jest.mock('../../services/planService', () => ({
  PlanService: {
    checkQuota: jest.fn(),
  },
}));

jest.mock('../../utils/fileUtils', () => ({
  deleteFile: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('checkQuotaBeforeUpload after multer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (deleteFile as jest.Mock).mockResolvedValue(undefined);
    (PlanService.checkQuota as jest.Mock).mockResolvedValue(true);
  });

  it('keeps quota checks for normal uploads', async () => {
    const req: any = {
      user: { id: 'user-1' },
      body: {},
      files: [{ path: '/tmp/a', size: 25 }, { path: '/tmp/b', size: 15 }],
    };
    const res = createRes();
    const next = jest.fn();

    await checkQuotaBeforeUpload(req, res, next);

    expect(PlanService.checkQuota).toHaveBeenCalledWith('user-1', 40);
    expect(next).toHaveBeenCalled();
  });

  it('cleans uploaded temp files and stops before the controller when normal upload quota is refused', async () => {
    (PlanService.checkQuota as jest.Mock).mockResolvedValue(false);
    const req: any = {
      user: { id: 'user-1' },
      body: {},
      files: [{ path: '/tmp/a', size: 25 }, { path: '/tmp/b', size: 15 }],
    };
    const res = createRes();
    const next = jest.fn();

    await checkQuotaBeforeUpload(req, res, next);

    expect(PlanService.checkQuota).toHaveBeenCalledWith('user-1', 40);
    expect(deleteFile).toHaveBeenCalledWith('/tmp/a');
    expect(deleteFile).toHaveBeenCalledWith('/tmp/b');
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Quota dépassé',
      message: 'L\'espace de stockage disponible est insuffisant pour ce fichier. Veuillez libérer de l\'espace ou passer à un plan supérieur.',
      code: 'QUOTA_EXCEEDED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('skips quota precheck for replacements and delegates to FileUploadService/VersionService', async () => {
    const req: any = {
      user: { id: 'user-1' },
      body: { replaceFileId: 'file-1' },
      files: [{ path: '/tmp/a', size: 25 }],
    };
    const res = createRes();
    const next = jest.fn();

    await checkQuotaBeforeUpload(req, res, next);

    expect(PlanService.checkQuota).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('does not check the actor quota before shared replacements', async () => {
    const req: any = {
      user: { id: 'shared-user' },
      body: { replaceFileId: 'file-1' },
      files: [{ path: '/tmp/a', size: 25 }],
    };
    const res = createRes();
    const next = jest.fn();

    await checkQuotaBeforeUpload(req, res, next);

    expect(PlanService.checkQuota).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
