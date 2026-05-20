# 8. Coffre-Fort Securise (Vault)

[< Retour au sommaire](README.md) | [< Bobby IA](07-bobby-ia.md)

---

> **Disponible pour :** plans PRO et superieurs

**Double protection :** les fichiers du vault sont chiffres avec un mot de passe supplementaire independant du compte.

---

## 8.1 Web — `/settings`

### Etats du coffre-fort

| Etat | Interface |
|------|-----------|
| **Initial** | Bouton "Configurer" + champ mot de passe + code TOTP |
| **Verrouille** | Badge "Verrouille" + bouton "Deverrouiller" (mot de passe + TOTP) |
| **Deverrouille** | Badge + minuteur de session + acces dossier Vault + bouton "Verrouiller" |

### Flux de configuration

```
┌─────────────────┐
│  Etat initial   │
│  (non configure)│
└────────┬────────┘
         │ Configurer
         ▼
┌─────────────────┐
│   Verrouille    │
│  (mot de passe  │
│   + TOTP requis)│
└────────┬────────┘
         │ Deverrouiller
         ▼
┌─────────────────┐
│  Deverrouille   │
│ (session active │
│  avec minuteur) │
└────────┬────────┘
         │ Verrouiller / Timeout
         ▼
    Retour verrouille
```

---

## 8.2 Mobile — VaultScreen

### Etats disponibles

| Etat | Description |
|------|-------------|
| `idle` | Etat initial, non configure |
| `setup` | Configuration du mot de passe |
| `unlock` | Saisie pour deverrouiller |
| `rotate` | Changement du mot de passe |

### Interface
- Chaque etat : champs mot de passe + code TOTP 6 chiffres

![Vault Mobile](img/mobile/22-vault.png)

*Ecran du coffre-fort sur Mobile*

---

## Securite du coffre-fort

### Double chiffrement

```
┌──────────────────────────────────────────┐
│           Fichier utilisateur            │
├──────────────────────────────────────────┤
│  Chiffrement standard (DEK/KEK)          │
│  ┌────────────────────────────────────┐  │
│  │      Fichier dans le Vault        │  │
│  ├────────────────────────────────────┤  │
│  │  + Chiffrement Vault              │  │
│  │  (mot de passe supplementaire)    │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Points cles
- **Mot de passe independant** : different du mot de passe du compte
- **TOTP obligatoire** : verification MFA pour chaque acces
- **Session temporaire** : deverrouillage avec minuteur, reverrouillage automatique
- **Isolation** : les fichiers du vault sont dans un dossier separe

---

[Section suivante : Recherche →](09-recherche.md)
