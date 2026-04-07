import { createBaseUser, interceptAppShell } from './helpers/appMocks';

describe('Vault auto-lock on page leave', () => {
  it('locks the vault when leaving the vault folder route', () => {
    cy.on('uncaught:exception', () => false);

    const vaultRootId = 'vault-root';
    const user = createBaseUser({
      plan: 'PRO',
      vaultEnabled: true,
    });

    interceptAppShell({
      user,
      vaultStatus: {
        available: true,
        enabled: true,
        unlocked: true,
        locked: false,
      },
      vaultRootFolder: {
        id: vaultRootId,
        name: 'Coffre-fort',
        path: '/Coffre-fort',
        isVault: true,
      },
    });

    let currentVaultStatus = {
      available: true,
      enabled: true,
      unlocked: true,
      locked: false,
    };

    cy.intercept({
      method: 'GET',
      url: '**/api/vault/status',
      middleware: true,
    }, (req) => {
      req.reply({
        statusCode: 200,
        body: {
          status: currentVaultStatus,
          rootFolder: {
            id: vaultRootId,
            name: 'Coffre-fort',
            path: '/Coffre-fort',
            isVault: true,
          },
        },
      });
    }).as('getVaultStatus');

    cy.intercept('POST', '**/api/vault/lock', (req) => {
      currentVaultStatus = {
        ...currentVaultStatus,
        unlocked: false,
        locked: true,
      };

      req.reply({
        statusCode: 200,
        body: { status: currentVaultStatus },
      });
    }).as('lockVault');

    cy.intercept('GET', '**/api/files*', {
      statusCode: 200,
      body: { files: [] },
    }).as('listFiles');
    cy.intercept('GET', '**/api/folders*', {
      statusCode: 200,
      body: { folders: [] },
    }).as('listFolders');
    cy.intercept('GET', `**/api/folders/${vaultRootId}/breadcrumbs`, {
      statusCode: 200,
      body: {
        breadcrumbs: [{ id: vaultRootId, name: 'Coffre-fort' }],
      },
    }).as('getBreadcrumbs');
    cy.intercept('GET', '**/api/share/pending', {
      statusCode: 200,
      body: { files: [], folders: [] },
    });
    cy.intercept('GET', '**/api/files/shares/accepted', {
      statusCode: 200,
      body: { files: [], folders: [] },
    });

    cy.visit(`/files/${vaultRootId}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'test-token');
      },
    });

    cy.wait('@getProfile');
    cy.wait('@getVaultStatus');
    cy.wait('@listFiles');
    cy.wait('@listFolders');
    cy.wait('@getBreadcrumbs');

    cy.contains('a', 'Dashboard').click();
    cy.wait('@lockVault', { timeout: 10000 });
    cy.url().should('include', '/dashboard');
  });
});
