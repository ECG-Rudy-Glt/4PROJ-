import { createBaseUser, interceptAppShell } from './helpers/appMocks';

describe('Preprod readiness — OAuth providers', () => {
  it('shows only configured OAuth providers on login', () => {
    cy.intercept('GET', '**/api/auth/providers', {
      statusCode: 200,
      body: { google: true, github: false },
    }).as('providers');

    cy.visit('/login');
    cy.wait('@providers');

    cy.contains('button', 'Google').should('be.visible');
    cy.contains('button', 'GitHub').should('not.exist');
  });
});

describe('Preprod readiness — Stripe test checkout', () => {
  it('redirects to the Stripe checkout URL returned by the backend', () => {
    cy.on('uncaught:exception', () => false);

    const user = createBaseUser({ plan: 'FREE' });
    interceptAppShell({ user });
    cy.intercept('GET', '**/api/auth/providers', {
      statusCode: 200,
      body: { google: true, github: true },
    });
    cy.intercept('POST', '**/api/billing/checkout-session', {
      statusCode: 200,
      body: { id: 'cs_test_123', url: 'http://localhost:4173/plans?checkout=success' },
    }).as('checkout');

    cy.visit('/plans', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'jwt-token');
      },
    });

    cy.contains('button', /select|selectionner|sélectionner/i).click();
    cy.wait('@checkout');
  });
});

describe('Preprod readiness — public legal pages', () => {
  it('serves legal, privacy, terms and contact pages without authentication', () => {
    cy.visit('/legal');
    cy.contains(/mentions/i).should('be.visible');

    cy.visit('/privacy');
    cy.contains(/confidentialite|confidentialité/i).should('be.visible');

    cy.visit('/terms');
    cy.contains(/conditions/i).should('be.visible');

    cy.visit('/contact');
    cy.contains(/contact/i).should('be.visible');
  });
});
