# SUPFile — Business Model, Pricing & Infrastructure

> Document de présentation commerciale — Avril 2026

---

## 1. Positionnement

SUPFile est une plateforme de stockage cloud **souveraine et sécurisée**, hébergée en France, concurrente de Dropbox et Google Drive. Elle se distingue sur trois axes :

- **Souveraineté** : données hébergées exclusivement chez Scaleway (Paris) ou Outscale/Numspot (SecNumCloud qualifié ANSSI)
- **Sécurité by design** : chiffrement AES-256 au repos, architecture KEK/DEK, MFA obligatoire, audit logs complets
- **IA embarquée** : assistant documentaire Bobby (RAG + LLM local), 100% on-premise, aucune donnée envoyée à un tiers

---

## 2. Segmentation clients

| Segment | Cible | Offre |
|---|---|---|
| **B2C** | Particuliers, freelances | Plans FREE / PRO / BUSINESS / ENTERPRISE |
| **B2B PME** | 10–50 collaborateurs | Instance dédiée Tier 1 |
| **B2B ETI** | 50–200 collaborateurs | Instance dédiée Tier 2 |
| **B2B Grand Compte** | 200+ collaborateurs, multi-sites | Kubernetes distribué Outscale |
| **B2B Secteur Public** | Administrations, collectivités | Outscale SecNumCloud + contrat cadre |

---

## 3. Plans B2C (grand public)

### 3.1 Grille tarifaire

| | FREE | PRO | BUSINESS | ENTERPRISE |
|---|---|---|---|---|
| **Prix** | Gratuit | **9,99 €/mois** | **24,99 €/mois** | **Sur devis** |
| **Marge brute** | — | ~60% | ~64% | — |
| **Stockage** | 30 Go | 100 Go | 500 Go | Sur devis |
| **IA Bobby** |  |  gemma3:2b |  gemma3:9b |  Modèle dédié |
| **Coffre-fort chiffré** |  |  |  |  |
| **Organisations** |  |  |  |  |
| **Partage avancé** | Lien basique |  mdp + expiration |  |  |
| **OnlyOffice** |  |  |  |  |
| **Versioning fichiers** |  | 10 versions | 30 versions | Illimité |
| **Support** | Community | Email 48h | Email 24h | Account manager dédié |
| **SLA** | Aucun | 99,5% | 99,7% | Sur devis |
| **Garantie données France** |  |  |  |  |

> Le plan **ENTERPRISE** est une passerelle vers le B2B — il s'adresse aux freelances avancés ou petites structures qui dépassent les limites BUSINESS. Au-delà, le commercial prend le relais avec une offre B2B dédiée (Tier 1 à partir de 1 490 €/mois).

### 3.2 Justification des prix (coûts Scaleway réels)

**Infrastructure mutualisée B2C — base pour ~500 utilisateurs actifs :**

| Ressource | Config Scaleway | Coût/mois |
|---|---|---|
| Backend API | PRO2-S (8 vCPU, 32 GB RAM) | €159,87 |
| Base de données | DB-POP2-2C-8G (2 vCPU, 8 GB) | €104,68 |
| Object Storage | 15 To standard multi-AZ (@€0,0146/Go) | €219,00 |
| Egress bande passante | ~500 Go/mois | €4,25 |
| GPU IA (plans PRO+) | L4-1-24G (24 GB VRAM) | €547,50 |
| **Total infrastructure** | | **~€1 035/mois** |

**Coût infra par utilisateur :**
- FREE : ~€0,44/utilisateur/mois (stockage seul : 30 Go  €0,0146)
- PRO : ~€4/utilisateur/mois (stockage + quote-part GPU mutualisé)
- BUSINESS : ~€9/utilisateur/mois (stockage 500 Go + GPU dédié)

> Le plan FREE est financé par les utilisateurs payants (modèle freemium). Le ratio 10:1 (10 free pour 1 payant) est viable dès 50 utilisateurs payants.

---

## 4. Plans B2B (organisations)

### 4.1 Modèle de déploiement

Chaque organisation cliente reçoit une **instance dédiée SUPFile** hébergée sur son propre sous-domaine :
```
acme-corp.supfile.tech
mairie-lyon.supfile.tech
chu-bordeaux.supfile.tech
```

L'infrastructure est provisionnée à la demande sur **Scaleway** (standard) ou **Outscale/Numspot** (SecNumCloud — secteur public, défense, santé).

---

### 4.2 Grille tarifaire B2B

#### Tier 1 — PME (jusqu'à 50 utilisateurs)
**1 490 €/mois HT — Marge brute ~45%**

| Ressource | Config Scaleway | Coût infra/mois |
|---|---|---|
| Serveur applicatif | PRO2-S (8 vCPU, 32 GB) | €159,87 |
| Base de données | DB-POP2-2C-8G | €104,68 |
| Object Storage | 1 To | €14,60 |
| GPU IA | 1 L4-1-24G (gemma3:9b) | €547,50 |
| **Total infra** | | **~€826/mois** |
| **Prix facturé** | **Marge ~45%** | **1 490 €/mois** |

Inclus : 50 utilisateurs max, 1 To stockage, IA gemma3:9b, support Standard (email 48h), mises à jour, monitoring

---

#### Tier 2 — ETI (jusqu'à 200 utilisateurs)
**3 490 €/mois HT — Marge brute ~51%**

| Ressource | Config Scaleway | Coût infra/mois |
|---|---|---|
| Serveur applicatif | PRO2-M (16 vCPU, 64 GB) | €319,74 |
| Base de données | DB-POP2-2C-8G (HA répliqué) | €209,36 |
| Object Storage | 5 To | €73,00 |
| GPU IA | 2 L4-1-24G (llama3:8b) | €1 095,00 |
| **Total infra** | | **~€1 697/mois** |
| **Prix facturé** | **Marge ~51%** | **3 490 €/mois** |

Inclus : 200 utilisateurs max, 5 To stockage, IA llama3:8b, support Premium (email 24h), connecteurs SharePoint + Google Workspace inclus, **accès API RAG**

---

#### Tier 3 — Grand Compte (200+ utilisateurs, multi-sites)
**À partir de 8 500 €/mois HT — Marge brute ~47%**

Infrastructure **Outscale SecNumCloud** avec **Kubernetes distribué (OKS)** :

| Ressource | Config Outscale | Coût infra/mois |
|---|---|---|
| OKS Control Plane HA | 3 masters medium (@€0,26/h) | €228,00 |
| Nœuds applicatifs | 4 VM compute optimisé | €800,00 |
| Base de données HA | PostgreSQL cluster répliqué | €400,00 |
| Object Storage | 20 To | €500,00 |
| GPU IA | A100 80 GB (llama3:70b / Qwen 72B) | €2 592,00 |
| **Total infra** | | **~€4 520/mois** |
| **Prix facturé** | **Marge ~47%** | **à partir de 8 500 €/mois** |

Inclus : utilisateurs illimités, stockage illimité, IA llama3:70b ou Qwen 72B, SLA 99,9%, support 24/7, audit de sécurité annuel inclus

---

#### Tier 4 — Enterprise Agentic (sur devis)
**Multi-LLM + GraphRAG — à partir de 20 000 €/mois HT**

Pour les grandes entreprises nécessitant des workflows IA complexes :
- Architecture **multi-agents** (orchestration de plusieurs LLM spécialisés par métier)
- **GraphRAG** (raisonnement sur graphe de connaissances, au-delà du RAG vectoriel simple)
- LLM dédié par département (juridique, finance, RH…)
- Infrastructure GPU H100 (Outscale : ~€4,00–4,80/h = ~€2 880–3 456/GPU/mois)
- Kubernetes multi-région distribué (multi-datacenters OKS)
- Endpoint LLM exposé pour intégration dans les outils métier clients

---

### 4.3 Accès API RAG (Tier 2 et supérieur)

À partir du Tier 2 ETI, le client peut interroger son propre moteur RAG via un **endpoint REST dédié**, sécurisé par API key, pour l'intégrer dans ses outils métier (ERP, CRM, chatbot interne, scripts…).

#### Endpoints exposés

| Endpoint | Description |
|---|---|
| `POST /api/rag/chat` | Question en langage naturel  réponse générée par le LLM basée sur les documents indexés |
| `POST /api/rag/search` | Recherche sémantique brute  retourne les chunks les plus proches avec leur score de distance |

#### Exemple d'usage

```bash
# Interroger Bobby depuis un outil externe
curl -X POST https://acme-corp.supfile.tech/api/rag/chat \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"query": "Quel est le montant du contrat fournisseur X ?"}'
```

#### Conditions d'utilisation

| Critère | Condition |
|---|---|
| **Disponible dès** | Tier 2 ETI (inclus), Tier 3 et Tier 4 |
| **Authentification** | API key rotative générée depuis le dashboard admin |
| **Rate limiting** | 60 req/min par défaut (configurable sur Tier 3/4) |
| **Qualité des réponses** | Sous **responsabilité du client** — dépend des documents indexés et du modèle LLM embarqué |
| **Hallucinations** | SUPFile ne garantit pas l'exactitude des réponses LLM — le client doit implémenter sa propre couche de validation |
| **Données** | Seuls les documents indexés par le client sont accessibles — isolation totale entre organisations |
| **SLA** | Aligné sur le SLA du tier souscrit — aucun SLA supplémentaire sur la couche LLM |
| **Logs** | Toutes les requêtes API sont tracées dans l'audit log du client |

---

### 4.4 Options et add-ons facturables

| Option | Prix |
|---|---|
| Connecteur SharePoint | +290 €/mois |
| Connecteur Google Workspace | +290 €/mois |
| Développement connecteur API custom | Sur devis (TJM ~650 €/j) |
| Stockage supplémentaire | +15 €/To/mois |
| GPU upgrade (LLM tier supérieur) | Sur devis |
| Formation utilisateurs (demi-journée, jusqu'à 20 pers.) | 1 500 € (one-shot) |
| Audit de sécurité renforcé | 3 500 € (annuel) |
| SLA upgrade (99,95%  99,99%) | +20% sur abonnement mensuel |

---

### 4.4 Niveaux de SLA détaillés

| | Tier 1 PME | Tier 2 ETI | Tier 3 Grand Compte | Tier 4 Enterprise |
|---|---|---|---|---|
| **Disponibilité garantie** | 99,5% | 99,7% | 99,9% | 99,95% |
| **Temps de réponse support** | 48h ouvrées | 24h ouvrées | 4h (24/7) | 1h (24/7) |
| **Canal support** | Email | Email + Ticket | Email + Ticket + Tel | Slack dédié + Tel |
| **Temps de rétablissement (RTO)** | 24h | 8h | 4h | 1h |
| **Point de reprise (RPO)** | 24h | 4h | 1h | 15 min |
| **Fenêtre de maintenance** | Samedi 2h–6h | Samedi 2h–4h | Planifiée avec client | Sur validation client |
| **Pénalités si SLA non respecté** | — | Avoir 5% MRR | Avoir 10% MRR | Avoir 15% MRR |
| **Rapport de disponibilité mensuel** |  |  |  |  |
| **Audit de sécurité annuel** |  |  |  inclus |  inclus |

---

### 4.5 Option Standalone (Bring Your Own Infrastructure)

Le client fournit ses propres VMs/GPUs (hyperscalers AWS, Azure, GCP, ou infrastructure privée). SUPFile est livré sous forme de **stack Docker Compose** (petites structures) ou **Helm chart Kubernetes** (production).

#### Conditions contractuelles

| Critère | Condition |
|---|---|
| **Licence** | Annuelle — à partir de **12 000 €/an** (jusqu'à 100 users) / **24 000 €/an** (jusqu'à 500 users) / sur devis au-delà |
| **Mises à jour** | Incluses pendant la durée de la licence (patch de sécurité + minor versions) |
| **Support** | Limité à la couche applicative SUPFile uniquement — les incidents infra, réseau, GPU sont hors périmètre |
| **SLA** | Aucun SLA garanti sur la disponibilité (dépend de l'infra client) |
| **Qualité LLM** | Le client est seul responsable de la qualité des réponses IA (dépend du GPU et du modèle choisi) |
| **Responsabilité données** | Le client est responsable de la conformité RGPD, de la sauvegarde et de la sécurité des données |
| **Hyperscalers** | Compatible AWS S3, Azure Blob, GCP Storage — mais SUPFile ne fournit aucun support sur la couche cloud |
| **Sécurité** | Le chiffrement KEK/DEK reste actif mais la gestion des clés est sous responsabilité client |
| **Audit** | Non inclus — le client peut commander un audit annuel à 3 500 € |
| **Résiliation** | Préavis 3 mois, export des données garanti 30 jours après résiliation |

> **Note** : L'option Standalone est recommandée uniquement aux équipes techniques disposant d'une infrastructure existante et d'une expertise DevOps interne. Pour les autres, le modèle hébergé (Tier 1–4) est fortement conseillé.

---

## 5. Hébergeurs retenus et justification

### Scaleway — Plans B2C et B2B Tier 1/2

| Critère | Détail |
|---|---|
| Localisation | Paris (PAR-1 et PAR-2) |
| Certification | ISO 27001, HDS |
| Object Storage | €0,0146/Go/mois (multi-AZ), egress €0,01/Go (75 Go gratuits/mois) |
| GPU L4 24 GB VRAM | €0,75/h  **€547,50/mois** |
| Instance PRO2-S | €0,219/h  **€159,87/mois** |
| PostgreSQL managé | €0,1434/h  **~€104,68/mois** |
| Avantage clé | Meilleur rapport prix/performance GPU du marché européen |

### Outscale / Numspot — Plans B2B Tier 3/4 et Secteur Public

| Critère | Détail |
|---|---|
| Localisation | France uniquement (Paris, Saint-Omer) |
| Certification | **SecNumCloud qualifié ANSSI** — seule qualification obligatoire pour OIV, santé (HDS), État |
| GPU A100 80 GB | €3,60–4,32/h  **~€2 592–3 110/mois** |
| GPU H100 | €4,00–4,80/h  **~€2 880–3 456/mois** |
| OKS Kubernetes HA | €0,26/h (3 masters medium)  **~€228/mois** |
| Avantage clé | Seul hébergeur permettant de traiter des données sensibles classifiées |

---

## 6. Modèles LLM embarqués et ressources GPU

| Tier | Modèle | VRAM nécessaire (Q4_K_M) | GPU | Coût GPU/mois |
|---|---|---|---|---|
| PRO B2C | gemma3:2b | ~3 GB | L4 24 GB (mutualisé  utilisateurs) | ~€18/user |
| BUSINESS B2C | gemma3:9b | ~7 GB | L4 24 GB | ~€30/user |
| PME Tier 1 | gemma3:9b | ~8 GB | 1 L4 24 GB dédié | €547/mois |
| ETI Tier 2 | llama3:8b | ~8 GB | 2 L4 24 GB dédiés | €1 095/mois |
| Grand Compte Tier 3 | llama3:70b / Qwen 72B | ~42 GB | A100 80 GB | ~€2 800/mois |
| Enterprise Tier 4 | Multi-LLM + GraphRAG | 80–160 GB | 2 A100 ou H100 | ~€5 500–6 900/mois |

> **Q4_K_M** : quantisation 4-bit, réduit les besoins VRAM de ~75% par rapport au FP16 avec une perte de qualité négligeable — standard de production pour l'inférence locale.

---

## 7. Projections financières (estimation Year 1)

### Hypothèses conservatrices B2C

| Jalon | FREE | PRO | BUSINESS | MRR B2C |
|---|---|---|---|---|
| M3 | 200 | 20 | 5 | €324 |
| M6 | 500 | 60 | 15 | €974 |
| M12 | 2 000 | 200 | 50 | **€3 247** |

### Hypothèses conservatrices B2B

| Jalon | PME Tier 1 | ETI Tier 2 | Grand Compte | MRR B2B |
|---|---|---|---|---|
| M6 | 1 | 0 | 0 | €1 490 |
| M12 | 3 | 1 | 0 | €7 960 |
| M18 | 5 | 2 | 1 | **€23 940** |

### MRR Total estimé M12 : **~11 207 €/mois**
### ARR projeté M12 : **~134 000 €**
### ARR projeté M18 (avec 1 Grand Compte) : **~320 000 €**

> Un seul contrat Grand Compte (8 500 €/mois) représente à lui seul 76% du MRR B2C à 12 mois. La stratégie commerciale doit prioriser l'acquisition B2B.

---

## 8. Structure de coûts infrastructure

| Poste | Coût mensuel estimé (500 users B2C actifs) |
|---|---|
| Scaleway compute (backend) | ~€160 |
| GPU mutualisé PRO/BUSINESS | ~€548 |
| Base de données managée | ~€105 |
| Object Storage (15 To) | ~€219 |
| Bande passante egress | ~€20 |
| Monitoring, sauvegardes, SSL | ~€50 |
| **Total infra B2C** | **~€1 102/mois** |

Coût infra B2B Tier 1 : ~€826/mois (dédié par client)
Coût infra B2B Tier 2 : ~€1 697/mois (dédié par client)
Coût infra B2B Tier 3 : ~€4 520/mois (dédié par client, Outscale)

---

## 9. Avantages concurrentiels

| Critère | **SUPFile** | Dropbox Business | Google Workspace | Nextcloud Enterprise |
|---|---|---|---|---|
| Données hébergées en France |  Garanti |  USA |  USA |  Auto-hébergé |
| SecNumCloud (ANSSI) |  Outscale |  |  |  Selon config |
| IA embarquée on-premise |  LLM local |  |  Gemini (cloud US) |  |
| Chiffrement au repos (KEK/DEK) |  AES-256 |  Basique |  Basique |  |
| MFA natif |  TOTP + backup codes |  |  |  |
| Prix PME 50 users | ~1 490 €/mois | ~1 200 €/mois | ~900 €/mois | ~400 €/mois (licence seule) |
| Hébergement managé inclus |  |  |  |  (auto-géré) |

> **Le premium tarifaire vs Nextcloud** est justifié par : hébergement managé clé en main, conformité SecNumCloud sans effort, IA locale souveraine et support SLA — là où Nextcloud nécessite une équipe technique interne dédiée.
