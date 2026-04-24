# SUPFile — Plan de présentation orale

> Durée totale : **20 minutes** de présentation + **10 minutes** de questions/réponses

---

## Ordre de passage & rôles

| # | Qui | Partie | Durée |
|---|---|---|---|
| 1 | **CEO / Directeur Produit** | Introduction groupe, contexte marché, positionnement, stratégie commerciale, coûts RH, projections | **4 min** |
| 2 | **Architecte / Chef de projet** | Architecture Docker, CI/CD, schéma BDD, pipeline Bobby RAG | **3 min** |
| 3 | **Développeur Backend / Sécurité** | Stack backend, JWT, KEK/DEK, MFA, vault, audit log | **3 min** |
| 4 | **Développeur Frontend / Mobile** | React/Vite/Zustand, UX/UI, dark mode, upload, mobile Expo | **3 min** |
| 5 | **Démonstration live** | Parcours utilisateur guidé — 5 étapes prioritaires | **5 min** |
| 6 | **CEO / Directeur Produit** | Clôture en 3 points, invitation aux questions | **2 min** |
| — | **Questions jury** | 10 min, réponses par le membre compétent | **10 min** |

---

## Détail de chaque partie

### 1. CEO — Ouverture (4 min)
- Présentation rapide de l'équipe + rôles (30 sec)
- Le problème : Cloud Act US vs Nextcloud trop technique — le gap du marché
- Les 3 piliers : souveraineté (Scaleway/Outscale) / sécurité by design / IA on-premise
- Stratégie : B2C pour l'acquisition → B2B comme moteur de revenus
- Prix clés : PRO 9,99 €, PME Tier 1 à 1 490 €/mois (marge ~45%), seuil rentabilité 2 PME
- Comparatif concurrentiel (1 slide)
- *Transition* : "Voici comment c'est construit…"

### 2. Architecte / Chef de projet — Architecture & Bobby (3 min)
- Schéma 7 services Docker (1 slide visuel — indispensable)
- CI/CD : SAST Semgrep + TruffleHog + Dockle + SBOM
- Bobby en 3 étapes : text → fastembed → ChromaDB → Ollama (1 slide)
- *Transition* : "Le backend qui tient tout ça…"

### 3. Backend / Sécurité (3 min)
- Architecture 3 couches + réponse API normalisée
- JWT versionné (tokenVersion → déconnexion globale)
- KEK/DEK : PBKDF2 100k iter + AES-256-GCM (le point fort à expliquer)
- MFA TOTP + vault lockout 5 tentatives
- Rate limiting, Helmet, audit 30+ events
- *Transition* : "L'interface que les utilisateurs voient…"

### 4. Frontend / Mobile (3 min)
- React 18 + Vite + Zustand (6 stores) — pas Redux
- Drag & drop global, upload 3 simultanés, AbortController
- Dark mode CSS variables + persisté en BDD
- Palette vert sauge : choix délibéré ≠ bleu générique
- Mobile : Expo SDK 54, expo-secure-store (Keychain/Keystore)
- *Transition* : "On va vous montrer tout ça en live…"

### 5. Démonstration live (5 min)
*Voir [GUIDE_DEMO.md](GUIDE_DEMO.md) pour le script complet.*

**Étapes prioritaires (dans l'ordre) :**
1. Login + MFA (30 sec)
2. Upload drag & drop + progression (45 sec)
3. Partage lien public avec mot de passe (45 sec)
4. Bobby : question sur un document réel (60 sec)
5. Vault : déverrouillage + fichiers chiffrés (30 sec)
6. *(si temps)* Prévisualisation OnlyOffice ou mobile

### 6. CEO — Clôture (2 min)
- Fonctionnel + déployable : `docker compose up`
- Scalable : Kubernetes Outscale SecNumCloud pour les Grand Comptes
- Rentable : seuil à 2 clients PME B2B
- Invitation aux questions

---

## Répartition des questions du jury

| Type de question | Qui répond en priorité |
|---|---|
| Business model, prix, marges | CEO |
| Architecture, Docker, CI/CD | Architecte |
| Sécurité, chiffrement, MFA | Backend/Sécu |
| UI/UX, React, mobile | Frontend/Mobile |
| Bobby, LLM, RAG | Architecte + Backend |
| RGPD, audit, conformité | Backend/Sécu + CEO |

---

## Conseils pour la présentation

- **Dress code** : tenue professionnelle (chemise/veste minimum)
- **Support** : PowerPoint comme fil rouge — les MD sont les notes préparatoires, pas à projeter tels quels
- **Démo** : préparer un compte de démo avec des fichiers pré-chargés (PDF, images, vidéos, DOCX)
- **Timing** : CEO minuteur visible, signal discret entre les membres pour les transitions
- **Questions** : si incertain, renvoyer au membre compétent plutôt que d'improviser
