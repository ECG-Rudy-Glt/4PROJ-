# Plan d'implémentation MFA (Multi-Factor Authentication)

## Vue d'ensemble
Système MFA obligatoire avec TOTP (Time-based One-Time Password), codes de récupération, et gestion des appareils de confiance.

---

## 1. BACKEND - Base de données

### 1.1 Schéma Prisma à modifier

**Ajouts au modèle `User` :**
```prisma
model User {
  // ... champs existants

  // MFA fields
  mfaEnabled        Boolean   @default(false)
  mfaSecret         String?   // Secret TOTP encrypté
  mfaBackupCodes    String[]  // Array de codes hashés
  mfaSetupAt        DateTime? // Date de configuration MFA

  // Relations
  trustedDevices    TrustedDevice[]
}
```

**Nouveau modèle `TrustedDevice` :**
```prisma
model TrustedDevice {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  deviceFingerprint String  // Hash unique de l'appareil (user-agent + autre infos)
  deviceName        String  // Ex: "Chrome on Windows"
  ipAddress         String

  createdAt       DateTime @default(now())
  expiresAt       DateTime // 30 jours après création
  lastUsedAt      DateTime @default(now())

  @@index([userId])
  @@index([deviceFingerprint])
}
```

### Migration :
```bash
npx prisma migrate dev --name add_mfa_system
```

---

## 2. BACKEND - Dépendances

### Installation :
```bash
cd backend
npm install speakeasy qrcode
```

**Librairies :**
- `speakeasy` : Génération et vérification TOTP
- `qrcode` : Génération de QR codes
- `crypto` (natif Node.js) : Génération codes de récupération

---

## 3. BACKEND - Services

### 3.1 Service MFA (`backend/src/services/mfaService.ts`)

**Fonctionnalités :**
```typescript
// Génération du secret TOTP + QR code
generateMFASecret(userId: string, email: string): {
  secret: string,
  qrCodeDataUrl: string,
  backupCodes: string[]
}

// Vérification du code TOTP
verifyTOTPCode(secret: string, token: string): boolean

// Vérification code de récupération
verifyBackupCode(userId: string, code: string): boolean

// Génération de nouveaux codes de récupération
regenerateBackupCodes(userId: string): string[]

// Activation MFA après vérification
enableMFA(userId: string, secret: string, backupCodes: string[]): void

// Désactivation MFA
disableMFA(userId: string): void
```

**Détails techniques :**
- Secret TOTP : 32 caractères base32
- Backup codes : 10 codes de 8 caractères alphanumériques
- Hash des backup codes : `bcrypt` avant stockage
- QR code : Format `otpauth://totp/AppName:email?secret=XXX&issuer=AppName`

### 3.2 Service Trusted Devices (`backend/src/services/trustedDeviceService.ts`)

**Fonctionnalités :**
```typescript
// Création d'un appareil de confiance
createTrustedDevice(userId: string, req: Request): TrustedDevice

// Vérification si appareil est de confiance
isTrustedDevice(userId: string, deviceFingerprint: string): boolean

// Récupération des appareils de l'utilisateur
getUserTrustedDevices(userId: string): TrustedDevice[]

// Révocation d'un appareil
revokeTrustedDevice(userId: string, deviceId: string): void

// Nettoyage des appareils expirés
cleanupExpiredDevices(): void
```

**Device Fingerprint :**
```typescript
// Généré avec : hash(user-agent + IP + accept-language)
import crypto from 'crypto';

function generateDeviceFingerprint(req: Request): string {
  const data = `${req.headers['user-agent']}-${req.ip}-${req.headers['accept-language']}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

---

## 4. BACKEND - Contrôleurs et Routes

### 4.1 MFA Controller (`backend/src/controllers/mfaController.ts`)

**Endpoints :**

```typescript
// POST /api/mfa/setup
// Génère le secret et le QR code
setupMFA(req, res)

// POST /api/mfa/verify-setup
// Vérifie le code initial et active le MFA
verifySetup(req, res)
Body: { token: string, rememberDevice: boolean }

// POST /api/mfa/verify
// Vérifie le code TOTP lors de la connexion
verifyMFA(req, res)
Body: { userId: string, token: string, rememberDevice: boolean }

// POST /api/mfa/verify-backup-code
// Vérifie un code de récupération
verifyBackupCode(req, res)
Body: { userId: string, backupCode: string }

// POST /api/mfa/regenerate-codes
// Régénère les codes de récupération (nécessite vérification MFA)
regenerateBackupCodes(req, res)

// GET /api/mfa/trusted-devices
// Liste des appareils de confiance
getTrustedDevices(req, res)

// DELETE /api/mfa/trusted-devices/:deviceId
// Révoque un appareil
revokeTrustedDevice(req, res)

// POST /api/mfa/disable
// Désactive le MFA (nécessite code TOTP)
disableMFA(req, res)
Body: { token: string }
```

### 4.2 Modification du Auth Controller

**Login flow modifié :**
```typescript
// POST /api/auth/login
async login(req, res) {
  // 1. Vérifier email + password
  const user = await verifyCredentials(email, password);

  // 2. Si MFA activé
  if (user.mfaEnabled) {
    // 2a. Vérifier si appareil de confiance
    const deviceFingerprint = generateDeviceFingerprint(req);
    const isTrusted = await isTrustedDevice(user.id, deviceFingerprint);

    if (isTrusted) {
      // Connexion directe
      const token = generateToken(user);
      return res.json({ token, user, mfaRequired: false });
    } else {
      // MFA requis
      const tempToken = generateTempToken(user.id); // Valide 5 minutes
      return res.json({
        mfaRequired: true,
        tempToken,
        userId: user.id
      });
    }
  }

  // 3. Si MFA désactivé → rediriger vers setup obligatoire
  if (!user.mfaEnabled) {
    const tempToken = generateTempToken(user.id);
    return res.json({
      mfaSetupRequired: true,
      tempToken,
      userId: user.id
    });
  }
}
```

---

## 5. FRONTEND - Composants

### 5.1 MFASetupModal (`frontend/src/components/MFASetupModal.tsx`)

**Affichage :**
- Titre : "Configuration de l'authentification à deux facteurs"
- QR Code (généré par le backend)
- Code secret textuel (si scan impossible)
- Input pour le code de vérification (6 chiffres)
- Instructions claires

**État :**
```typescript
const [qrCode, setQrCode] = useState('');
const [secret, setSecret] = useState('');
const [verificationCode, setVerificationCode] = useState('');
const [loading, setLoading] = useState(false);
```

**Flow :**
1. Chargement automatique du QR code à l'ouverture
2. Utilisateur scanne le QR avec son app
3. Utilisateur entre le code à 6 chiffres
4. Vérification → Si OK : afficher BackupCodesModal

### 5.2 BackupCodesModal (`frontend/src/components/BackupCodesModal.tsx`)

**Affichage :**
- Titre : "Codes de récupération - Conservez-les en lieu sûr"
- Warning : "Ces codes ne seront affichés qu'une seule fois !"
- Liste des 10 codes (monospace font)
- Bouton "Télécharger les codes" (fichier .txt)
- Bouton "Copier dans le presse-papiers"
- Checkbox "J'ai sauvegardé mes codes"
- Bouton "Continuer" (désactivé tant que checkbox non cochée)

**Fonctionnalités :**
```typescript
// Téléchargement
const downloadCodes = () => {
  const content = backupCodes.join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'backup-codes.txt';
  a.click();
};

// Copie
const copyCodes = () => {
  navigator.clipboard.writeText(backupCodes.join('\n'));
  toast.success('Codes copiés !');
};
```

### 5.3 MFAVerificationPage (`frontend/src/pages/MFAVerificationPage.tsx`)

**Affichage :**
- Titre : "Vérification en deux étapes"
- Input pour le code à 6 chiffres (autofocus)
- Checkbox "Se souvenir de cet appareil pendant 30 jours"
- Bouton "Vérifier"
- Lien "Utiliser un code de récupération" (toggle vers input backup code)
- Bouton retour "Me déconnecter"

**État :**
```typescript
const [code, setCode] = useState('');
const [useBackupCode, setUseBackupCode] = useState(false);
const [rememberDevice, setRememberDevice] = useState(true);
const [loading, setLoading] = useState(false);
```

**Flow :**
1. Utilisateur entre le code
2. Vérification avec tempToken
3. Si OK : création appareil de confiance (si checkbox cochée) + redirection vers /files
4. Si erreur : message d'erreur + retry

### 5.4 MFA Settings Section (`frontend/src/pages/SettingsPage.tsx`)

**Nouvelle section "Sécurité" :**

**Contenu :**
```typescript
// Statut MFA
<div>
  <h3>Authentification à deux facteurs</h3>
  <p>Statut : {mfaEnabled ? 'Activée' : 'Désactivée'}</p>
  {mfaEnabled && <p>Configurée le : {formatDate(mfaSetupAt)}</p>}

  {mfaEnabled && (
    <>
      <button onClick={regenerateCodes}>
        Régénérer les codes de récupération
      </button>
      <button onClick={disableMFA} className="danger">
        Désactiver le MFA
      </button>
    </>
  )}
</div>

// Appareils de confiance
<div>
  <h3>Appareils de confiance</h3>
  <p>Ces appareils ne nécessitent pas de code lors de la connexion</p>

  {trustedDevices.map(device => (
    <div key={device.id}>
      <p>{device.deviceName}</p>
      <p>Dernière utilisation : {formatDate(device.lastUsedAt)}</p>
      <p>Expire le : {formatDate(device.expiresAt)}</p>
      <button onClick={() => revokeDevice(device.id)}>
        Révoquer
      </button>
    </div>
  ))}
</div>
```

---

## 6. FRONTEND - Services

### 6.1 MFA Service (`frontend/src/services/mfaService.ts`)

```typescript
export const mfaService = {
  // Setup initial
  async setupMFA(): Promise<{ qrCode: string, secret: string }> {
    const response = await api.post('/mfa/setup');
    return response.data;
  },

  // Vérification setup
  async verifySetup(token: string, rememberDevice: boolean): Promise<{
    backupCodes: string[],
    token: string
  }> {
    const response = await api.post('/mfa/verify-setup', {
      token,
      rememberDevice
    });
    return response.data;
  },

  // Vérification login
  async verifyMFA(
    userId: string,
    token: string,
    tempToken: string,
    rememberDevice: boolean
  ): Promise<{ token: string, user: User }> {
    const response = await api.post('/mfa/verify',
      { userId, token, rememberDevice },
      { headers: { 'Authorization': `Bearer ${tempToken}` } }
    );
    return response.data;
  },

  // Vérification backup code
  async verifyBackupCode(
    userId: string,
    backupCode: string,
    tempToken: string
  ): Promise<{ token: string, user: User }> {
    const response = await api.post('/mfa/verify-backup-code',
      { userId, backupCode },
      { headers: { 'Authorization': `Bearer ${tempToken}` } }
    );
    return response.data;
  },

  // Régénération codes
  async regenerateBackupCodes(): Promise<{ backupCodes: string[] }> {
    const response = await api.post('/mfa/regenerate-codes');
    return response.data;
  },

  // Liste appareils
  async getTrustedDevices(): Promise<TrustedDevice[]> {
    const response = await api.get('/mfa/trusted-devices');
    return response.data;
  },

  // Révocation appareil
  async revokeTrustedDevice(deviceId: string): Promise<void> {
    await api.delete(`/mfa/trusted-devices/${deviceId}`);
  },

  // Désactivation MFA
  async disableMFA(token: string): Promise<void> {
    await api.post('/mfa/disable', { token });
  }
};
```

---

## 7. FRONTEND - Flux de navigation

### 7.1 Login Flow

```typescript
// LoginPage.tsx
const handleLogin = async (email: string, password: string) => {
  const response = await authService.login(email, password);

  // Cas 1 : MFA setup requis (première connexion)
  if (response.mfaSetupRequired) {
    localStorage.setItem('tempToken', response.tempToken);
    setShowMFASetupModal(true);
    return;
  }

  // Cas 2 : MFA requis (appareil non trusté)
  if (response.mfaRequired) {
    localStorage.setItem('tempToken', response.tempToken);
    navigate('/mfa-verify', { state: { userId: response.userId } });
    return;
  }

  // Cas 3 : Connexion directe (appareil trusté)
  localStorage.setItem('token', response.token);
  navigate('/files');
};
```

### 7.2 MFA Setup Flow (Modal)

```typescript
// Étape 1 : Affichage QR code
<MFASetupModal onComplete={(backupCodes) => {
  setBackupCodes(backupCodes);
  setShowBackupCodesModal(true);
}} />

// Étape 2 : Affichage backup codes
<BackupCodesModal
  codes={backupCodes}
  onComplete={() => {
    // Connexion finalisée
    navigate('/files');
  }}
/>
```

---

## 8. Sécurité

### 8.1 Côté Backend

**Protection des secrets :**
- `mfaSecret` stocké encrypté avec `crypto.createCipheriv()`
- `backupCodes` hashés avec `bcrypt` avant stockage
- Codes de récupération à usage unique (supprimés après utilisation)

**Rate limiting :**
- Max 5 tentatives MFA par minute par utilisateur
- Max 3 tentatives backup code par heure

**Tokens temporaires :**
- `tempToken` valide 5 minutes seulement
- Utilisé uniquement pour endpoints MFA
- Invalidé après vérification réussie

### 8.2 Côté Frontend

**Validation input :**
- Code TOTP : exactement 6 chiffres
- Code backup : format alphanumérique 8 caractères

**Gestion erreurs :**
- Messages clairs (code invalide, expiré, etc.)
- Pas d'indication si c'est un code TOTP ou backup invalide (sécurité)

---

## 9. Ordre d'implémentation

1. ✅ **Backend DB** : Mise à jour Prisma schema + migration
2. ✅ **Backend Services** : mfaService.ts + trustedDeviceService.ts
3. ✅ **Backend Controllers** : mfaController.ts + modification authController.ts
4. ✅ **Backend Routes** : Ajout routes MFA
5. ✅ **Frontend Services** : mfaService.ts
6. ✅ **Frontend Composants** : MFASetupModal → BackupCodesModal → MFAVerificationPage
7. ✅ **Frontend Settings** : Section MFA dans SettingsPage
8. ✅ **Frontend Flow** : Intégration dans LoginPage + routing
9. ✅ **Tests** : Test complet du flux

---

## 10. Tests à effectuer

### Test Flow complet :
1. ✅ Connexion utilisateur → Modal MFA Setup apparaît
2. ✅ Scan QR code avec Google Authenticator
3. ✅ Entrer code de vérification → Backup codes affichés
4. ✅ Télécharger/copier les codes → Confirmer sauvegarde
5. ✅ Déconnexion → Reconnexion
6. ✅ Vérifier MFA demandé → Entrer code → Connexion OK
7. ✅ Cocher "Remember device" → Déconnexion → Reconnexion → Pas de MFA
8. ✅ Tester depuis autre navigateur → MFA demandé
9. ✅ Tester code de récupération → OK + code invalidé
10. ✅ Régénérer codes depuis Settings → OK
11. ✅ Révoquer appareil de confiance → MFA demandé à prochaine connexion
12. ✅ Désactiver MFA → Réactiver → Nouveau setup requis

---

## 11. Points d'attention

⚠️ **Migration utilisateurs existants :**
- À la première connexion après déploiement, tous les users devront configurer MFA
- Prévoir un message explicatif

⚠️ **Backup codes :**
- Affichés UNE SEULE FOIS à la configuration
- Possibilité de régénérer (invalide les anciens)

⚠️ **Cleanup automatique :**
- Cron job pour supprimer trusted devices expirés (daily)

⚠️ **UX :**
- Auto-focus sur input code
- Auto-submit si 6 chiffres entrés
- Messages d'erreur clairs

---

**Prêt à démarrer l'implémentation ! 🚀**
