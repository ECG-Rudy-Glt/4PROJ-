import { createBaseUser, interceptAppShell } from './helpers/appMocks';

describe('Onboarding FREE plan', () => {
  it('assigns FREE plan automatically after registration', () => {
    cy.on('uncaught:exception', () => false);

    const registeredUser = createBaseUser({
      id: 'new-user-1',
      email: 'new.user@example.com',
      firstName: 'New',
      lastName: 'User',
      plan: 'FREE',
      quotaUsed: 0,
      quotaLimit: 32212254720,
    });

    interceptAppShell({
      user: registeredUser,
      dashboard: {
        quotaUsed: 0,
        quotaLimit: 32212254720,
        fileStats: {
          totalFiles: 0,
          totalSize: 0,
          byMimeType: {},
        },
        recentFiles: [],
      },
    });

    cy.intercept('POST', '**/api/auth/register', (req) => {
      expect(req.body.email).to.equal('new.user@example.com');
      req.reply({
        statusCode: 201,
        body: {
          user: registeredUser,
          token: 'jwt-new-user-token',
        },
      });
    }).as('registerRequest');

    cy.visit('/register');

    cy.get('input[type="text"]').first().type('New');
    cy.get('input[type="text"]').last().type('User');
    cy.get('input[type="email"]').type('new.user@example.com');
    cy.get('input[type="password"]').first().type('password123');
    cy.get('input[type="password"]').last().type('password123');
    cy.get('button[type="submit"]').click();

    cy.wait('@registerRequest');
    cy.url().should('include', '/dashboard');
    cy.wait('@getDashboard');

    cy.contains('of 30.00 Go').should('be.visible');
    cy.contains('a', 'Plans & Pricing').click();

    cy.contains('h3', 'Free')
      .closest('div.relative')
      .within(() => {
        cy.contains('Current plan').should('be.visible');
      });
  });
});
