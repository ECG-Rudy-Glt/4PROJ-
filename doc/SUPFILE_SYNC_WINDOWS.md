# SupFile Sync Windows

SupFile Sync Windows est le client desktop Windows de SupFile. Il synchronise un dossier local choisi par l'utilisateur avec un dossier distant unique nomme `SupFile Sync`.

## Installation

1. Lancer SupFile avec `scripts/START.sh`.
2. Ouvrir le web SupFile.
3. Aller dans les parametres.
4. Telecharger `SupFile Sync pour Windows`.
5. Installer `SupFile-Sync-Setup.exe`.

## Premiere configuration

1. Ouvrir SupFile Sync.
2. Renseigner l'URL du backend SupFile, par defaut `http://localhost:5001`.
3. Se connecter avec email et mot de passe.
4. Valider le MFA, ou terminer le setup MFA si le compte le demande.
5. Choisir un dossier local.

Le client cree ou recupere ensuite le dossier distant `SupFile Sync`, scanne le dossier local et le dossier distant, puis lance le merge initial.

## Comportement de synchronisation

- Upload automatique des creations et modifications locales.
- Download automatique des creations et modifications distantes.
- Suppression locale envoyee dans la corbeille SupFile.
- Suppression distante envoyee dans la corbeille Windows locale. Si la corbeille Windows est indisponible, l'element est deplace dans `.supfile-sync/trash`.
- Conflits conserves en deux versions : la version distante garde son nom, la version locale est renommee avec le suffixe `(conflit <device> <timestamp>)`.
- Le client fonctionne via l'API SupFile uniquement. Il n'accede jamais directement a PostgreSQL, MinIO ou S3.

## Exclusions locales

Les elements suivants ne sont pas synchronises :

- `.supfile-sync`
- `desktop.ini`
- fichiers commencant par `.supfile-`
- fichiers commencant par `~$`
- fichiers finissant par `.tmp`
- liens symboliques

## Securite

- Les appels API utilisent `Authorization: Bearer`.
- Les tokens ne sont pas places dans les URL.
- Le refresh token est stocke via `safeStorage` Electron.
- Si le stockage chiffre Electron n'est pas disponible, les secrets ne sont pas persistes.
- Le renderer Electron tourne avec `contextIsolation: true` et `nodeIntegration: false`.

## Limites v1

- Windows uniquement.
- Pas de Files On-Demand.
- Pas d'overlays Explorer.
- Pas de multi-compte.
- Detection de renommage/deplacement encore limitee : selon le cas, un rename peut etre traite comme suppression + creation.
- Pas de queue persistante detaillee : la reprise repose sur le manifeste local, le scan de rattrapage et le polling.
- Pas d'auto-update.
- L'icone Windows utilise encore le fallback Electron si aucune icone applicative n'est fournie.

## Depannage

- Fenetre blanche : verifier que le build desktop utilise `base: './'` dans Vite, puis regenerer l'installeur.
- Login impossible : verifier l'URL backend et les logs backend.
- MFA bloque : se reconnecter et terminer le setup MFA cote SupFile.
- Quota depasse : liberer de l'espace ou augmenter le plan.
- Fichier verrouille : fermer l'application qui utilise le fichier, puis relancer une synchronisation.
- Antivirus : autoriser `SupFile Sync.exe` si le watcher ou l'ecriture locale sont bloques.
- Chemins trop longs Windows : raccourcir le chemin du dossier local ou des sous-dossiers.

## Build local

Depuis `desktop/` :

```bash
npm run lint
npm run build
npm run dist:win
```

L'installeur local est genere dans `desktop/release/SupFile-Sync-Setup.exe`.
