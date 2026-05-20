# 12. Organisations et Multi-Tenants

[< Retour au sommaire](README.md) | [< Abonnements](11-abonnements.md)

---

> **Disponible pour :** plans BUSINESS et superieurs

---

## 12.1 Web — `/organization-admin`

### Creation d'une organisation
1. Clic sur le bouton de creation
2. Modale avec champ "Nom de l'organisation"
3. L'utilisateur devient automatiquement **OWNER**

---

## Roles disponibles

| Role | Description | Droits |
|------|-------------|--------|
| **OWNER** | Proprietaire | Tous droits, suppression organisation |
| **ADMIN** | Administrateur | Gestion membres et fichiers partages |
| **MEMBER** | Membre standard | Acces selon les permissions |

---

## Gestion des membres

### Inviter un membre
- Saisie de l'email
- Selection du role

### Modifier un role
- Dropdown de selection

### Retirer un membre
- Bouton de suppression

---

## Switcher de contexte

### Navigation entre contextes
- **Compte personnel** ↔ **Organisation [Nom]**
- Accessible dans le header/sidebar

### Interface
```
┌────────────────────────┐
│  👤 Compte personnel   │  ← Contexte actuel
├────────────────────────┤
│  🏢 Organisation ABC   │
│  🏢 Organisation XYZ   │
└────────────────────────┘
```

> **SCREEN A CAPTURER** — (WEB) `/organization-admin` — liste des membres avec roles et actions

---

## Flux de gestion

```
┌─────────────────┐
│   OWNER cree    │
│  l'organisation │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Invitation par  │
│     email       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Membre rejoint │
│   (MEMBER)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OWNER/ADMIN     │
│ gere les droits │
└─────────────────┘
```

---

## Partage dans une organisation

### Fichiers partages
- Visibles par tous les membres selon leurs permissions
- Gestion centralisee par les ADMIN/OWNER

### Permissions
- Heritees du role de base
- Personnalisables par fichier/dossier

---

[Section suivante : Journal d'Audit →](13-audit.md)
