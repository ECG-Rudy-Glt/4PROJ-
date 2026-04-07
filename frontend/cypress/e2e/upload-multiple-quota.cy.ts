import { createBaseUser, interceptAppShell } from './helpers/appMocks';

const setupFilesPageMocks = () => {
  cy.intercept('GET', '**/api/files*', {
    statusCode: 200,
    body: { files: [] },
  }).as('listFiles');

  cy.intercept('GET', '**/api/folders*', {
    statusCode: 200,
    body: { folders: [] },
  }).as('listFolders');

  cy.intercept('GET', '**/api/share/pending', {
    statusCode: 200,
    body: { files: [], folders: [] },
  }).as('pendingShares');

  cy.intercept('GET', '**/api/files/shares/accepted', {
    statusCode: 200,
    body: { files: [], folders: [] },
  }).as('acceptedShares');
};

describe('Multi-upload and quota guard', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false);
  });

  it('uploads multiple files through the queue', () => {
    const user = createBaseUser({
      plan: 'PRO',
      quotaUsed: 0,
      quotaLimit: 32212254720,
    });

    interceptAppShell({ user });
    setupFilesPageMocks();

    let uploadCount = 0;
    cy.intercept('POST', '**/api/files/upload', (req) => {
      uploadCount += 1;
      req.reply({
        statusCode: 201,
        body: {
          files: [
            {
              id: `uploaded-${uploadCount}`,
              name: `uploaded-${uploadCount}.txt`,
            },
          ],
        },
      });
    }).as('uploadFile');

    cy.visit('/files', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'test-token');
      },
    });

    cy.wait('@listFiles');
    cy.wait('@listFolders');

    cy.get('input[type="file"][multiple]').first().selectFile(
      [
        {
          contents: Cypress.Buffer.from('first-file-content'),
          fileName: 'first.txt',
          mimeType: 'text/plain',
        },
        {
          contents: Cypress.Buffer.from('second-file-content'),
          fileName: 'second.txt',
          mimeType: 'text/plain',
        },
      ],
      { force: true }
    );

    cy.wait('@uploadFile');
    cy.wait('@uploadFile');

    cy.contains('first.txt').should('exist');
    cy.contains('second.txt').should('exist');
    cy.contains(/2\/2 fichier/).should('be.visible');
    cy.then(() => {
      expect(uploadCount).to.equal(2);
    });
  });

  it('blocks extra files when local quota would be exceeded', () => {
    const user = createBaseUser({
      plan: 'FREE',
      quotaUsed: 0,
      quotaLimit: 10,
    });

    interceptAppShell({ user });
    setupFilesPageMocks();

    let uploadCount = 0;
    cy.intercept('POST', '**/api/files/upload', (req) => {
      uploadCount += 1;
      req.reply({
        statusCode: 201,
        body: { files: [{ id: 'uploaded-1', name: 'ok.txt' }] },
      });
    }).as('uploadFile');

    cy.visit('/files', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'test-token');
      },
    });

    cy.wait('@listFiles');
    cy.wait('@listFolders');

    cy.get('input[type="file"][multiple]').first().selectFile(
      [
        {
          contents: Cypress.Buffer.from('123456'),
          fileName: 'fits.txt',
          mimeType: 'text/plain',
        },
        {
          contents: Cypress.Buffer.from('abcdef'),
          fileName: 'too-much.txt',
          mimeType: 'text/plain',
        },
      ],
      { force: true }
    );

    cy.wait('@uploadFile');
    cy.contains('too-much.txt').should('exist');
    cy.contains('Quota dépassé - espace insuffisant').should('exist');
    cy.then(() => {
      expect(uploadCount).to.equal(1);
    });
  });
});
