import { createBaseUser, interceptAppShell } from './helpers/appMocks';

const rootUser = createBaseUser({
  id: 'user-1',
  email: 'root@supfile.com',
  firstName: 'Root',
  lastName: 'User',
  role: 'ADMIN',
  plan: 'PRO',
});

const directSession = {
  authType: 'DIRECT',
  rootUserId: rootUser.id,
  actorUserId: rootUser.id,
  delegation: null,
};

const interceptBaseAppCalls = () => {
  interceptAppShell({
    user: rootUser,
    session: directSession,
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
            ...rootUser,
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

    cy.contains('button', 'Link an account').click();
    cy.get('input[placeholder="Email"]').type('linked@example.com');
    cy.get('input[placeholder="Password"]').type('password123');
    cy.get('input[placeholder="Label (e.g., Work account)"]').type('Compte secondaire');
    cy.contains('button', 'Next').click();

    cy.get('input[placeholder="MFA Code"]').type('123456');
    cy.get('form').contains('button', 'Link an account').click();

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
              ...rootUser,
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
          ...rootUser,
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

  it('switches to another account and then returns to the root account', () => {
    const switchedUser = {
      ...rootUser,
      id: 'target-3',
      email: 'switched@example.com',
      firstName: 'Switched',
    };

    let currentProfile = {
      user: rootUser,
      session: directSession,
    };

    cy.intercept(
      {
        method: 'GET',
        url: '**/api/auth/profile',
        middleware: true,
      },
      (req) => {
        req.reply({
          statusCode: 200,
          body: currentProfile,
        });
      }
    ).as('getDynamicProfile');

    cy.intercept('GET', '**/api/account-access/switch-links', {
      statusCode: 200,
      body: {
        links: [
          {
            id: 'link-1',
            label: 'Compte bascule',
            expiresAt: '2026-12-31T00:00:00.000Z',
            lastAuthenticatedAt: '2026-01-01T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
            targetUser: switchedUser,
          },
        ],
      },
    }).as('listSwitchLinks');

    cy.intercept('GET', '**/api/account-access/delegations', {
      statusCode: 200,
      body: { given: [], received: [] },
    }).as('listDelegations');

    cy.intercept('POST', '**/api/account-access/switch-links/link-1/switch', (req) => {
      currentProfile = {
        user: switchedUser,
        session: {
          authType: 'SWITCH',
          rootUserId: rootUser.id,
          actorUserId: rootUser.id,
          delegation: null,
        },
      };

      req.reply({
        statusCode: 200,
        body: {
          token: 'switched-token-2',
          user: switchedUser,
          authContext: {
            authType: 'SWITCH',
            rootUserId: rootUser.id,
            actorUserId: rootUser.id,
            delegation: null,
          },
          switchSessionId: 'sw-123'
        },
      });
    }).as('switchAccount');

    cy.intercept('POST', '**/api/account-access/switch/back', (req) => {
      currentProfile = {
        user: rootUser,
        session: directSession,
      };

      req.reply({
        statusCode: 200,
        body: {
          token: 'root-token',
          user: rootUser,
          authContext: {
            authType: 'DIRECT',
            rootUserId: rootUser.id,
            actorUserId: rootUser.id,
            delegation: null,
          }
        },
      });
    }).as('switchBack');

    cy.visit('/organization-admin', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'test-token');
      },
    });

    cy.wait('@getDynamicProfile');

    cy.get('button[title="Switch de comptes"]').click();
    cy.wait('@listSwitchLinks');
    cy.wait('@listDelegations');
    cy.contains('button', 'Switch').click();
    cy.wait('@switchAccount');

    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.equal('switched-token-2');
    });

    // Re-open the modal. The Return button triggers switchBack which calls
    // window.location.replace('/dashboard') - use force:true to click before
    // the element detaches from the DOM during the navigation.
    cy.get('button[title="Switch de comptes"]').click();
    cy.contains('button', 'Return').click({ force: true });
    cy.wait('@switchBack');

    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.equal('root-token');
    });
  });
});
