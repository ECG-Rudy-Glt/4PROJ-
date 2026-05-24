# Production / preproduction VPS SUPFile

Ce guide decrit le chemin de deploiement web/backend pour `supfile.tech`, hors mobile. Le workflow GitHub Actions actif deploie l'environnement `production` sur push vers `main`.

## DNS et HTTPS

- `supfile.tech` pointe vers le VPS.
- Les certificats TLS existent sur le VPS, par defaut:
  - `/etc/letsencrypt/live/supfile.tech/fullchain.pem`
  - `/etc/letsencrypt/live/supfile.tech/privkey.pem`
- Le reverse proxy Docker publie `80` et `443`.

## Variables VPS minimales

Dans le `.env` du VPS:

```bash
PUBLIC_BASE_URL=https://supfile.tech
BIND_ADDRESS=127.0.0.1:

API_URL=https://supfile.tech
FRONTEND_URL=https://supfile.tech
VITE_API_URL=https://supfile.tech
ONLYOFFICE_PUBLIC_URL=https://supfile.tech/onlyoffice

JWT_SECRET=<openssl rand -base64 48>
JWT_MFA_SECRET=<openssl rand -base64 48>
DEK_WRAP_SECRET=<openssl rand -base64 48>
FILE_ENCRYPTION_KEY=<openssl rand -base64 48>
ONLYOFFICE_JWT_SECRET=<openssl rand -base64 48>
MFA_ENCRYPTION_KEY=<openssl rand -hex 32>
```

`BIND_ADDRESS=127.0.0.1:` evite d'exposer directement les ports applicatifs du compose principal. Le trafic public passe par `reverse-proxy`.

Le secret GitHub Actions `PROD_ENV_FILE_CONTENT` doit contenir ce `.env` complet pour que le pipeline puisse le copier dans `PROD_DEPLOY_PATH/.env`. Les variables GitHub de deploiement attendues sont:

```bash
PROD_DEPLOY_HOST=supfile.tech
PROD_DEPLOY_USER=<utilisateur SSH>
PROD_DEPLOY_PATH=/opt/supfile
```

## OAuth Google/GitHub

Configurer les callbacks suivants dans les consoles provider:

- Google: `https://supfile.tech/api/auth/google/callback`
- GitHub: `https://supfile.tech/api/auth/github/callback`

Puis renseigner:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

Le frontend appelle `GET /api/auth/providers` et masque automatiquement les boutons non configures.

## Stripe test

Utiliser Stripe en mode test uniquement:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
```

Webhook Stripe test:

```text
https://supfile.tech/api/billing/webhook
```

Evenements utiles:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Demarrage

```bash
docker compose -f docker-compose.yml -f docker-compose.vps.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.vps.yml ps
```

## Publication SupFile Sync Windows

Le client desktop Windows n'est pas lance dans Docker. Il est build depuis le dossier `desktop/`, puis l'installeur est publie cote frontend.

Build local :

```bash
cd desktop
npm install
npm run lint
npm run dist:win
```

Artefact attendu :

```text
desktop/release/SupFile-Sync-Setup.exe
```

Pour une publication web locale ou preprod, copier l'installeur dans :

```text
frontend/public/downloads/SupFile-Sync-Setup.exe
```

Puis reconstruire le frontend pour que Nginx serve le fichier. En production publique, le telechargement doit etre servi en HTTPS. La signature Windows de l'executable n'est pas automatisee en v1 : elle doit etre ajoutee dans une pipeline release avec certificat de signature de code.

## Sauvegarde et restauration

Sauvegarde:

```bash
sh scripts/backup-vps.sh
```

Restauration:

```bash
CONFIRM_RESTORE=yes sh scripts/restore-vps.sh backups/postgres-YYYYMMDD-HHMMSS.sql backups/minio-YYYYMMDD-HHMMSS.tar.gz
```

La restauration remplace le schema PostgreSQL et le volume MinIO. A utiliser uniquement sur une instance de preproduction cible.
