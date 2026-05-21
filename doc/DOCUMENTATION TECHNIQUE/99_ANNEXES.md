# Annexes — SUPFile

## Liens utiles

| Ressource | URL |
|-----------|-----|
| Site production | https://supfile.tech/ |
| Site preprod | https://preprod.supfile.tech/ |
| API Swagger | https://supfile.tech/api-docs |
| Repository GitHub | https://github.com/... (prive) |

## Glossaire

| Terme | Definition |
|-------|------------|
| KEK | Key Encryption Key — cle maitre derivee du mot de passe utilisateur |
| DEK | Data Encryption Key — cle unique par fichier, chiffree par la KEK |
| MFA | Multi-Factor Authentication — authentification a deux facteurs |
| TOTP | Time-based One-Time Password — code a 6 chiffres (Google Authenticator) |
| Coffre-fort | Espace securise avec second mot de passe |
| Bobby | Assistant IA integre base sur gemma2:2b (Ollama) |

## Variables d'environnement

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
S3_ENDPOINT=...
S3_BUCKET=...
OLLAMA_HOST=...
```

### Frontend (.env)
```
VITE_API_URL=https://supfile.tech/api
VITE_SOCKET_URL=https://supfile.tech
```

## Ports par defaut

| Service | Port |
|---------|------|
| Frontend (dev) | 5173 |
| Backend API | 5001 |
| Bobby IA | 8001 |
| PostgreSQL | 5432 |
| MinIO | 9000 |

## References techniques

- [Express.js](https://expressjs.com/)
- [Prisma ORM](https://www.prisma.io/)
- [React](https://react.dev/)
- [React Native](https://reactnative.dev/)
- [Expo](https://expo.dev/)
- [LangChain](https://langchain.com/)
- [Ollama](https://ollama.ai/)

---

**Derniere mise a jour** : Mai 2026
