# SupFile Sync Windows

SupFile Sync Windows est le client desktop Windows de SupFile. Il fournit une experience proche de OneDrive : un dossier local choisi par l'utilisateur est synchronise automatiquement avec un dossier distant unique nomme `SupFile Sync`.

Le client est une application Electron + React/Vite, distribuee sous forme d'installeur Windows `.exe` via `electron-builder`. Il utilise exclusivement l'API SupFile existante : aucun acces direct a PostgreSQL, MinIO ou S3.

## Installation utilisateur

1. Lancer SupFile avec `scripts/START.sh`.
2. Ouvrir le web SupFile.
3. Aller dans les parametres du compte.
4. Cliquer sur `Telecharger le .exe` dans la section `SupFile Sync pour Windows`.
5. Installer `SupFile-Sync-Setup.exe`.
6. Ouvrir `SupFile Sync`.

## Premiere configuration

1. Renseigner l'URL du backend SupFile, par defaut `http://localhost:5001`.
2. Se connecter avec email et mot de passe.
3. Valider le MFA, ou terminer le setup MFA si le compte le demande.
4. Choisir un dossier local.

Le client cree ou recupere ensuite le dossier distant `SupFile Sync`, scanne le dossier local et le dossier distant, puis lance le merge initial.

## Fonctionnement de synchronisation

- Creation/modification locale -> upload vers SupFile.
- Creation/modification distante -> download dans le dossier local.
- Suppression locale -> mise a la corbeille SupFile distante.
- Suppression distante -> mise a la corbeille Windows locale si disponible.
- Si la corbeille Windows est indisponible, l'element est deplace dans `.supfile-sync/trash`.
- Conflit local + distant -> les deux versions sont conservees.
- La version distante garde le nom normal.
- La version locale est uploadee avec le suffixe `(conflit <device> <timestamp>)`.
- Le tray Windows permet d'ouvrir l'app, ouvrir le dossier local, ouvrir SupFile web, pause/reprise, forcer une sync et quitter.

Le moteur combine watcher filesystem, debounce, queue de jobs, scan de rattrapage et polling distant. La reprise offline repose sur le manifeste local et un nouveau scan lorsque l'API redevient disponible.

## Endpoints backend utilises

### `GET /api/sync/root`

- Authentification obligatoire.
- Cree ou retourne le dossier racine `SupFile Sync`.
- Operation idempotente.
- Le dossier appartient toujours a l'utilisateur courant.
- Si un ancien dossier `SupFile Sync` est en corbeille, il est restaure.

### `GET /api/sync/tree?rootFolderId=...`

- Authentification obligatoire.
- Verifie que le root appartient a l'utilisateur courant.
- Retourne recursivement les dossiers et fichiers non supprimes.
- Inclut `id`, `name`, `parentId`, `updatedAt`, `size`, `mimeType` et `checksum` quand disponible.
- Ne sort jamais du root `SupFile Sync`.

### `POST /api/sync/files/upload`

- Authentification obligatoire.
- Upload multipart via l'API SupFile.
- Parametres principaux : `rootFolderId`, `folderId`, `remoteFileId`, `baseRemoteUpdatedAt`, `checksum`.
- Cree un nouveau fichier si `remoteFileId` est absent.
- Remplace le contenu du fichier distant si `remoteFileId` est present.
- Retourne `409 SYNC_CONFLICT` si le fichier distant a change depuis `baseRemoteUpdatedAt`.
- Verifie quota, taille, DEK deverrouillee et checksum SHA-256 si fourni.

Le download distant -> local reutilise les endpoints fichiers existants avec `Authorization: Bearer`. Les tokens ne sont jamais passes dans les URLs.

## Securite

- Appels API en `Authorization: Bearer`.
- Aucun token, refresh token ou mot de passe dans les URLs.
- Refresh token stocke via `safeStorage` Electron.
- Si `safeStorage` n'est pas disponible, les secrets ne sont pas persistants.
- Le renderer Electron tourne avec `contextIsolation: true` et `nodeIntegration: false`.
- Le preload expose uniquement une API IPC minimale.
- CSP renderer activee.
- URL serveur validee : protocole `http` ou `https`, pas d'identifiants, pas de query string, pas de fragment.
- Le backend verifie le scope sync par ascendance `parentId`, pas par prefixe de path.
- `DEK_UNLOCK_REQUIRED` n'est pas contourne : si la cle n'est pas disponible, l'utilisateur doit se reconnecter/deverrouiller.
- Les logs desktop ne doivent pas contenir token, refresh token ou mot de passe.

## Stockage local

- Configuration non sensible : repertoire utilisateur Electron.
- Secrets : fichier chiffre via `safeStorage`.
- Manifeste sync : dossier interne `.supfile-sync` dans le dossier local choisi.
- Logs : repertoire utilisateur Electron, fichier `supfile-sync.log`.

## Exclusions locales

Les elements suivants ne sont pas synchronises :

- `.supfile-sync`
- `desktop.ini`
- fichiers commencant par `.supfile-`
- fichiers commencant par `~$`
- fichiers finissant par `.tmp`
- liens symboliques

Le client protege les operations locales contre les chemins hors du dossier choisi.

## Build local

Depuis `desktop/` :

```bash
npm install
npm run lint
npm run build
npm run dist:win
```

L'installeur local est genere dans `desktop/release/SupFile-Sync-Setup.exe`.

Le bouton web de telechargement sert par defaut `/downloads/SupFile-Sync-Setup.exe`. En local, l'installeur genere est recopie dans `frontend/public/downloads/` avant rebuild du frontend Docker.

## Limites v1

- Windows uniquement.
- Pas de Files On-Demand.
- Pas d'overlays Explorer.
- Pas de multi-compte.
- Pas d'auto-update.
- Exe non signe en local : la signature Windows est a prevoir dans une pipeline release.
- Detection de renommage/deplacement limitee : selon le cas, un rename peut etre traite comme suppression + creation.
- Pas de queue persistante detaillee : la reprise repose sur le manifeste local, le scan de rattrapage et le polling.

## Depannage

- Fenetre blanche : verifier que le build desktop utilise `base: './'` dans Vite, puis regenerer l'installeur.
- Login impossible : verifier l'URL backend, les logs backend et la configuration CORS.
- MFA bloque : se reconnecter et terminer le setup MFA cote SupFile.
- Quota depasse : liberer de l'espace ou augmenter le plan.
- Fichier verrouille : fermer l'application qui utilise le fichier, puis relancer une synchronisation.
- Antivirus : autoriser `SupFile Sync.exe` si le watcher ou l'ecriture locale sont bloques.
- Chemins trop longs Windows : raccourcir le chemin du dossier local ou des sous-dossiers.
- Icône Windows ancienne : desinstaller/reinstaller et attendre le refresh du cache d'icones Windows.

## Checklist manuelle

1. Installer le `.exe`.
2. Login + MFA.
3. Choisir un dossier local vide.
4. Creer un fichier local -> verifier dans le web.
5. Creer un dossier local -> verifier dans le web.
6. Creer un fichier web dans `SupFile Sync` -> verifier localement.
7. Modifier un fichier local -> verifier le remplacement web.
8. Modifier le fichier web -> verifier le remplacement local.
9. Supprimer localement -> verifier la corbeille SupFile.
10. Supprimer depuis le web -> verifier la corbeille Windows ou `.supfile-sync/trash`.
11. Mettre en pause -> modifier localement -> verifier qu'aucun upload ne part.
12. Reprendre -> verifier que la sync repart.
13. Couper l'API -> modifier localement -> relancer l'API -> verifier la reprise.
14. Creer un conflit local/distant -> verifier la copie `(conflit ...)`.
15. Verifier les logs : aucun token, refresh token ou mot de passe.
