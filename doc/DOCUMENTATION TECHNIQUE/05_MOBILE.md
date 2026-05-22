# Mobile - Documentation Technique

Application mobile du projet **SUPFile**.
Basee sur **React Native 0.81 + Expo SDK 54 + TypeScript**.

---

## Stack technique

| Composant | Technologie |
|---|---|
| Framework | React Native 0.81 |
| Plateforme | Expo SDK 54 |
| Langage | TypeScript |
| Navigation | React Navigation v7 (native-stack + bottom-tabs) |
| State management | Zustand |
| Client HTTP | Axios |
| Stockage securise | expo-secure-store (Keychain iOS / Keystore Android) |
| Internationalisation | i18next + react-i18next |
| WebSockets | Socket.io-client |
| Notifications | expo-notifications |
| Media | expo-image, expo-video, expo-av |

---

## Structure des dossiers

```
mobile/src/
  components/          # Composants reutilisables
  screens/
    auth/              # Ecrans d'authentification
    main/              # Ecrans principaux (tabs)
  services/            # Clients HTTP (un par domaine)
  stores/              # Etat global Zustand
  hooks/               # Hooks personnalises
  navigation/          # Configuration React Navigation
  i18n/                # Traductions FR/EN
  constants/           # Constantes (plans, etc.)
  types/               # Types TypeScript
```

---

## Navigation

### Stack Auth (non connecte)

| Ecran | Fichier | Description |
|---|---|---|
| Login | `LoginScreen.tsx` | Connexion email/password + OAuth Google/GitHub |
| Register | `RegisterScreen.tsx` | Inscription |
| MfaVerify | `MfaVerifyScreen.tsx` | Saisie code TOTP |
| ForgotPassword | `ForgotPasswordScreen.tsx` | Mot de passe oublie |
| ResetPassword | `ResetPasswordScreen.tsx` | Reinitialisation mot de passe |

### Tab Navigator (connecte)

| Tab | Ecran | Description |
|---|---|---|
| Accueil | `DashboardScreen.tsx` | Quota, stats, fichiers recents |
| Fichiers | `FilesScreen.tsx` | Explorateur de fichiers |
| Favoris | `FavoritesScreen.tsx` | Fichiers favoris |
| Partages | `SharedScreen.tsx` | Partages recus/envoyes |
| Profil | `SettingsScreen.tsx` | Parametres utilisateur |

### Ecrans additionnels

| Ecran | Description |
|---|---|
| `TrashScreen` | Corbeille |
| `VaultScreen` | Coffre-fort securise |
| `AIScreen` | Assistant Bobby |
| `PlansScreen` | Abonnements (Stripe test) |
| `AdminScreen` | Administration |
| `AuditScreen` | Logs d'audit |

---

## Stores Zustand

| Store | Responsabilite |
|---|---|
| `useAuthStore` | Authentification, token JWT, user info |
| `useFileStore` | Cache fichiers/dossiers courants |
| `useDashboardStore` | Stats dashboard |
| `useNotificationStore` | Notifications in-app |
| `useThemeStore` | Theme clair/sombre |
| `useI18nStore` | Langue courante |

---

## Services

| Service | Endpoints |
|---|---|
| `api.ts` | Instance Axios, intercepteur JWT, gestion 401 |
| `authService` | Login, register, logout, profile |
| `fileService` | CRUD fichiers, download, stream |
| `folderService` | CRUD dossiers, breadcrumbs |
| `uploadService` | Upload avec progression |
| `shareService` | Partages internes et liens publics |
| `mfaService` | Setup MFA, verify, trusted devices |
| `vaultService` | Coffre-fort |
| `aiService` | Chat Bobby |
| `tagService` | Tags |
| `commentService` | Commentaires |
| `versionService` | Versions fichiers |
| `notificationService` | Notifications |
| `pushService` | Push notifications |
| `billingService` | Plans Stripe (mode test) |
| `adminService` | Admin |
| `auditService` | Logs audit |
| `accountAccessService` | Multi-compte, delegation |

---

## Composants principaux

| Composant | Role |
|---|---|
| `FileRow` | Ligne fichier avec actions |
| `FolderRow` | Ligne dossier avec actions |
| `ItemActionsSheet` | Bottom sheet actions (renommer, supprimer, partager...) |
| `FilePreviewModal` | Previsualisation images, PDF, video, audio |
| `ShareModal` | Modal de partage |
| `TagsPicker` | Selection de tags |
| `CommentsPanel` | Commentaires fichier |
| `VersionsPanel` | Historique versions |
| `UploadProgressBar` | Barre progression upload |
| `SearchBar` | Recherche fichiers |
| `PieChart` | Graphique repartition quota |
| `MfaSetupModal` | Configuration MFA |
| `OAuthButtons` | Boutons Google/GitHub |
| `SocketListener` | Ecoute WebSocket temps reel |
| `NotificationCenter` | Centre notifications |
| `PlansModal` | Modal plans/abonnements |

---

## Securite

| Aspect | Implementation |
|---|---|
| Token JWT | Stocke dans `expo-secure-store` (Keychain/Keystore) |
| MFA TOTP | Support complet avec backup codes |
| OAuth2 | Google et GitHub via `expo-web-browser` |
| Appareils confiance | Skip MFA 30 jours |

---

## Fonctionnalites

| Fonctionnalite | Statut |
|---|---|
| Upload fichiers avec progression | OK |
| Navigation dossiers + breadcrumbs | OK |
| Preview images, PDF, video, audio | OK |
| Partage interne et liens publics | OK |
| Tags et commentaires | OK |
| Favoris et corbeille | OK |
| Coffre-fort (Vault) | OK |
| Bobby IA | OK |
| Notifications push | OK |
| Theme clair/sombre | OK |
| i18n FR/EN | OK |
| MFA TOTP | OK |
| OAuth Google/GitHub | OK |
| Edition OnlyOffice | Lecture seule (WebView) |

---

## Variables d'environnement

```bash
# mobile/.env
API_URL=http://192.168.x.x:5001    # IP locale ou VPS
```

L'IP est detectee automatiquement par les scripts `make mobile` ou `start-mobile.ps1`.

---

## Lancement

```bash
# Depuis la racine du projet
make mobile              # Demarre Expo
make mobile-android      # Lance sur Android
make mobile-ios          # Lance sur iOS (macOS)
make mobile-web          # Lance dans le navigateur
make mobile-tunnel       # Mode tunnel (QR code externe)
```

Le site web React bloque les navigateurs mobiles. Pour tester sur telephone, lancer Expo puis scanner le QR code dans Expo Go ou entrer l'URL Expo generee.

---

## Tests

```bash
cd mobile
npm test                 # Jest avec coverage
```
