# SUPFile — CEO / Directeur Produit

> Rôle dans la présentation : **ouverture + contexte marché + stratégie commerciale + projections + clôture**
> Les fonctionnalités, l'architecture, la sécurité et l'UI/UX sont développées par les autres membres de l'équipe.

---

## Ouverture — Ce qu'on a construit et pourquoi

SUPFile est une plateforme de stockage cloud **souveraine, sécurisée, avec IA documentaire intégrée**, hébergée en France.

On répond à un besoin précis, non adressé correctement par le marché actuel :

> *Stocker ses données en France, bénéficier d'une IA qui analyse ses documents, sans sacrifier la sécurité — à un prix accessible pour une PME.*

En quelques minutes, vous allez voir comment on a construit ce produit — la technologie, la sécurité, l'expérience utilisateur. Mon rôle ici est de vous expliquer **pourquoi** on l'a construit, et **pour qui**.

---

## Le problème marché

Quand une entreprise française ou une administration veut stocker ses documents dans le cloud, elle choisit entre deux mauvaises options :

- **Dropbox / Google Drive / OneDrive** : efficaces, mais les données partent aux États-Unis, soumises au Cloud Act — hors de portée du RGPD réel
- **Nextcloud auto-hébergé** : souverain, mais nécessite une équipe technique interne dédiée, des serveurs, de la maintenance — la plupart des structures n'ont pas ça

**Il n'existe pas de solution clé en main, souveraine, avec de l'IA locale, à un prix accessible pour une PME.**

Et la pression réglementaire ne fait qu'augmenter : RGPD, NIS2, SecNumCloud obligatoire pour les OIV, le secteur santé, la défense. La souveraineté numérique n'est plus un argument marketing — c'est une obligation contractuelle pour des pans entiers de l'économie française.

---

## Notre positionnement — 3 piliers

**Souveraineté** : données hébergées exclusivement chez Scaleway (Paris) ou Outscale/Numspot — le seul hébergeur qualifié **SecNumCloud ANSSI**.

**Sécurité by design** : chiffrement AES-256, architecture à double clé, MFA natif, audit log complet. Ce n'est pas une option — c'est le socle de base. Mon collègue en charge de la sécurité développera ça.

**IA on-premise** : notre assistant Bobby analyse les documents des utilisateurs en langage naturel. Zéro donnée envoyée à OpenAI ou Google. Le LLM tourne sur nos serveurs, en France. Notre architecte vous expliquera comment.

---

## Stratégie commerciale — B2C comme rampe, B2B comme moteur

### B2C : l'acquisition

| Plan | Prix | Marge brute |
|---|---|---|
| FREE | Gratuit | — |
| PRO | 9,99 €/mois | ~60% |
| BUSINESS | 24,99 €/mois | ~64% |
| ENTERPRISE | Sur devis | Passerelle B2B |

Le FREE n'est pas une charge — c'est notre moteur de notoriété. Les marges sur PRO et BUSINESS sont saines. Mais le B2C seul ne suffit pas à financer une croissance.

### B2B : le vrai moteur de revenus

**Un seul contrat Grand Compte (8 500 €/mois) représente 76% de notre MRR B2C à 12 mois.**

Chaque client B2B reçoit une instance dédiée sur son propre sous-domaine (`acme-corp.supfile.tech`). Ses données ne sont jamais mutualisées.

| Tier | Cible | Prix | Marge |
|---|---|---|---|
| PME | Jusqu'à 50 utilisateurs | 1 490 €/mois | ~45% |
| ETI | Jusqu'à 200 utilisateurs | 3 490 €/mois | ~51% |
| Grand Compte | 200+ utilisateurs | 8 500 €/mois+ | ~47% |
| Enterprise Agentic | Multi-LLM, IA avancée | 20 000 €/mois+ | Sur devis |

Le détail complet des grilles, marges et infrastructure est dans le document BUSINESS_MODEL.md.

### Ce que notre prix PME vend vraiment

Un client PME à 1 490 €/mois évite d'internaliser :
- 1 ingénieur DevOps (~3 500 €/mois)
- Licences + infrastructure + sécurité + conformité

Notre offre est une **économie**, pas un coût supplémentaire.

---

## Coûts opérationnels — Ressources humaines

Pour faire tourner SUPFile en production, le coût humain mensuel post-lancement :

| Poste | Profil | Coût mensuel |
|---|---|---|
| Support & maintenance applicative | 1 développeur junior (mi-temps) | ~1 500 € |
| Support client | 1 account manager (par tranche de 10 clients B2B) | ~2 500 € |
| Infrastructure & DevOps | Géré par l'équipe fondatrice (0 € initial) | — |
| **Total RH opérationnel de base** | | **~4 000 €/mois** |

**Seuil de rentabilité** : 2 clients PME Tier 1 (2 × 1 490 €) + ~200 utilisateurs payants B2C couvrent les charges fixes d'exploitation (infra + RH).

---

## Avantages concurrentiels

| | **SUPFile** | Dropbox | Google | Nextcloud |
|---|---|---|---|---|
| Données en France | ✅ | ❌ USA | ❌ USA | ✅ auto-hébergé |
| SecNumCloud ANSSI | ✅ Outscale | ❌ | ❌ | ⚠️ |
| IA on-premise | ✅ LLM local | ❌ | ⚠️ cloud US | ❌ |
| Clé en main | ✅ | ✅ | ✅ | ❌ (auto-géré) |

Le premium tarifaire vs Nextcloud se justifie : hébergement managé, conformité SecNumCloud, IA locale et SLA — là où Nextcloud nécessite une équipe interne.

---


## Clôture

Vous avez vu la technologie, la sécurité, l'expérience utilisateur. Ce que je veux retenir :

- Le produit est **fonctionnel et déployable maintenant** — un `docker compose up` suffit
- L'infrastructure est **dimensionnée pour scaler** — Kubernetes sur Outscale pour les Grand Comptes
- La réglementation **travaille pour nous** — SecNumCloud, NIS2, RGPD poussent les entreprises françaises vers des solutions souveraines
- Le modèle économique est **sain dès le premier contrat B2B**

SUPFile n'est pas un énième clone de Dropbox. C'est une réponse à un besoin structurel du marché français, avec une IA souveraine embarquée que personne d'autre ne propose à ce niveau de prix.
