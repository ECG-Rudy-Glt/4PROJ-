# SUPFile - Frontend & UI/UX

---

## Architecture générale

- **React 18 + TypeScript strict** - composants fonctionnels, hooks uniquement, zéro `any`
- **Vite 6** comme bundler : démarrage < 300ms, HMR instantané, build optimisé (tree-shaking)
- **React Router v6** avec layout nesting : routes publiques / protégées / admin dans une seule arborescence
- **TailwindCSS 3.4** utility-first - design system cohérent sans CSS custom, dark mode via stratégie `class`
- Architecture 4 couches : pages  composants  services  stores

---

## State management - Zustand

6 stores ciblés, zéro boilerplate (pas de Redux, pas de Context hell) :

- **`useAuthStore`** - session utilisateur, token JWT, contexte de délégation (DIRECT / SWITCH / DELEGATION), détection `mfaRequired`
- **`useFileStore`** - liste fichiers/dossiers, dossier courant, tri (`sortBy` / `sortOrder`), chargement parallèle via `Promise.all`
- **`useUploadStore`** - file d'attente upload, progression par fichier, batch de 3 uploads simultanés, `AbortController` par fichier pour annulation
- **`useNotificationStore`** - notifications temps réel, compteur non-lus, pagination 50 items
- **`useTagStore`** - tags utilisateur avec flag `isLoaded` (chargement unique, pas de refetch inutile)
- **`useVaultStore`** - statut vault (verrouillé/déverrouillé), auto-lock sur navigation hors du vault

---

## Routing & protection des routes

```
/login, /register, /mfa-verify, /auth/callback    public
/share/:token                                      public (lien partagé sans compte)
<ProtectedRoute>                                   vérifie isAuthenticated (Zustand)
  <Layout>                                         Sidebar + Header + AIChatbot + UploadModal
    /dashboard, /files/:folderId, /favorites
    /shared, /trash, /settings, /plans
    /organization-admin, /audit
    <AdminRoute>    /admin (super-admin uniquement)
```

- **ProtectedRoute** : redirige vers `/login` si non authentifié, monte `SocketListener` pour le temps réel
- **AdminRoute** : vérifie `user.role === 'ADMIN'` en plus du token
- **Layout global** : overlay drag & drop, chatbot flottant, modal d'upload toujours disponibles

---

## Internationalisation - i18next

- Détection automatique de la langue navigateur (`i18next-browser-languagedetector`)
- Deux locales complètes : **FR** (fallback) + **EN**
- Clés namespaces : `common.*`, `files.*`, `socket.*`, `chatbot.*`, `notifications.*`, `time.*`
- Variables dans les traductions : `t('socket.comment_added_body', { firstName: data.user?.firstName })`
- Changement de langue instantané sans rechargement - persisté en backend via `updateProfile()`

---

## Système de thème - Dark mode

- Tailwind stratégie `class` : bascule en ajoutant/supprimant `dark` sur `<html>`
- **CSS variables** dans `:root` et `.dark` (index.css) - chaque couleur a sa variante

| Token | Clair | Sombre |
|---|---|---|
| Fond principal | `#FFFFFF` | `#1a1a1a` |
| Primary (navigation) | `#254441` (vert forêt) | `#5A9A94` (vert sauge) |
| Accent warm | `#D4785C` (terracotta) | `#E8A088` |
| Accent bright | `#E8B84A` (moutarde) | `#F0C96B` |
| Fond cards | `#F5F3EF` (blanc cassé) | `#2D2D2D` (anthracite) |

- Préférence persistée en BDD (pas de localStorage raw)  survit à la déconnexion / changement d'appareil

---

## Upload - UX et gestion de progression

### Drag & drop global (Layout.tsx)
- Overlay plein écran activé dès qu'un fichier entre dans la fenêtre (`dragenter` + compteur)
- Compteur de drag (`dragCounter ref`) évite les faux positifs sur les éléments enfants
- `extractDroppedFiles()` : supporte le dépôt de **dossiers entiers** (`webkitRelativePath`)

### File d'upload (useUploadStore)
- **Vérification quota avant enqueue** : fichier refusé si `quotaUsé + taille > quotaLimit` (côté client ET côté serveur)
- **3 uploads simultanés** (CONCURRENT = 3) - pas de flood réseau, pas d'attente séquentielle
- **AbortController** par fichier : bouton "Annuler" par fichier ou "Tout annuler"
- Progression transmise par callback axios (`onUploadProgress`)  mise à jour store en temps réel

### UploadModal
- Barre de progression par fichier (gradient `primary-500  primary-600`)
- Progression globale = moyenne pondérée des fichiers en cours
- Icône statut : spinner (en cours),  vert (terminé),  rouge (erreur)
- Rechargement automatique du dossier courant à la fin du batch

---

## Drag & drop - déplacement de fichiers

- Attribut custom `dataTransfer` : `'application/supfile-item'` avec `{ id, type: 'file'|'folder' }`
- `effectAllowed: 'move'`  curseur OS en mode déplacement
- Cible de drop : highlight visuel (bordure + fond) sur le dossier survolé
- Validation : impossible de déposer un dossier dans lui-même
- Toast de confirmation après déplacement réussi

---

## Temps réel - Socket.IO Client

- Connexion authentifiée : `io(url, { auth: { token }, transports: ['websocket', 'polling'] })`
- Fallback automatique WebSocket  long-polling si réseau restrictif

| Événement reçu | Déclencheur UI |
|---|---|
| `comment_added` | Toast avec avatar + nom du commentateur |
| `share_received` | Toast vert + rafraîchissement des partages |
| `share_accepted` | Toast de confirmation |
| `file_uploaded` | `refreshProfile()`  mise à jour quota affiché |
| `file_deleted` | `refreshProfile()`  mise à jour quota |
| `notification_new` | Ajout au centre de notifications (badge +1) |

---

## Prévisualisation de fichiers (FilePreviewModal)

| Format | Rendu |
|---|---|
| **Images** (JPG, PNG, GIF, WebP…) | Blob  ObjectURL (libéré à la fermeture) |
| **Vidéo** (MP4, AVI, MKV…) | `<video>` natif, `preload="metadata"`, streaming |
| **Audio** (MP3, WAV, FLAC…) | `<audio>` natif avec player |
| **Markdown** | `react-markdown` + `remark-breaks` + coloration syntaxique |
| **CSV** | Table HTML avec rendu cellule riche |
| **Texte / Code** | `react-syntax-highlighter` avec thème dark/light |
| **DOCX / XLSX / PPTX** | OnlyOffice intégré (édition live dans le navigateur) |
| **Scripts dangereux** (.exe, .bat, .sh…) | Warning `AlertTriangle` avant tout accès |

- Fetch authentifié (`Authorization: Bearer`) pour les fichiers privés
- Streaming : jamais de chargement complet en mémoire pour vidéo/audio

---

## Assistant IA - Bobby (AIChatbot.tsx)

- Bouton flottant (w-20 h-20), scale animé à l'ouverture
- **4 avatars idle + GIF "working"** - sélection aléatoire au chargement, switch sur `isTyping`
- Historique de conversation transmis à chaque requête (`role: user / model`)
- Rendu des réponses en **Markdown** (listes, code, titres)
- `Shift+Enter` pour saut de ligne, `Enter` pour envoyer
- Auto-scroll vers le bas sur chaque nouveau message
- Gestion d'erreur : quota dépassé (429)  toast dédié, erreur réseau  message d'erreur inline

---

## Dashboard (Recharts)

- **PieChart donut** : répartition de l'espace disque par type MIME (images, vidéos, PDF, docs, autres)
- Tooltip avec fond sombre personnalisé, couleurs distinctes par catégorie
- **4 cartes statistiques** : total fichiers, stockage utilisé (% du quota), taille totale, nombre de types
- **Fichiers récents** : 5 derniers fichiers modifiés, cliquables (ouvre la prévisualisation)
- **ActivityLog** : timeline des actions de l'utilisateur
- Dates localisées via `date-fns` (fr/en selon langue active)

---

## UX patterns & qualité interface

- **Toasts** (`react-hot-toast`) : top-right, fond gradient, blur backdrop, durée 2s/3s
- **Breadcrumb** : icône Home cliquable + séparateurs ChevronRight + dernier élément en gras
- **Shimmer** : animation CSS background-position pour les états de chargement
- **Focus ring** sur tous les inputs (accessibilité clavier)
- **Modals** : portal fixed inset-0, z-50, fermeture ESC + clic extérieur
- **Responsive** : layout sidebar collapsible, grille adaptative (desktop  tablette)
- Toutes les actions destructives ont une **confirmation** (suppression, vidage corbeille)

---

## Choix technologiques justifiés (Web)

| Choix | Alternative écartée | Raison |
|---|---|---|
| Zustand | Redux, Context API | 80% moins de boilerplate, pas de Provider hell, DevTools intégrés |
| Vite | CRA, Webpack | 10 plus rapide en dev, ESM natif, build optimisé out-of-the-box |
| TailwindCSS | CSS Modules, styled-components | Cohérence design, pas de CSS mort, dark mode via `class` trivial |
| react-hot-toast | react-toastify | API minimaliste, animations CSS custom, plus léger (3kb) |
| Recharts | Chart.js, D3 | Composants React natifs, responsive, customisable sans DOM direct |
| react-markdown | dangerouslySetInnerHTML | Sanitisation XSS automatique, support plugins remark |
| i18next | react-intl, Lingui | Détection langue auto, namespaces, interpolation variables, ecosystem large |
| Socket.IO Client | WebSocket brut, SSE | Reconnexion auto, fallback polling, rooms et events nommés |

---

# Mobile - React Native / Expo

---

## Stack technique

| Techno | Version | Rôle |
|---|---|---|
| **React Native** | 0.81.5 | Framework mobile iOS & Android |
| **Expo SDK** | 54 | Toolchain, build, accès APIs natives |
| **TypeScript** | 5.9.2 | Typage strict, mêmes interfaces que le backend |
| **Zustand** | 5.0.12 | State management (même pattern que le web) |
| **Axios** | 1.13.6 | Client HTTP avec intercepteurs JWT |
| **React Navigation** | v6 | Navigation Native Stack + Bottom Tabs |
| **Socket.IO Client** | 4.8.3 | Temps réel (notifications, partages) |
| **expo-secure-store** | - | Stockage chiffré des tokens (iOS Keychain / Android Keystore) |
| **expo-document-picker** | - | Sélection de fichiers depuis le système |
| **expo-image-picker** | - | Accès galerie photo / caméra |
| **expo-file-system** | - | Opérations fichiers locaux |
| **expo-video** | 3.0.16 | Lecture vidéo native |
| **react-native-webview** | 13.15.0 | Prévisualisation PDF et documents Office |
| **react-native-toast-message** | - | Notifications toast natives |

**Pas de bibliothèque UI externe** (pas de NativeWind, pas de React Native Paper) - design system custom complet.

---

## Architecture mobile

```
App.tsx
  SafeAreaProvider  NavigationContainer
     RootNavigator        (branchement auth / main)
         Auth Stack      (Login, Register, MfaVerify)
         Main Stack
              TabNavigator  (5 onglets bottom)
              TrashScreen   (plein écran)
              AdminScreen   (plein écran)
     SocketListener       (temps réel - monté si authentifié)
     Toast                (global)
```

**5 onglets bottom tabs :**

| Onglet | Écran | Icône |
|---|---|---|
| Accueil | DashboardScreen | home |
| Fichiers | FilesScreen | folder |
| Favoris | FavoritesScreen | star |
| Partages | SharedScreen | people |
| Profil | SettingsScreen | settings |

---

## Fonctionnalités implémentées

- **Authentification** : login email/password, register, MFA setup (QR code + deep-link Authenticator) + vérification
- **Explorateur de fichiers** : navigation dossiers avec breadcrumbs, liste fichiers/dossiers, recherche globale
- **Upload** : sélection via document picker OU galerie photo/vidéo, barre de progression animée par fichier (XMLHttpRequest natif), annulation, vérification quota
- **Actions fichiers** : appui long  menu contextuel (renommer, déplacer, supprimer, partager, favoris)
- **Prévisualisation** : images, vidéo (expo-video), audio, PDF (WebView), documents Office (WebView)
- **Partage** : onglets "En attente / Avec moi / Par moi", acceptation/refus d'invitations, permissions affichées (lecture/écriture/suppression/partage)
- **Dashboard** : quota coloré (vert < 70% / orange < 90% / rouge), stats (total fichiers, taille, types), fichiers récents
- **Notifications** : centre de notifications avec badges, temps réel via Socket.IO
- **Corbeille** : restauration ou suppression définitive
- **Paramètres** : modification profil, upload avatar, changement de mot de passe, export RGPD
- **MFA** : activation/désactivation depuis les paramètres
- **Délégation** : account switching (AccountSwitcherModal)
- **Admin** : écran dédié pour les utilisateurs admin
- **Tags, Commentaires, Versions** : panneaux dédiés sur les fichiers

---

## Spécificités mobile vs web

| Aspect | Web | Mobile |
|---|---|---|
| Upload | Drag & drop + sélecteur fichier | Document picker + galerie photo/vidéo |
| Navigation | React Router (URL) | React Navigation (stack + tabs) |
| Stockage token | localStorage | expo-secure-store (chiffré OS) |
| Progression upload | Axios `onUploadProgress` | XMLHttpRequest natif (plus compatible RN) |
| Déplacement fichiers | Drag & drop HTML5 | Appui long  menu contextuel |
| Thème dark | Tailwind CSS class toggle | Tokens définis, bascule non encore câblée |
| Éditeur Office | OnlyOffice intégré | Prévisualisation WebView uniquement |
| i18n | i18next complet (FR/EN) | Non implémenté (français uniquement) |

---

## Design system mobile

Palette identique au web (`#254441` primary, `#D4785C` accent warm, `#E8B84A` accent bright) déclinée en tokens React Native :

```
src/theme/
 colors.ts      - palette complète (primary, accent, semantic, neutral)
 typography.ts  - h1-h4, body, caption, label, button
 spacing.ts     - grille xs / sm / md / lg / xl / 2xl / 3xl / 4xl
 shadows.ts     - sm / md / lg / xl / 2xl
 index.ts       - export global
```

Styles via `StyleSheet.create()` par composant - performances optimisées (pas de recalcul CSS).

---

## Choix technologiques justifiés (Mobile)

| Choix | Alternative écartée | Raison |
|---|---|---|
| Expo SDK | React Native CLI | Toolchain unifiée, accès APIs natives sans éjection, Expo Go pour le dev |
| expo-secure-store | AsyncStorage | Chiffrement OS natif (Keychain/Keystore) - tokens sensibles |
| XMLHttpRequest (upload) | Axios | RN : `onUploadProgress` d'Axios peu fiable, XHR donne la progression réelle |
| React Navigation | Expo Router | Contrôle fin sur les transitions, guards auth manuels, stack + tabs combinés |
| Design system custom | React Native Paper, NativeWind | Palette identique au web sans dépendance tierce, performances StyleSheet |
| expo-video | react-native-video | Intégration Expo native, API moderne, support HLS |
