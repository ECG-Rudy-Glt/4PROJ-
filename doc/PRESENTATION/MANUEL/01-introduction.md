# 1. Introduction et Presentation de SUPFile

[< Retour au sommaire](README.md)

---

SUPFile est une plateforme francaise de stockage cloud souverain developpee dans le cadre du projet 4PROJ par **Paul Mazzon**, **Rudy Gault**, **Mathis Malzac** et **Hugo Bouland**. Elle se positionne comme une alternative souveraine a Dropbox, Google Drive ou OneDrive.

---

## 1.1 Piliers Fondamentaux

### Souverainete des donnees
Stockage sur infrastructure propre (MinIO, S3-compatible), sans dependance aux GAFAM.

### Securite de bout en bout
Chiffrement par modele DEK/KEK — cle de chiffrement protegee par cle derivee du mot de passe utilisateur.

### Intelligence artificielle integree
Assistant Bobby (RAG local via Ollama + ChromaDB) sans appel a des API externes.

### Conformite RGPD
Export des donnees, suppression de compte, journaux d'audit complets.

### Accessibilite multi-plateforme
Application web React (desktop/tablette) et application mobile React Native (iOS/Android).

---

## 1.2 Plans Disponibles

| Plan | Stockage | Fonctionnalites principales |
|------|----------|----------------------------|
| **FREE** | 30 Go | Upload/Download, partage par lien, partage basique |
| **PRO** | Augmente | Bobby IA, journal d'audit, coffre-fort securise, versioning avance |
| **BUSINESS** | Augmente | Tout le PRO + Organisations, partage avance entre membres |
| **ENTERPRISE** | Sur mesure | Fonctionnalites sur mesure, deploiement dedie |

---

## Capture d'ecran

> **SCREEN A CAPTURER** — Page d'accueil / landing page de SUPFile (ou la page de connexion Web)

---

[Section suivante : Architecture Generale →](02-architecture.md)
