const ORG_ID = 'org-1';

const profileUser = {
  id: 'user-1',
  email: 'root@supfile.com',
  firstName: 'Root',
  lastName: 'User',
  avatar: null,
  role: 'ADMIN',
  accountStatus: 'ACTIVE',
  plan: 'PRO',
  subscriptionStatus: 'ACTIVE',
  vaultEnabled: false,
  currentOrganizationId: ORG_ID,
  quotaUsed: 0,
  quotaLimit: 32212254720,
  theme: 'light',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const interceptBaseAppCalls = () => {
  cy.intercept('GET', '**/api/auth/profile', {
    statusCode: 200,
    body: {
      user: profileUser,
      session: {
        authType: 'DIRECT',
        rootUserId: profileUser.id,
        actorUserId: profileUser.id,
        delegation: null,
      },
    },
  }).as('getProfile');

  cy.intercept('GET', '**/api/vault/status', {
    statusCode: 200,
    body: {
      status: {
        available: true,
        enabled: false,
        unlocked: false,
        locked: false,
      },
      rootFolder: null,
    },
  });

  cy.intercept('GET', '**/api/notifications*', {
    statusCode: 200,
    body: { notifications: [], unreadCount: 0 },
  });

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
          userId: profileUser.id,
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
  });

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
  });
};

describe('Account Switcher Modal', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false);
    interceptBaseAppCalls();
  });

  it('links an account and sends expected payload', () => {
    let links: any[] = [];

    cy.intercept('GET', '**/api/account-access/switch-links', (req) => {
      req.reply({ statusCode: 200, body: { links } });
    }).as('listSwitchLinks');

    cy.intercept('GET', '**/api/account-access/delegations', {
      statusCode: 200,
      body: { given: [], received: [] },
    }).as('listDelegations');

    cy.intercept('POST', '**/api/account-access/switch-links', (req) => {
      expect(req.body.email).to.equal('linked@example.com');
      expect(req.body.password).to.equal('password123');
      expect(req.body.mfaCode).to.equal('123456');
      expect(req.body.label).to.equal('Compte secondaire');

      links = [
        {
          id: 'link-1',
          label: 'Compte secondaire',
          expiresAt: '2026-12-31T00:00:00.000Z',
          lastAuthenticatedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          targetUser: {
            ...profileUser,
            id: 'target-1',
            email: 'linked@example.com',
          },
        },
      ];

      req.reply({ statusCode: 201, body: { link: links[0] } });
    }).as('addSwitchLink');

    cy.visit('/organization-admin', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'test-token');
      },
    });

    cy.wait('@getProfile');

    cy.get('button[title="Switch de comptes"]').click();
    cy.wait('@listSwitchLinks');
    cy.wait('@listDelegations');

    cy.get('input[placeholder="Email du compte à lier"]').type('linked@example.com');
    cy.get('input[placeholder="Mot de passe"]').type('password123');
    cy.get('input[placeholder="Code MFA (optionnel)"]').type('123456');
    cy.get('input[placeholder="Libellé (optionnel)"]').type('Compte secondaire');
    cy.contains('button', 'Lier le compte').click();

    cy.wait('@addSwitchLink');
    cy.wait('@listSwitchLinks');
    cy.contains('linked@example.com').should('exist');
  });

  it('switches to a linked account and stores the returned token', () => {
    cy.intercept('GET', '**/api/account-access/switch-links', {
      statusCode: 200,
      body: {
        links: [
          {
            id: 'link-1',
            label: 'Compte test',
            expiresAt: '2026-12-31T00:00:00.000Z',
            lastAuthenticatedAt: '2026-01-01T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
            targetUser: {
              ...profileUser,
              id: 'target-2',
              email: 'target@example.com',
            },
          },
        ],
      },
    }).as('listSwitchLinks');

    cy.intercept('GET', '**/api/account-access/delegations', {
      statusCode: 200,
      body: { given: [], received: [] },
    }).as('listDelegations');

    cy.intercept('POST', '**/api/account-access/switch-links/link-1/switch', {
      statusCode: 200,
      body: {
        token: 'switched-token',
        user: {
          ...profileUser,
          id: 'target-2',
          email: 'target@example.com',
        },
      },
    }).as('switchAccount');

    cy.visit('/organization-admin', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'test-token');
      },
    });

    cy.wait('@getProfile');

    cy.get('button[title="Switch de comptes"]').click();
    cy.wait('@listSwitchLinks');
    cy.wait('@listDelegations');

    cy.contains('button', 'Switch').click();
    cy.wait('@switchAccount');

    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.equal('switched-token');
    });
  });
});
