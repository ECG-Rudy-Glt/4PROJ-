const ORG_ID = 'org-1';

const baseUser = {
  id: 'user-1',
  email: 'admin@supfile.com',
  firstName: 'Admin',
  lastName: 'Supfile',
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

const buildOrganizationPayload = (membershipRole: 'OWNER' | 'ADMIN' | 'MEMBER') => ({
  organization: {
    id: ORG_ID,
    name: 'Org QA',
    slug: 'org-qa',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    members: [
      {
        id: 'member-owner',
        organizationId: ORG_ID,
        userId: 'owner-1',
        role: 'OWNER',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        user: {
          id: 'owner-1',
          email: 'owner@example.com',
          firstName: 'Owner',
          lastName: 'One',
          avatar: null,
          lastActiveAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        id: 'member-user',
        organizationId: ORG_ID,
        userId: 'member-1',
        role: 'MEMBER',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        user: {
          id: 'member-1',
          email: 'member@example.com',
          firstName: 'Member',
          lastName: 'One',
          avatar: null,
          lastActiveAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ],
  },
  membershipRole,
});

const mountOrganizationPage = (membershipRole: 'OWNER' | 'ADMIN' | 'MEMBER') => {
  cy.on('uncaught:exception', () => false);

  cy.intercept('GET', '**/api/auth/profile', {
    statusCode: 200,
    body: {
      user: baseUser,
      session: {
        authType: 'DIRECT',
        rootUserId: baseUser.id,
        actorUserId: baseUser.id,
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
          userId: baseUser.id,
          role: membershipRole,
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
    body: buildOrganizationPayload(membershipRole),
  }).as('getOrganizationDetails');

  cy.visit('/organization-admin', {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', 'test-token');
    },
  });

  cy.wait('@getProfile');
  cy.wait('@getOrganizations');
  cy.wait('@getOrganizationDetails');
  cy.contains('h1', 'Admin Organisation').should('be.visible');
};

describe('Organization Admin Guardrails', () => {
  it('allows OWNER to submit OWNER role when inviting a member', () => {
    mountOrganizationPage('OWNER');

    cy.intercept('POST', `**/api/organizations/${ORG_ID}/members`, (req) => {
      expect(req.body).to.deep.equal({
        email: 'new-owner@example.com',
        role: 'OWNER',
      });
      req.reply({
        statusCode: 201,
        body: {
          member: {
            id: 'member-new-owner',
            role: 'OWNER',
          },
        },
      });
    }).as('addMember');

    cy.get('input[placeholder="Email du membre"]')
      .closest('form')
      .within(() => {
        cy.get('input[placeholder="Email du membre"]').type('new-owner@example.com');
        cy.get('select').first().select('OWNER');
        cy.get('button[type="submit"]').click();
      });

    cy.wait('@addMember');
  });

  it('hides OWNER role choices for ADMIN and keeps OWNER row non-editable', () => {
    mountOrganizationPage('ADMIN');

    cy.get('input[placeholder="Email du membre"]')
      .closest('form')
      .within(() => {
        cy.get('select')
          .first()
          .find('option')
          .then((options) => {
            const values = [...options].map((opt) => (opt as HTMLOptionElement).value);
            expect(values).to.deep.equal(['ADMIN', 'MEMBER']);
          });
      });

    cy.contains('tr', 'owner@example.com').scrollIntoView().within(() => {
      cy.get('select').should('not.exist');
      cy.contains('span', 'OWNER').should('exist');
    });

    cy.contains('tr', 'member@example.com').within(() => {
      cy.get('select')
        .find('option')
        .then((options) => {
          const values = [...options].map((opt) => (opt as HTMLOptionElement).value);
          expect(values).to.deep.equal(['ADMIN', 'MEMBER']);
        });
    });
  });
});
