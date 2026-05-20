# SUPFile - Manuel Utilisateur

**Parcours Utilisateur - Documentation complete des interfaces Web et Mobile**

---

**Auteurs :** Paul Mazzon, Rudy Gault, Mathis Malzac, Hugo Bouland

**Projet :** 4PROJ - Projet de fin d'etudes

**Annee :** 2025 - 2026

---

## Technologies

| Plateforme | Stack |
|------------|-------|
| Web | React 18 + TypeScript + TailwindCSS |
| Mobile | React Native (Expo) + TypeScript |
| Backend | Node.js + Express + PostgreSQL + Prisma + MinIO |
| IA | Python brain-api + Ollama + ChromaDB |

---

## Table des Matieres

### Fondamentaux

1. [Introduction et Presentation](01-introduction.md)
   - Piliers fondamentaux
   - Plans disponibles (FREE, PRO, BUSINESS, ENTERPRISE)

2. [Architecture Generale](02-architecture.md)
   - Schema d'architecture
   - Composants techniques

### Authentification et Securite

3. [Parcours d'Authentification](03-authentification.md)
   - Inscription (Web & Mobile)
   - Connexion (Web & Mobile)
   - MFA obligatoire (TOTP)
   - OAuth2 (Google / GitHub)
   - Reinitialisation du mot de passe

### Interface Principale

4. [Tableau de Bord](04-dashboard.md)
   - Dashboard Web
   - Dashboard Mobile

5. [Gestion des Fichiers et Dossiers](05-gestion-fichiers.md)
   - Navigation et vues
   - Upload de fichiers
   - Creation de dossiers
   - Renommer et deplacer
   - Corbeille
   - Favoris
   - Versions
   - Tags et organisation
   - Previsualisation
   - Telechargement

### Collaboration

6. [Partage et Collaboration](06-partage-collaboration.md)
   - Liens de partage public
   - Partage avec utilisateurs
   - Gestion des permissions
   - Commentaires
   - Notifications de partage

### Fonctionnalites Avancees

7. [Bobby - L'Assistant IA](07-bobby-ia.md)
   - Interface de chat
   - Analyse de fichiers
   - Recherche semantique
   - Generation de fichiers

8. [Coffre-Fort Securise](08-coffre-fort.md)
   - Configuration Web
   - Configuration Mobile

9. [Recherche](09-recherche.md)
   - Recherche Web
   - Recherche Mobile

### Configuration

10. [Parametres et Profil](10-parametres.md)
    - Edition du profil
    - Changement de mot de passe
    - Theme clair/sombre
    - Configuration MFA
    - Conformite RGPD
    - Langue

11. [Abonnements et Plans](11-abonnements.md)
    - Comparatif des plans
    - Integration Stripe

### Administration

12. [Organisations et Multi-Tenants](12-organisations.md)
    - Creation d'organisation
    - Gestion des membres
    - Roles et permissions

13. [Journal d'Audit](13-audit.md)
    - Interface Web
    - Interface Mobile

14. [Delegation et Changement de Compte](14-delegation.md)
    - Delegation de permissions
    - Changement de compte

15. [Panel Administrateur](15-administration.md)
    - Statistiques globales
    - Gestion des utilisateurs

16. [Notifications](16-notifications.md)
    - Centre de notifications Web
    - Push notifications Mobile
    - Web Push

### Annexes

17. [Recapitulatif des Captures d'Ecran](17-annexes.md)
    - Liste Web (40 captures)
    - Liste Mobile (19 captures)

---

## Navigation Rapide par Role

### Utilisateur Standard (FREE)
- [Introduction](01-introduction.md) → [Authentification](03-authentification.md) → [Dashboard](04-dashboard.md) → [Fichiers](05-gestion-fichiers.md) → [Partage](06-partage-collaboration.md)

### Utilisateur PRO
- Tout le parcours FREE + [Bobby IA](07-bobby-ia.md) + [Coffre-Fort](08-coffre-fort.md) + [Audit](13-audit.md)

### Utilisateur BUSINESS
- Tout le parcours PRO + [Organisations](12-organisations.md)

### Administrateur
- Tout + [Panel Admin](15-administration.md)

---

## Conclusion

Voir la [conclusion complete](01-introduction.md#conclusion) pour le bilan du projet.
