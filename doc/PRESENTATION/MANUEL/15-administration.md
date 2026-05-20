# 15. Panel Administrateur

[< Retour au sommaire](README.md) | [< Delegation](14-delegation.md)

---

> **Accessible uniquement aux utilisateurs avec le role ADMIN**

---

## 15.1 Web — `/admin`

### Statistiques globales

| Statistique | Description |
|-------------|-------------|
| Utilisateurs | Nombre total d'utilisateurs |
| Stockage total | Volume total utilise |
| Fichiers | Nombre total de fichiers |

### Graphiques d'activite
- Visualisation de l'activite sur la plateforme
- Tendances d'utilisation

---

## Tableau des utilisateurs

### Colonnes

| Colonne | Description |
|---------|-------------|
| Avatar | Photo de profil |
| Nom | Nom complet |
| Email | Adresse email |
| Plan | FREE / PRO / BUSINESS / ENTERPRISE |
| Statut | ACTIVE / SUSPENDED |
| Date inscription | Date de creation du compte |

---

## Actions administrateur

### Gestion du statut

| Action | Effet |
|--------|-------|
| **Activer** | Badge vert, acces autorise |
| **Suspendre** | Badge rouge, acces bloque |

### Gestion des roles
- Modifier le role d'un utilisateur

### Gestion des plans
- Forcer un plan specifique pour un utilisateur

---

## Exports

| Export | Format |
|--------|--------|
| Export utilisateurs | CSV |
| Export stockage | CSV |

---

## Reindexation IA

### Fonctionnalite
Bouton pour relancer les embeddings ChromaDB pour tous les utilisateurs

### Utilisation
- Apres une mise a jour du modele
- En cas de probleme de recherche semantique
- Pour reindexer les nouveaux fichiers

> **SCREEN A CAPTURER** — (WEB) `/admin` — tableau utilisateurs avec filtres et actions

---

## 15.2 Mobile — AdminScreen

### Interface
- Vue simplifiee des statistiques
- Liste des utilisateurs
- Memes actions que le Web

> **SCREEN A CAPTURER** — (MOBILE) AdminScreen

---

## Bonnes pratiques d'administration

### Securite
- Limiter le nombre d'administrateurs
- Verifier regulierement les comptes suspendus
- Monitorer les connexions suspectes via l'audit

### Maintenance
- Effectuer des reindexations IA periodiques
- Exporter les donnees pour backup
- Surveiller l'utilisation du stockage

---

[Section suivante : Notifications →](16-notifications.md)
