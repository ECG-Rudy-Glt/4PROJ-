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

## Environnements

| Env | URL | Branche |
|-----|-----|---------|
| Production | https://supfile.tech/ | main |
| Dev | localhost | feature/* |
