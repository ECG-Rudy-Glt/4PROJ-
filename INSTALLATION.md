# SUPFILE - Guide d'Installation

## Pré-requis

- Docker et Docker Compose installés
- Node.js 20+ (pour le développement local uniquement)
- Git

## Installation avec Docker (Recommandé)

### 1. Cloner le projet

```bash
git clone <votre-repo>
cd 4PROJ-
```

### 2. Configuration

Les fichiers `.env` sont déjà configurés avec des valeurs par défaut. Pour la production, modifiez les secrets :

**Backend** (`backend/.env`):
```env
JWT_SECRET=votre-secret-jwt-unique-et-securise
DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/supfile
```

**OAuth2 (Optionnel)**:
Si vous souhaitez activer Google ou GitHub OAuth2, ajoutez les credentials dans `backend/.env`:
```env
GOOGLE_CLIENT_ID=votre-google-client-id
GOOGLE_CLIENT_SECRET=votre-google-client-secret
GITHUB_CLIENT_ID=votre-github-client-id
GITHUB_CLIENT_SECRET=votre-github-client-secret
```

### 3. Lancer l'application

```bash
docker compose up -d
```

Cette commande va :
- Créer la base de données PostgreSQL
- Installer et démarrer le backend
- Installer et démarrer le frontend
- Créer les volumes pour la persistance des données

### 4. Accéder à l'application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Base de données**: localhost:5432

### 5. Initialiser la base de données

La base de données sera automatiquement migrée au démarrage du backend.

## Installation pour le développement local

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Commandes utiles

### Docker

```bash
# Arrêter l'application
docker compose down

# Voir les logs
docker compose logs -f

# Rebuild après modifications
docker compose up -d --build

# Supprimer tous les volumes (⚠️ Perte de données)
docker compose down -v
```

### Base de données

```bash
# Accéder au shell PostgreSQL
docker exec -it supfile-postgres psql -U postgres -d supfile

# Voir les données
docker exec -it supfile-backend npx prisma studio
```

## Structure des volumes Docker

- `postgres_data`: Données de la base de données PostgreSQL
- `uploads_data`: Fichiers uploadés par les utilisateurs

Ces volumes persistent même après `docker compose down`.

## Premiers pas

1. Créez un compte via l'interface d'inscription
2. Vous recevrez 30 Go de quota par défaut
3. Commencez à uploader vos fichiers !

## Dépannage

### Le backend ne démarre pas
- Vérifiez que PostgreSQL est bien démarré : `docker compose ps`
- Consultez les logs : `docker compose logs backend`

### Erreur de connexion à la base de données
- Vérifiez le `DATABASE_URL` dans `backend/.env`
- Assurez-vous que le service PostgreSQL est healthy

### Les fichiers ne s'uploadent pas
- Vérifiez les permissions du volume `uploads_data`
- Vérifiez le quota disponible de l'utilisateur

### OAuth2 ne fonctionne pas
- Assurez-vous d'avoir configuré les credentials dans `.env`
- Vérifiez que les URLs de callback sont correctes dans la console des providers
- Google callback: `http://localhost:5000/api/auth/google/callback`
- GitHub callback: `http://localhost:5000/api/auth/github/callback`

## Configuration OAuth2

### Google OAuth2

1. Allez sur https://console.cloud.google.com
2. Créez un nouveau projet
3. Activez Google+ API
4. Créez des credentials OAuth 2.0
5. Ajoutez les URLs de redirection :
   - `http://localhost:5000/api/auth/google/callback`
   - `http://localhost:3000/auth/callback`
6. Copiez Client ID et Client Secret dans `backend/.env`

### GitHub OAuth2

1. Allez sur https://github.com/settings/developers
2. Créez une nouvelle OAuth App
3. Callback URL: `http://localhost:5000/api/auth/github/callback`
4. Copiez Client ID et Client Secret dans `backend/.env`

## Sécurité

⚠️ **IMPORTANT pour la production** :

1. Changez tous les secrets dans les fichiers `.env`
2. Utilisez des mots de passe forts pour PostgreSQL
3. Configurez HTTPS avec un reverse proxy (nginx, Traefik)
4. Ajoutez des limites de rate-limiting
5. Configurez les CORS correctement
6. Utilisez des variables d'environnement sécurisées (pas de fichiers .env en production)

## Support

Pour toute question ou problème, ouvrez une issue sur GitHub.
