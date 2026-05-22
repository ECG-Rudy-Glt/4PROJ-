# Architecture - SUPFile

## Vue d'ensemble

![Architecture Globale](img/supfile_architecture-Architecture%20Globale.drawio.png)

## Flux des containers Docker

![Flux Containers](img/supfile_architecture-Flux%20Containers.drawio.png)

## Composants

### Frontend Web
- **URL** : https://supfile.tech/
- **Stack** : React 18, Vite, TypeScript, TailwindCSS, Zustand
- **Port dev** : 5173

![Dashboard Web](../MANUEL%20UTILISATEUR/img/web/01-dashboard.png)

### Application Mobile
- **Stack** : React Native, Expo
- **Plateformes** : iOS 13+, Android 10+

![Dashboard Mobile](../MANUEL%20UTILISATEUR/img/mobile/06-dashboard.png)

### Client Desktop Windows
- **Stack** : Electron 31, React/Vite, TypeScript, chokidar
- **Plateforme** : Windows uniquement en v1
- **Distribution** : installeur `.exe` genere par `electron-builder`
- **Role** : synchroniser un dossier local avec le dossier distant `SupFile Sync`
- **Integration** : API SupFile uniquement (`/api/sync`, `/api/files`, auth Bearer)

Le client desktop est hors Docker : il s'installe sur le poste utilisateur et dialogue avec le backend publie. Il ne se connecte jamais directement a PostgreSQL, MinIO ou S3.

### Backend API
- **Stack** : Node.js 20, Express, TypeScript, Prisma
- **Port** : 5001
- **Documentation** : `/api-docs` (Swagger)

### Bobby (Assistant IA)
- **Stack** : Python, FastAPI, LangChain, Ollama, ChromaDB
- **Modele** : gemma2:2b
- **Port** : 8001

![Bobby Chat](../MANUEL%20UTILISATEUR/img/web/26-bobby_salaire_question.png)

### Base de donnees
- **SGBD** : PostgreSQL 16
- **ORM** : Prisma

![MCD - Modele Conceptuel de Donnees](img/MCD.png)

### Stockage fichiers
- **Solution** : Compatible S3 (MinIO en dev, OVH Object Storage en prod)
- **Chiffrement** : AES-256-GCM (KEK/DEK)

## Securite

| Couche | Protection |
|--------|------------|
| Transport | HTTPS (Let's Encrypt) |
| Auth | JWT + MFA TOTP obligatoire |
| Fichiers | Chiffrement AES-256-GCM |
| Cles | Architecture KEK/DEK, PBKDF2-SHA512 |
| API | Rate limiting, Helmet, CORS strict |
| Desktop | safeStorage Electron, CSP renderer, IPC minimal |

## Environnements

| Env | URL | Branche |
|-----|-----|---------|
| Production | https://supfile.tech/ | main |
| Dev | localhost | feature/* |
