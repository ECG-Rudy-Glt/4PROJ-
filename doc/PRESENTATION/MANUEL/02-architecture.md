# 2. Architecture Generale

[< Retour au sommaire](README.md) | [< Introduction](01-introduction.md)

---

SUPFile repose sur une architecture microservices modulaire, deployee via Docker Compose. Le backend expose plus de **100 endpoints** repartis en **23 modules de routes**, gerant **24 entites** en base de donnees PostgreSQL.

---

## 2.1 Schema d'Architecture

| Composant | Technologie | Role |
|-----------|-------------|------|
| **Frontend Web** | React 18 + Vite + TailwindCSS | Interface utilisateur desktop/tablette |
| **Application Mobile** | React Native + Expo | Interface iOS et Android |
| **API Backend** | Node.js + Express + TypeScript | Logique metier, 23 modules, 100+ endpoints |
| **Base de donnees** | PostgreSQL 16 + Prisma ORM | Persistance des donnees (24 entites) |
| **Stockage objet** | MinIO (S3-compatible) | Stockage des fichiers chiffres |
| **IA / RAG** | Python brain-api + Ollama + ChromaDB | LLM local + base vectorielle pour Bobby |
| **Temps reel** | Socket.io WebSockets | Mises a jour en direct, notifications |
| **Paiement** | Stripe | Abonnements et facturation |
| **Authentification** | JWT + OAuth2 + TOTP | Securite multi-couches |

---

## Diagramme simplifie

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend Web  │     │  Mobile (Expo)  │
│  React + Vite   │     │  React Native   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │     API Backend       │
         │  Node.js + Express    │
         │   (100+ endpoints)    │
         └───────────┬───────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────┐   ┌───────────┐   ┌───────────┐
│PostgreSQL│   │   MinIO   │   │ brain-api │
│ (Prisma) │   │ (fichiers)│   │ (Ollama)  │
└─────────┘   └───────────┘   └───────────┘
```

---

## Points cles techniques

- **23 modules de routes** : Organisation modulaire du code backend
- **24 entites PostgreSQL** : Modelisation complete via Prisma ORM
- **Chiffrement DEK/KEK** : Securite de bout en bout sur tous les fichiers
- **WebSockets Socket.io** : Temps reel pour uploads, notifications, commentaires
- **RAG 100% local** : Ollama + ChromaDB, zero dependance IA externe

---

[Section suivante : Authentification →](03-authentification.md)
