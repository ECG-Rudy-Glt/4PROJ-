const mockAuthenticate = jest.fn((_req, _res, next) => next());
const mockDelegationHandler = jest.fn((_req, _res, next) => next());
const mockUploadArrayHandler = jest.fn((_req, _res, next) => next());
const mockCheckQuotaBeforeUpload = jest.fn((_req, _res, next) => next());
const mockUploadFile = jest.fn();

jest.mock('../../middlewares/auth', () => ({
  authenticate: mockAuthenticate,
}));

jest.mock('../../middlewares/delegation', () => ({
  requireDelegationPermission: jest.fn(() => mockDelegationHandler),
}));

jest.mock('../../config/multer', () => ({
  upload: {
    array: jest.fn(() => mockUploadArrayHandler),
  },
}));

jest.mock('../../middlewares/quotaCheck', () => ({
  checkQuotaBeforeUpload: mockCheckQuotaBeforeUpload,
}));

jest.mock('../../controllers/fileController', () => ({
  FileController: {
    uploadFile: mockUploadFile,
    listFiles: jest.fn(),
    getDeletedFiles: jest.fn(),
    getFavoriteFiles: jest.fn(),
    getAcceptedShares: jest.fn(),
    exportFilesCsv: jest.fn(),
    searchFiles: jest.fn(),
    getFile: jest.fn(),
    downloadFile: jest.fn(),
    streamFile: jest.fn(),
    updateFile: jest.fn(),
    moveFile: jest.fn(),
    restoreFile: jest.fn(),
    toggleFavorite: jest.fn(),
    deleteFile: jest.fn(),
  },
}));

import fileRoutes from '../fileRoutes';

const uploadHandlers = () => {
  const uploadLayer = (fileRoutes as any).stack.find((layer: any) => layer.route?.path === '/upload');
  return uploadLayer.route.stack.map((layer: any) => layer.handle);
};

describe('fileRoutes upload quota order', () => {
  it('parses multipart data before quota check so replacements can skip precheck', () => {
    const handlers = uploadHandlers();

    expect(handlers.indexOf(mockUploadArrayHandler)).toBeGreaterThanOrEqual(0);
    expect(handlers.indexOf(mockCheckQuotaBeforeUpload)).toBeGreaterThanOrEqual(0);
    expect(handlers.indexOf(mockUploadFile)).toBeGreaterThanOrEqual(0);
    expect(handlers.indexOf(mockUploadArrayHandler)).toBeLessThan(handlers.indexOf(mockCheckQuotaBeforeUpload));
    expect(handlers.indexOf(mockCheckQuotaBeforeUpload)).toBeLessThan(handlers.indexOf(mockUploadFile));
  });
});
