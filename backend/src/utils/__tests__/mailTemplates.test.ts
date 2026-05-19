import {
  getAccountStatusEmail,
  getDelegationGrantedEmail,
  getDelegationRevokedEmail,
  getExpirationAlertEmail,
  getPasswordResetEmail,
  getPasswordChangeNotification,
  getShareNotificationEmail,
  getWelcomeEmail,
} from '../mailTemplates';

describe('mailTemplates transactional templates', () => {
  const originalMailLogoUrl = process.env.MAIL_LOGO_URL;

  beforeEach(() => {
    delete process.env.MAIL_LOGO_URL;
  });

  afterEach(() => {
    if (originalMailLogoUrl === undefined) {
      delete process.env.MAIL_LOGO_URL;
    } else {
      process.env.MAIL_LOGO_URL = originalMailLogoUrl;
    }
  });

  it('renders share emails with escaped variables and text fallback', () => {
    const template = getShareNotificationEmail('fr', {
      sharedBy: '<Admin>',
      itemName: 'budget <2026>.xlsx',
      itemType: 'file',
      permissions: { canRead: true, canWrite: true },
    });

    expect(template.subject).toContain('<Admin>');
    expect(template.text).toContain('budget <2026>.xlsx');
    expect(template.html).toContain('&lt;Admin&gt;');
    expect(template.html).toContain('budget &lt;2026&gt;.xlsx');
    expect(template.html).toContain('lecture, écriture');
  });

  it('renders delegation granted and revoked emails without private tokens', () => {
    const granted = getDelegationGrantedEmail('fr', 'Alice', 'Bob', { canRead: true }, null);
    const revoked = getDelegationRevokedEmail('fr', 'Alice', 'Bob');

    expect(granted.html).toContain('Délégation de compte accordée');
    expect(granted.text).not.toContain('refreshToken');
    expect(revoked.html).toContain('Délégation de compte révoquée');
    expect(revoked.text).not.toContain('refreshToken');
  });

  it('renders account suspension and reactivation emails', () => {
    const suspended = getAccountStatusEmail('fr', 'Alice', 'SUSPENDED', 'Abus');
    const active = getAccountStatusEmail('fr', 'Alice', 'ACTIVE');

    expect(suspended.subject).toContain('suspendu');
    expect(suspended.text).toContain('Abus');
    expect(active.subject).toContain('réactivé');
    expect(active.html).toContain('Ouvrir SupFile');
  });

  it('renders welcome, password change and expiration alerts with transactional HTML', () => {
    const welcome = getWelcomeEmail('fr', 'Alice');
    const passwordChanged = getPasswordChangeNotification('fr', 'Alice');
    const expiration = getExpirationAlertEmail(
      'fr',
      'Alice',
      'Lien public',
      7,
      'https://supfile.example/shared-links'
    );

    expect(welcome.text).toContain('Votre compte SupFile est prêt');
    expect(welcome.html).toContain('Bienvenue sur SupFile');
    expect(welcome.html).toContain('Ouvrir SupFile');
    expect(welcome.html).not.toContain('<img');

    expect(passwordChanged.text).toContain('mot de passe');
    expect(passwordChanged.html).toContain('Mot de passe modifié');
    expect(passwordChanged.html).toContain('vérifiez vos sessions actives');

    expect(expiration.subject).toContain('expire dans 7 jour');
    expect(expiration.text).toContain('https://supfile.example/shared-links');
    expect(expiration.html).toContain('Expiration prochaine du partage');
    expect(expiration.html).toContain('Gérer mes partages');
  });

  it('uses only configured non-SVG public logos in email HTML', () => {
    process.env.MAIL_LOGO_URL = 'https://assets.supfile.tech/logo.png';
    const withPngLogo = getWelcomeEmail('fr', 'Alice');
    expect(withPngLogo.html).toContain('<img src="https://assets.supfile.tech/logo.png"');

    process.env.MAIL_LOGO_URL = 'https://assets.supfile.tech/logo.svg';
    const withSvgLogo = getWelcomeEmail('fr', 'Alice');
    expect(withSvgLogo.html).not.toContain('<img');
    expect(withSvgLogo.html).toContain('SupFile</h1>');
  });

  it('renders password reset emails with escaped HTML variables and text fallback', () => {
    const template = getPasswordResetEmail(
      'fr',
      '<Alice>',
      'https://supfile.example/reset-password?token=abc&next=<dashboard>'
    );

    expect(template.subject).toContain('Réinitialisation');
    expect(template.text).toContain('https://supfile.example/reset-password?token=abc&next=<dashboard>');
    expect(template.html).toContain('Bonjour &lt;Alice&gt;');
    expect(template.html).toContain('https://supfile.example/reset-password?token=abc&amp;next=&lt;dashboard&gt;');
    expect(template.html).not.toContain('Bonjour <Alice>');
  });
});
