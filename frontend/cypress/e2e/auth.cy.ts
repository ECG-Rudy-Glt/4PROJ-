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
