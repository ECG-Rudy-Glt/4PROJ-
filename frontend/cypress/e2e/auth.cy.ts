describe('Authentication Flow', () => {
  it('should redirect from root to login if not authenticated', () => {
    cy.visit('/')
    cy.url().should('include', '/login')
  })

  it('should show the login form', () => {
    cy.visit('/login')
    cy.get('form').should('exist')
    cy.get('input[type="email"]').should('exist')
    cy.get('input[type="password"]').should('exist')
    cy.get('button[type="submit"]').should('exist')
  })
})

describe('Register Flow', () => {
  beforeEach(() => {
    cy.visit('/register')
  })

  it('should show the register form with all fields', () => {
    cy.get('form').should('exist')
    cy.get('input[type="text"]').should('have.length', 2)
    cy.get('input[type="email"]').should('exist')
    cy.get('input[type="password"]').should('have.length', 2)
    cy.get('button[type="submit"]').should('exist').and('contain', "S'inscrire")
  })

  it('should show an error when passwords do not match', () => {
    cy.get('input[type="email"]').type('test@example.com')
    cy.get('input[type="password"]').first().type('password123')
    cy.get('input[type="password"]').last().type('different123')
    cy.get('button[type="submit"]').click()
    cy.contains('Les mots de passe ne correspondent pas').should('be.visible')
  })

  it('should show an error when password is too short', () => {
    cy.get('input[type="email"]').type('test@example.com')
    cy.get('input[type="password"]').first().type('abc')
    cy.get('input[type="password"]').last().type('abc')
    cy.get('button[type="submit"]').click()
    cy.contains('au moins 6 caractères').should('be.visible')
  })

  it('should navigate to login page via the link', () => {
    cy.contains('Se connecter').click()
    cy.url().should('include', '/login')
  })

  it('should register successfully and redirect to dashboard', () => {
    // Suppress uncaught exceptions from the dashboard (e.g. lazy-loaded modules
    // that require backend context not available in preview/static mode)
    cy.on('uncaught:exception', () => false)

    cy.intercept('POST', '**/auth/register', {
      statusCode: 201,
      body: {
        user: { id: '1', email: 'jean.dupont@example.com', firstName: 'Jean', lastName: 'Dupont' },
        token: 'fake-jwt-token',
      },
    }).as('registerRequest')

    cy.get('input[type="text"]').first().type('Jean')
    cy.get('input[type="text"]').last().type('Dupont')
    cy.get('input[type="email"]').type('jean.dupont@example.com')
    cy.get('input[type="password"]').first().type('password123')
    cy.get('input[type="password"]').last().type('password123')
    cy.get('button[type="submit"]').click()

    cy.wait('@registerRequest')
    cy.url().should('include', '/dashboard')
  })
})
