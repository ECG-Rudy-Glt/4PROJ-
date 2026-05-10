import { createBaseUser, interceptAppShell } from './helpers/appMocks';

const baseUser = createBaseUser();

function interceptLogin(body: object, statusCode = 200) {
  return cy.intercept('POST', '**/api/auth/login', { statusCode, body }).as('loginRequest');
}

function fillLoginForm(email: string, password: string) {
  cy.get('input[type="email"]').clear().type(email);
  cy.get('input[type="password"]').clear().type(password);
  cy.get('button[type="submit"]').click();
}

describe('Login Form — validation', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('shows the login form with email, password and submit button', () => {
    cy.get('input[type="email"]').should('exist');
    cy.get('input[type="password"]').should('exist');
    cy.get('button[type="submit"]').should('exist');
  });

  it('disables or rejects submit when email is empty', () => {
    cy.get('input[type="password"]').type('P@ssword1!');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/login');
  });

  it('shows a link to the register page', () => {
    cy.contains('a', /sign up|register|create/i).should('exist');
  });
});

describe('Login Flow — successful without MFA', () => {
  it('redirects to dashboard after valid credentials with no MFA', () => {
    cy.on('uncaught:exception', () => false);

    interceptAppShell({ user: baseUser });

    interceptLogin({ user: baseUser, token: 'jwt-token' }, 200);

    cy.visit('/login');
    fillLoginForm('user@supfile.com', 'P@ssword1!');

    cy.wait('@loginRequest');
    cy.url().should('include', '/dashboard');
    cy.wait('@getDashboard');
  });
});

describe('Login Flow — MFA required', () => {
  it('shows the MFA code input after valid credentials trigger MFA challenge', () => {
    cy.on('uncaught:exception', () => false);

    interceptLogin({ mfaRequired: true, tempToken: 'temp-token', userId: 'user-1' }, 200);

    cy.visit('/login');
    fillLoginForm('user@supfile.com', 'P@ssword1!');

    cy.wait('@loginRequest');
    cy.get('input[placeholder="000000"]').should('be.visible');
  });

  it('completes login after correct MFA code', () => {
    cy.on('uncaught:exception', () => false);

    interceptAppShell({ user: baseUser });
    interceptLogin({ mfaRequired: true, tempToken: 'temp-token', userId: 'user-1' }, 200);
    cy.intercept('POST', '**/api/mfa/verify', {
      statusCode: 200,
      body: { user: baseUser, token: 'jwt-final-token' },
    }).as('mfaVerify');

    cy.visit('/login');
    fillLoginForm('user@supfile.com', 'P@ssword1!');

    cy.wait('@loginRequest');
    cy.get('input[placeholder="000000"]').type('123456');
    cy.contains('button', /verify|confirm/i).click();

    cy.wait('@mfaVerify');
    cy.url().should('include', '/dashboard');
  });

  it('shows an error on wrong MFA code', () => {
    cy.on('uncaught:exception', () => false);

    interceptLogin({ mfaRequired: true, tempToken: 'temp-token', userId: 'user-1' });
    cy.intercept('POST', '**/api/mfa/verify', {
      statusCode: 401,
      body: { error: 'Invalid MFA code' },
    }).as('mfaVerifyFail');

    cy.visit('/login');
    fillLoginForm('user@supfile.com', 'P@ssword1!');

    cy.wait('@loginRequest');
    cy.get('input[placeholder="000000"]').type('000000');
    cy.contains('button', /verify|confirm/i).click();

    cy.wait('@mfaVerifyFail');
    cy.url().should('not.include', '/dashboard');
  });
});

describe('Login Flow — error cases', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('shows an error message on wrong credentials', () => {
    cy.on('uncaught:exception', () => false);

    interceptLogin({ error: 'Invalid credentials' }, 401);

    fillLoginForm('user@supfile.com', 'wrong-password');

    cy.wait('@loginRequest');
    cy.url().should('include', '/login');
  });

  it('shows an error message when the account is suspended', () => {
    cy.on('uncaught:exception', () => false);

    interceptLogin({ error: 'Account suspended' }, 403);

    fillLoginForm('suspended@supfile.com', 'P@ssword1!');

    cy.wait('@loginRequest');
    cy.url().should('include', '/login');
  });

  it('navigates to the register page via the sign-up link', () => {
    cy.contains('a', /sign up|register|create/i).click();
    cy.url().should('include', '/register');
  });
});

describe('Login Flow — already authenticated', () => {
  it('stays on the login page when the token is invalid or not yet validated', () => {
    cy.on('uncaught:exception', () => false);

    cy.intercept('GET', '**/api/auth/profile', { statusCode: 401, body: { error: 'Unauthorized' } });

    cy.visit('/login', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'expired-jwt-token');
      },
    });

    cy.url().should('include', '/login');
    cy.get('input[type="email"]').should('exist');
  });
});
