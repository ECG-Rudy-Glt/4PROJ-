export const ORG_ID = 'org-1';

export const createBaseUser = (overrides: Partial<any> = {}) => ({
  id: 'user-1',
  email: 'user@supfile.com',
  firstName: 'User',
  lastName: 'Supfile',
  avatar: null,
  role: 'USER',
  accountStatus: 'ACTIVE',
  plan: 'FREE',
  subscriptionStatus: 'ACTIVE',
  vaultEnabled: false,
  currentOrganizationId: ORG_ID,
  quotaUsed: 0,
  quotaLimit: 32212254720,
  theme: 'light',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

type AppShellOptions = {
  user?: any;
  session?: any;
  vaultStatus?: any;
  vaultRootFolder?: any;
  dashboard?: any;
};

export const interceptAppShell = ({
  user = createBaseUser(),
  session = {
    authType: 'DIRECT',
    rootUserId: 'user-1',
    actorUserId: 'user-1',
    delegation: null,
  },
  vaultStatus = {
    available: true,
    enabled: false,
    unlocked: false,
    locked: false,
  },
  vaultRootFolder = null,
  dashboard = {
    quotaUsed: 0,
    quotaLimit: user.quotaLimit || 32212254720,
    fileStats: {
      totalFiles: 0,
      totalSize: 0,
      byMimeType: {},
    },
    recentFiles: [],
  },
}: AppShellOptions = {}) => {
  cy.intercept('GET', '**/api/auth/profile', {
    statusCode: 200,
    body: { user, session },
  }).as('getProfile');

  cy.intercept('GET', '**/api/vault/status', {
    statusCode: 200,
    body: {
      status: vaultStatus,
      rootFolder: vaultRootFolder,
    },
  }).as('getVaultStatus');

  cy.intercept('GET', '**/api/dashboard', {
    statusCode: 200,
    body: dashboard,
  }).as('getDashboard');

  cy.intercept('GET', '**/api/notifications*', {
    statusCode: 200,
    body: { notifications: [], unreadCount: 0 },
  }).as('getNotifications');

  cy.intercept('GET', '**/api/push/vapid-public-key', {
    statusCode: 200,
    body: { publicKey: null },
  });
  cy.intercept('POST', '**/api/push/subscribe', {
    statusCode: 200,
    body: { success: true },
  });
  cy.intercept('POST', '**/api/push/unsubscribe', {
    statusCode: 200,
    body: { success: true },
  });

  cy.intercept('GET', '**/api/organizations/mine', {
    statusCode: 200,
    body: {
      organizations: [
        {
          id: 'membership-1',
          organizationId: ORG_ID,
          userId: user.id,
          role: 'OWNER',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          organization: {
            id: ORG_ID,
            name: 'Org QA',
            slug: 'org-qa',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      ],
    },
  }).as('getOrganizations');

  cy.intercept('GET', `**/api/organizations/${ORG_ID}`, {
    statusCode: 200,
    body: {
      organization: {
        id: ORG_ID,
        name: 'Org QA',
        slug: 'org-qa',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        members: [],
      },
      membershipRole: 'OWNER',
    },
  }).as('getOrganizationDetails');
};
