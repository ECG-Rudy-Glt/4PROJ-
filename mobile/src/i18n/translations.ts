export type Lang = 'fr' | 'en';

const fr = {
  // Page title
  profile: 'Profil',

  // Personal info
  personalInfo: 'Informations personnelles',
  firstName: 'Prénom',
  lastName: 'Nom',
  email: 'Email',
  language: 'Langue',
  saveChanges: 'Enregistrer les modifications',

  // Theme
  theme: 'Thème',
  themeLight: 'Clair',
  themeDark: 'Sombre',
  themeSystem: 'Système',

  // Storage
  storage: 'Espace de stockage',
  storageUsed: 'Utilisé',
  storageTotal: 'Total',
  storagePercent: (pct: number) => `${pct}% utilisé`,
  plans: 'Forfaits & abonnements',

  // Security
  security: 'Sécurité',
  mfa: 'Double authentification (MFA)',
  mfaActive: 'Actif',
  mfaInactive: 'Inactif',
  vault: 'Coffre-fort chiffré',
  changePassword: 'Changer le mot de passe',
  currentPassword: 'Mot de passe actuel',
  newPassword: 'Nouveau mot de passe',
  confirmPassword: 'Confirmer le nouveau mot de passe',
  modifyPassword: 'Modifier le mot de passe',
  activeSessions: 'Sessions actives',
  sessionsDesc: 'Appareils connectés à votre compte. Déconnectez les appareils inconnus.',
  noActiveSessions: 'Aucune session active',
  disconnectDevice: 'Déconnecter cet appareil',
  disconnectAll: 'Se déconnecter de tous les appareils',
  unknownDevice: 'Appareil inconnu',

  // Shortcuts
  shortcuts: 'Raccourcis',
  pushNotifications: 'Notifications push',
  pushNotifDesc: 'Recevoir des alertes sur cet appareil',
  pushNotifUnsupported: 'Disponible sur app native uniquement',
  notificationCenter: 'Centre de notifications',
  trash: 'Corbeille',
  linkedAccounts: 'Comptes liés & délégations',
  auditLogs: 'Logs d\'audit',
  adminPanel: 'Panel administrateur',

  // RGPD
  rgpd: 'Protection des données (RGPD)',
  exportData: 'Exporter mes données',

  // Danger zone
  dangerZone: 'Zone dangereuse',
  deleteAccount: 'Supprimer mon compte',

  // Logout
  logout: 'Se déconnecter',
  logoutConfirmTitle: 'Déconnexion',
  logoutConfirmMsg: 'Voulez-vous vous déconnecter ?',
  cancel: 'Annuler',

  // Alerts
  notifBlocked: 'Notifications bloquées',
  notifBlockedMsg: 'Les notifications ont été refusées. Ouvrez les réglages pour les activer.',
  openSettings: 'Ouvrir les réglages',
  deleteAccountTitle: 'Supprimer mon compte',
  deleteAccountMsg: 'Votre compte sera désactivé, anonymisé et vos fichiers personnels supprimés. Cette action est irréversible.',
  delete: 'Supprimer',
  disconnectAllTitle: 'Se déconnecter de tous les appareils',
  disconnectAllMsg: 'Vous serez déconnecté de tous vos appareils actifs.',
  disconnection: 'Déconnexion',

  // Toasts
  avatarUpdated: 'Avatar mis à jour',
  profileUpdated: 'Profil mis à jour',
  passwordChanged: 'Mot de passe modifié',
  pushEnabled: 'Notifications activées',
  pushDisabled: 'Notifications désactivées',
  sessionDisconnected: 'Session déconnectée',
  permissionDenied: 'Permission refusée pour la galerie',
  errorGeneric: 'Erreur',
  errorUpload: 'Erreur lors de l\'envoi',
  errorExport: 'Erreur lors de l\'export',
  errorProfile: 'Erreur lors de la mise à jour',
  errorPassword: 'Veuillez remplir tous les champs',
  errorPasswordMatch: 'Les mots de passe ne correspondent pas',
  errorPasswordLength: 'Le mot de passe doit contenir au moins 12 caractères',
  errorSessions: 'Erreur lors du chargement des sessions',
};

const en: typeof fr = {
  profile: 'Profile',

  personalInfo: 'Personal information',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  language: 'Language',
  saveChanges: 'Save changes',

  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',

  storage: 'Storage',
  storageUsed: 'Used',
  storageTotal: 'Total',
  storagePercent: (pct: number) => `${pct}% used`,
  plans: 'Plans & subscriptions',

  security: 'Security',
  mfa: 'Two-factor authentication (MFA)',
  mfaActive: 'Active',
  mfaInactive: 'Inactive',
  vault: 'Encrypted vault',
  changePassword: 'Change password',
  currentPassword: 'Current password',
  newPassword: 'New password',
  confirmPassword: 'Confirm new password',
  modifyPassword: 'Update password',
  activeSessions: 'Active sessions',
  sessionsDesc: 'Devices connected to your account. Disconnect unknown devices.',
  noActiveSessions: 'No active sessions',
  disconnectDevice: 'Disconnect this device',
  disconnectAll: 'Sign out of all devices',
  unknownDevice: 'Unknown device',

  shortcuts: 'Shortcuts',
  pushNotifications: 'Push notifications',
  pushNotifDesc: 'Receive alerts on this device',
  pushNotifUnsupported: 'Available on native app only',
  notificationCenter: 'Notification centre',
  trash: 'Trash',
  linkedAccounts: 'Linked accounts & delegations',
  auditLogs: 'Audit logs',
  adminPanel: 'Admin panel',

  rgpd: 'Data protection (GDPR)',
  exportData: 'Export my data',

  dangerZone: 'Danger zone',
  deleteAccount: 'Delete my account',

  logout: 'Sign out',
  logoutConfirmTitle: 'Sign out',
  logoutConfirmMsg: 'Do you want to sign out?',
  cancel: 'Cancel',

  notifBlocked: 'Notifications blocked',
  notifBlockedMsg: 'Notifications were denied. Open settings to enable them.',
  openSettings: 'Open settings',
  deleteAccountTitle: 'Delete my account',
  deleteAccountMsg: 'Your account will be deactivated, anonymised and your personal files deleted. This action is irreversible.',
  delete: 'Delete',
  disconnectAllTitle: 'Sign out of all devices',
  disconnectAllMsg: 'You will be signed out of all your active devices.',
  disconnection: 'Sign out',

  avatarUpdated: 'Avatar updated',
  profileUpdated: 'Profile updated',
  passwordChanged: 'Password changed',
  pushEnabled: 'Notifications enabled',
  pushDisabled: 'Notifications disabled',
  sessionDisconnected: 'Session disconnected',
  permissionDenied: 'Gallery permission denied',
  errorGeneric: 'Error',
  errorUpload: 'Upload error',
  errorExport: 'Export error',
  errorProfile: 'Update error',
  errorPassword: 'Please fill in all fields',
  errorPasswordMatch: 'Passwords do not match',
  errorPasswordLength: 'Password must be at least 12 characters',
  errorSessions: 'Failed to load sessions',
};

export const translations: Record<Lang, typeof fr> = { fr, en };
