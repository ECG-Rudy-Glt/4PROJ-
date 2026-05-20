# 13. Journal d'Audit

[< Retour au sommaire](README.md) | [< Organisations](12-organisations.md)

---

> **Disponible pour :** plans PRO et superieurs

---

## 13.1 Web — `/audit`

### Colonnes du tableau

| Colonne | Description |
|---------|-------------|
| **Date/Heure** | Horodatage precis de l'action |
| **Utilisateur** | Avatar + nom |
| **Action** | Type d'action effectuee |
| **Ressource** | Nom du fichier ou dossier |
| **IP** | Adresse IP de provenance |

---

## Types d'actions tracees

| Action | Description |
|--------|-------------|
| `UPLOAD` | Telechargement vers SUPFile |
| `DOWNLOAD` | Telechargement depuis SUPFile |
| `DELETE` | Suppression de fichier/dossier |
| `LOGIN` | Connexion au compte |
| `SHARE_CREATE` | Creation d'un partage |
| `PASSWORD_CHANGE` | Modification du mot de passe |
| `VAULT_UNLOCK` | Deverrouillage du coffre-fort |
| ... | Et bien d'autres actions |

---

## Fonctionnalites

### Filtres disponibles
| Filtre | Description |
|--------|-------------|
| Type d'action | Filtrer par categorie |
| Utilisateur | Filtrer par personne |
| Plage de dates | Definir une periode |

### Export
- **Export CSV** : telecharger les logs au format CSV

### Navigation
- **Pagination** : navigation par pages

> **SCREEN A CAPTURER** — (WEB) `/audit` — tableau d'activite filtre avec plusieurs entrees

---

## 13.2 Mobile — AuditScreen

### Interface
- Liste scrollable
- Memes filtres adaptes au mobile

> **SCREEN A CAPTURER** — (MOBILE) AuditScreen — liste des entrees d'audit

---

## Cas d'usage du journal d'audit

### Securite
- Detecter les connexions suspectes
- Identifier les acces non autorises
- Tracer les modifications de fichiers sensibles

### Conformite
- Prouver la tracabilite des actions
- Repondre aux exigences RGPD
- Documenter les acces aux donnees

### Diagnostic
- Comprendre les problemes utilisateur
- Analyser les patterns d'utilisation

---

[Section suivante : Delegation →](14-delegation.md)
