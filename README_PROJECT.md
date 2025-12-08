# SUPFILE - Cloud Storage Platform

## 📋 Description

SUPFILE est une plateforme de stockage cloud moderne développée avec Node.js, React, TypeScript et PostgreSQL. Elle offre une expérience similaire à Dropbox ou Google Drive avec des fonctionnalités avancées de gestion de fichiers, de partage et de collaboration.

## ✨ Fonctionnalités

### Authentification & Sécurité
- ✅ Inscription et connexion classique (email/mot de passe)
- ✅ Authentification OAuth2 (Google, GitHub)
- ✅ JWT pour la gestion des sessions
- ✅ Hachage sécurisé des mots de passe (bcrypt)
- ✅ Protection contre les attaques (helmet, rate limiting)

### Gestion de Fichiers
- ✅ Upload de fichiers avec barre de progression
- ✅ Création, renommage, déplacement de dossiers
- ✅ Navigation par fil d'Ariane (breadcrumbs)
- ✅ Téléchargement de fichiers et dossiers (ZIP)
- ✅ Corbeille avec restauration
- ✅ Gestion des quotas (30 Go par utilisateur)

### Prévisualisation
- ✅ Visionneuse pour images, PDF, textes
- ✅ Streaming audio/vidéo
- ✅ Aperçu sans téléchargement

### Partage & Collaboration
- ✅ Génération de liens publics
- ✅ Protection par mot de passe
- ✅ Date d'expiration
- ✅ Limite de téléchargements
- ✅ Partage de dossiers entre utilisateurs

### Dashboard & Recherche
- ✅ Statistiques d'utilisation
- ✅ Graphiques de répartition
- ✅ Fichiers récents
- ✅ Recherche avancée avec filtres

### Interface Utilisateur
- ✅ Design moderne et responsive
- ✅ Mode clair/sombre
- ✅ Interface intuitive
- ✅ Notifications toast

## 🛠 Stack Technique

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT, Passport.js
- **File Upload**: Multer
- **Security**: Helmet, bcrypt, rate-limit

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Notifications**: React Hot Toast

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 16
- **File Storage**: Docker volumes
- **Web Server**: Nginx (production)

## 📁 Structure du Projet

```
4PROJ-/
├── backend/                 # API Node.js + Express
│   ├── src/
│   │   ├── config/         # Configuration (DB, Passport, Multer)
│   │   ├── controllers/    # Contrôleurs des routes
│   │   ├── middlewares/    # Middlewares (auth, validation)
│   │   ├── routes/         # Définition des routes
│   │   ├── services/       # Logique métier
│   │   ├── types/          # Types TypeScript
│   │   └── utils/          # Utilitaires
│   ├── prisma/             # Schéma de base de données
│   └── Dockerfile
│
├── frontend/               # Application React
│   ├── src/
│   │   ├── components/    # Composants réutilisables
│   │   ├── pages/         # Pages de l'application
│   │   ├── services/      # Services API
│   │   ├── stores/        # State management (Zustand)
│   │   ├── types/         # Types TypeScript
│   │   └── styles/        # Styles CSS
│   └── Dockerfile
│
├── docker-compose.yml      # Orchestration des services
├── INSTALLATION.md         # Guide d'installation détaillé
└── README_PROJECT.md       # Ce fichier
```

## 🚀 Installation Rapide

### Avec Docker (Recommandé)

```bash
# Cloner le projet
git clone <votre-repo>
cd 4PROJ-

# Lancer l'application
./START.sh
# OU
docker compose up -d
```

Accédez à l'application sur http://localhost:3000

### Sans Docker (Développement)

**Backend:**
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Voir [INSTALLATION.md](INSTALLATION.md) pour plus de détails.

## 📊 Schéma de Base de Données

Le projet utilise PostgreSQL avec Prisma ORM. Voici les principales entités :

- **User**: Utilisateurs avec quota et thème
- **File**: Fichiers avec métadonnées
- **Folder**: Dossiers avec hiérarchie
- **SharedLink**: Liens de partage public
- **SharedFolder**: Partage entre utilisateurs

## 🔐 Sécurité

✅ **Implémenté** :
- Hachage des mots de passe (bcrypt)
- JWT pour l'authentification
- Protection CSRF
- Rate limiting
- Validation des entrées
- Helmet pour les headers HTTP
- Variables d'environnement pour les secrets

⚠️ **Pour la production** :
- Changez tous les secrets dans `.env`
- Configurez HTTPS
- Utilisez un reverse proxy
- Configurez CORS correctement
- Activez les logs de sécurité

## 📝 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/profile` - Profil utilisateur
- `GET /api/auth/google` - OAuth Google
- `GET /api/auth/github` - OAuth GitHub

### Fichiers
- `POST /api/files/upload` - Upload fichier
- `GET /api/files` - Liste des fichiers
- `GET /api/files/:id` - Détails fichier
- `GET /api/files/:id/download` - Télécharger
- `GET /api/files/:id/stream` - Streaming
- `DELETE /api/files/:id` - Supprimer

### Dossiers
- `POST /api/folders` - Créer dossier
- `GET /api/folders` - Liste dossiers
- `PUT /api/folders/:id` - Renommer
- `DELETE /api/folders/:id` - Supprimer

### Partage
- `POST /api/share/links` - Créer lien
- `GET /api/share/:token` - Accéder au partage
- `POST /api/share/folders` - Partager dossier

### Dashboard
- `GET /api/dashboard` - Statistiques

## 🎯 Fonctionnalités Implémentées

### Obligatoires (190 points)

| Fonctionnalité | Points | Statut |
|----------------|--------|--------|
| Connexion standard | 10 | ✅ |
| Connexion OAuth2 | 20 | ✅ |
| Navigation & Organisation | 15 | ✅ |
| Upload de fichiers | 20 | ✅ |
| Manipulation fichiers | 15 | ✅ |
| Visionneuse intégrée | 20 | ✅ |
| Téléchargement | 20 | ✅ |
| Liens publics | 20 | ✅ |
| Partage interne | 20 | ✅ |
| Tableau de bord | 15 | ✅ |
| Recherche | 15 | ✅ |

### Bonus

- ✅ Mot de passe pour liens de partage
- ✅ Date d'expiration pour liens
- ✅ Thème clair/sombre
- ✅ Interface moderne et responsive

## 🧪 Tests

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## 📦 Build pour Production

```bash
# Build avec Docker
docker compose -f docker-compose.prod.yml up -d --build

# Build manuel
cd backend && npm run build
cd frontend && npm run build
```

## 🤝 Contribution

Ce projet est un projet d'école. Les contributions ne sont pas acceptées pour le moment.

## 📄 Licence

Projet académique - Tous droits réservés

## 👥 Équipe

- Développeur Backend & Frontend
- Architecture & DevOps

## 📞 Support

Pour toute question :
- Ouvrir une issue sur GitHub
- Consulter [INSTALLATION.md](INSTALLATION.md)

## 🎓 Contexte Académique

Projet réalisé dans le cadre du module "Infrastructure de stockage distribué" pour la société SUPFile.

**Objectifs pédagogiques** :
- Architecture microservices
- Containerisation avec Docker
- API REST sécurisée
- Frontend moderne React
- Gestion de base de données
- OAuth2 et authentification
- Upload/Download de fichiers
- Partage et collaboration

---

**Version**: 1.0.0
**Date**: 2025
**Status**: ✅ Production Ready
