# SUPFile — Liste complète des fonctionnalités

---

## Authentification & Identité

- Inscription avec validation des champs (email, mot de passe min 6 chars)
- Connexion locale email / mot de passe
- Connexion OAuth2 Google
- Connexion OAuth2 GitHub
- Création automatique du compte lors du premier login OAuth
- Gestion des sessions via JWT (avec version de token pour révocation)
- Déconnexion globale (tous les appareils)
- Hash des mots de passe (bcrypt)

### MFA (Multi-Factor Authentication)
- Activation MFA via TOTP (Google Authenticator, Authy…)
- Génération QR code pour setup
- Vérification code TOTP au login
- Codes de récupération (backup codes)
- Régénération des codes de récupération
- Appareils de confiance (skip MFA sur appareil connu)
- Révocation d'un appareil de confiance

---

## Gestion de fichiers

- Upload de fichiers (drag & drop ou sélection)
- Upload multiple (jusqu'à 100 fichiers simultanés)
- Barre de progression par fichier et globale
- Vérification quota avant upload (côté client + côté serveur)
- Détection automatique du type MIME
- Renommage de fichier
- Déplacement de fichier vers un autre dossier
- Marquage / démarquage en favori
- Suppression (soft delete → corbeille)
- Suppression permanente
- Restauration depuis la corbeille
- Corbeille avec affichage des jours restants avant purge (90 jours)
- Téléchargement de fichier unitaire
- Streaming audio / vidéo directement dans le navigateur
- Compteur de visualisations (vues)
- Export de la liste de fichiers en CSV

---

## Gestion de dossiers

- Création de dossier
- Renommage de dossier
- Déplacement de dossier
- Suppression de dossier (soft delete)
- Restauration de dossier depuis la corbeille
- Téléchargement de dossier complet en ZIP (généré à la volée)
- Navigation par fil d'Ariane (breadcrumbs)
- Affichage du contenu supprimé d'un dossier

---

## Prévisualisation

- Prévisualisation d'images (JPG, PNG, GIF, WebP…)
- Prévisualisation PDF
- Prévisualisation fichiers texte (TXT, MD)
- Rendu Markdown avec coloration syntaxique
- Prévisualisation fichiers CSV
- Prévisualisation / édition documents Office (DOCX, XLSX, PPTX) via OnlyOffice
- Streaming vidéo intégré (MP4, AVI, MKV…)
- Streaming audio intégré (MP3, WAV, FLAC…)
- Affichage des métadonnées (taille, date création, date modification, type MIME)

---

## Recherche & Filtres

- Recherche par nom de fichier / dossier
- Recherche dans le contenu indexé des fichiers (PDF, TXT, MD…)
- Recherche sémantique par IA (RAG — si brain-api actif)
- Filtrage par type MIME (images, vidéos, audio, PDF, documents…)
- Filtrage par date (plage from → to)
- Filtrage par taille (min / max)
- Tri par nom, date, taille (croissant / décroissant)
- Recherche d'utilisateurs pour le partage

---

## Partage & Collaboration

### Liens publics
- Génération d'un lien unique public pour un fichier ou un dossier
- Accès au lien sans compte requis
- Protection par mot de passe
- Date d'expiration configurable
- Limite de téléchargements configurable
- Révocation du lien

### Partage interne (entre utilisateurs)
- Partage de dossier avec un utilisateur de la plateforme
- Partage de fichier avec un utilisateur de la plateforme
- Permissions granulaires : lecture, écriture, suppression, re-partage
- Invitation par email si l'utilisateur n'a pas encore de compte
- Acceptation / rejet des partages reçus
- Modification des permissions après partage
- Révocation d'un partage
- Accès streaming et téléchargement sur fichiers partagés

---

## Tags

- Création de tags personnalisés (nom + couleur)
- Application de tags sur les fichiers
- Suppression de tags
- Filtrage des fichiers par tag
- Modification nom / couleur d'un tag

---

## Commentaires

- Ajout de commentaires sur un fichier
- Réponse à un commentaire (thread)
- Modification d'un commentaire
- Suppression d'un commentaire
- Notification en temps réel (WebSocket) lors d'un nouveau commentaire

---

## Versions de fichiers

- Historique des versions d'un fichier
- Restauration d'une version antérieure
- Suppression d'une version

---

## Éditeur de documents (OnlyOffice)

- Édition de fichiers DOCX, XLSX, PPTX directement dans le navigateur
- Sauvegarde automatique via webhook WOPI
- Vérification des droits d'édition avant ouverture

---

## Dashboard

- Graphique de répartition de l'espace disque par type de fichier (PieChart)
- Affichage quota utilisé / quota total avec barre de progression
- Accès rapide aux 5 derniers fichiers modifiés
- Statistiques d'activité (uploads, downloads, partages…)

---

## Paramètres utilisateur

- Modification du prénom, nom
- Modification de l'email
- Upload d'un avatar
- Changement de mot de passe
- Activation / désactivation MFA
- Gestion des appareils de confiance
- Sélection du thème (clair / sombre)
- Sélection de la langue (FR / EN)
- Affichage de l'espace utilisé
- Export de toutes les données personnelles (RGPD)

---

## Coffre-fort (Vault)

- Configuration d'un coffre-fort protégé par mot de passe séparé
- Verrouillage / déverrouillage du coffre
- Rotation du mot de passe du coffre
- Les fichiers vault sont chiffrés avec une clé distincte
- Disponible sur les plans PRO et supérieurs

---

## Notifications

- Centre de notifications (bell)
- Notifications en temps réel via WebSocket
- Marquer une notification comme lue
- Marquer toutes les notifications comme lues
- Suppression de notification
- Push notifications navigateur (Web Push API)
- Types : nouveau commentaire, partage reçu, invitation, quota atteint

---

## Audit & Activité

- Journal d'audit complet de toutes les actions utilisateur
- Filtrage par type d'action
- Statistiques d'activité agrégées
- Timeline visuelle des actions
- Export du journal en CSV
- Événements tracés : login, upload, download, partage, suppression, MFA, changement de mot de passe…

---

## Organisations

- Création d'organisation
- Invitation de membres
- Rôles : Owner, Admin, Member
- Modification de rôle d'un membre
- Suppression d'un membre
- Basculement entre plusieurs organisations

---

## Accès aux comptes (Account Switching)

- Ajout d'un accès à un autre compte
- Basculement vers un compte tiers
- Retour au compte d'origine
- Délégation d'accès avec permissions limitées (lecture, écriture, suppression, partage)
- Révocation d'une délégation

---

## Plans & Facturation

- Plan FREE (stockage limité)
- Plan PRO (100 GB + vault)
- Plan BUSINESS (500 GB + organisations)
- Plan ENTERPRISE (illimité)
- Paiement via Stripe (Checkout Session)
- Portail de gestion d'abonnement Stripe
- Downgrade vers le plan gratuit
- Webhook Stripe pour mise à jour automatique du plan

---

## Administration

- Dashboard admin avec KPIs globaux (utilisateurs, stockage, uploads…)
- Liste de tous les utilisateurs avec filtrage et pagination
- Modification du plan d'un utilisateur
- Export des utilisateurs en CSV
- Export de l'utilisation du stockage en CSV
- Réindexation globale des fichiers pour l'IA

---

## IA — Bobby (assistant documentaire)

- Chat conversationnel avec Bobby
- Réponses basées sur les documents de l'utilisateur (RAG)
- Historique des conversations
- Analyse du contenu d'un fichier spécifique
- Recherche sémantique dans les fichiers
- Génération d'un fichier texte à partir d'un prompt
- Réindexation des fichiers dans la base vectorielle
- Isolation des données par utilisateur (un user ne voit jamais les docs d'un autre)

---

## Sécurité & Chiffrement

- Chiffrement AES-256 de tous les fichiers au repos (architecture KEK/DEK)
- Dérivation de clé PBKDF2 (100 000 itérations)
- Rate limiting sur les routes sensibles (login, register…)
- Headers HTTP sécurisés (Helmet)
- Validation des entrées (express-validator)
- JWT avec révocation par version de token
- Crash au démarrage si JWT_SECRET absent
- Audit log de toutes les actions

---

## Infrastructure & DevOps

- Déploiement via `docker compose up` (une seule commande)
- 7 services Docker : backend, frontend, PostgreSQL, MinIO, brain-api, Ollama, OnlyOffice
- Persistance des données via volumes Docker
- Reverse proxy nginx (frontend, non-root)
- CI/CD via GitHub Actions
- Documentation API interactive (Swagger UI)
- Tâches planifiées (nettoyage automatique corbeille)

---

## Expérience utilisateur

- Interface responsive (desktop, tablette)
- Thème clair / sombre
- Drag & drop pour upload et déplacement de fichiers
- Internationalisation (FR / EN)
- Toasts de notification
- Temps réel (WebSocket) pour notifications et partages
- Application multilingue avec détection automatique de la langue navigateur


