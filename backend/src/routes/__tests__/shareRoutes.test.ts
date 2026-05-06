import shareRoutes from '../shareRoutes';

jest.mock('../../middlewares/auth', () => ({
  authenticate: jest.fn((req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  }),
}));

jest.mock('../../middlewares/delegation', () => ({
  requireDelegationPermission: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

jest.mock('../../controllers/shareController', () => {
  const handler = (name: string) => jest.fn((_req, res) => res.status(200).json({ handler: name }));

  return {
    ShareController: {
      getPendingShares: handler('pending'),
      acceptSharedFolder: handler('folder-accept'),
      rejectSharedFolder: handler('folder-reject'),
      acceptSharedFile: handler('file-accept'),
      rejectSharedFile: handler('file-reject'),
      createShareLink: handler('link-create'),
      listUserShareLinks: handler('links-list'),
      deleteShareLink: handler('link-delete'),
      shareFolder: handler('folder-share'),
      listSharedWithMe: handler('folders-with-me'),
      listSharedByMe: handler('folders-by-me'),
      updateSharedFolderPermissions: handler('folder-permissions'),
      removeSharedFolder: handler('folder-remove'),
      shareFile: handler('file-share'),
      listFilesSharedWithMe: handler('files-with-me'),
      listFilesSharedByMe: handler('files-by-me'),
      getFileShares: handler('file-shares'),
      updateSharedFilePermissions: handler('file-permissions'),
      removeSharedFile: handler('file-remove'),
      getSharedFolderContents: handler('folder-contents'),
      streamSharedFile: handler('access-stream'),
      downloadSharedFileAuth: handler('access-download'),
      getSharedFile: handler('public-token'),
      downloadSharedFile: handler('public-download'),
    },
  };
});

const routes = () =>
  (shareRoutes as any).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

const routeIndex = (method: string, path: string) =>
  routes().findIndex((route: { path: string; methods: string[] }) =>
    route.path === path && route.methods.includes(method)
  );

describe('shareRoutes route order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not route /folders/with-me through /:token', async () => {
    expect(routeIndex('get', '/folders/with-me')).toBeGreaterThanOrEqual(0);
    expect(routeIndex('get', '/folders/with-me')).toBeLessThan(routeIndex('get', '/:token'));
  });

  it('does not route /files/with-me through /:token', async () => {
    expect(routeIndex('get', '/files/with-me')).toBeGreaterThanOrEqual(0);
    expect(routeIndex('get', '/files/with-me')).toBeLessThan(routeIndex('get', '/:token'));
  });

  it('does not route /access/:fileId/stream through /:token', async () => {
    expect(routeIndex('get', '/access/:fileId/stream')).toBeGreaterThanOrEqual(0);
    expect(routeIndex('get', '/access/:fileId/stream')).toBeLessThan(routeIndex('get', '/:token'));
  });

  it('does not route /folders/:folderId/contents through /:token', async () => {
    expect(routeIndex('get', '/folders/:folderId/contents')).toBeGreaterThanOrEqual(0);
    expect(routeIndex('get', '/folders/:folderId/contents')).toBeLessThan(routeIndex('get', '/:token'));
  });

  it('keeps public share links working after static routes', async () => {
    expect(routeIndex('get', '/:token')).toBeGreaterThanOrEqual(0);
    expect(routeIndex('get', '/:token/download')).toBeGreaterThanOrEqual(0);
    expect(routeIndex('get', '/:token/download')).toBeGreaterThan(routeIndex('get', '/access/:fileId/download'));
  });
});
