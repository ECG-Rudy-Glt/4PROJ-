SUPFile
Parcours Utilisateur
Documentation complete des interfaces Web et Mobile
Paul Mazzon · Rudy Gault · Mathis Malzac · Hugo Bouland
4PROJ — Projet de fin d'etudes
2025 – 2026
Technologies :
Web : React 18 + TypeScript + TailwindCSS
Mobile : React Native (Expo) + TypeScript
Backend : Node.js + Express + PostgreSQL + Prisma + MinIO
IA : Python brain-api + Ollama + ChromaDB

Table des Matieres

1. Introduction et Presentation de SUPFile
   SUPFile est une plateforme francaise de stockage cloud souverain developpee dans le cadre du projet 4PROJ par Paul Mazzon, Rudy Gault, Mathis Malzac et Hugo Bouland. Elle se positionne comme une alternative souveraine a Dropbox, Google Drive ou OneDrive.

1.1 Piliers fondamentaux
Souverainete des donnees : stockage sur infrastructure propre (MinIO, S3-compatible), sans dependance aux GAFAM
Securite de bout en bout : chiffrement par modele DEK/KEK — cle de chiffrement protegee par cle derivee du mot de passe utilisateur
Intelligence artificielle integree : assistant Bobby (RAG local via Ollama + ChromaDB) sans appel a des API externes
Conformite RGPD : export des donnees, suppression de compte, journaux d'audit complets
Accessibilite multi-plateforme : application web React (desktop/tablette) et application mobile React Native (iOS/Android)

1.2 Plans disponibles
Plan
Stockage
Fonctionnalites principales
FREE
30 Go
Upload/Download, partage par lien, partage basique
PRO
Augmente
Bobby IA, journal d'audit, coffre-fort securise, versioning avance
BUSINESS
Augmente
Tout le PRO + Organisations, partage avance entre membres
ENTERPRISE
Sur mesure
Fonctionnalites sur mesure, deploiement dedie

SCREEN A CAPTURER — Page d'accueil / landing page de SUPFile (ou la page de connexion Web)

2. Architecture Generale
   SUPFile repose sur une architecture microservices modulaire, deployee via Docker Compose. Le backend expose plus de 100 endpoints repartis en 23 modules de routes, gerant 24 entites en base de donnees PostgreSQL.

2.1 Schema d'architecture
Composant
Technologie
Role
Frontend Web
React 18 + Vite + TailwindCSS
Interface utilisateur desktop/tablette
Application Mobile
React Native + Expo
Interface iOS et Android
API Backend
Node.js + Express + TypeScript
Logique metier, 23 modules, 100+ endpoints
Base de donnees
PostgreSQL 16 + Prisma ORM
Persistance des donnees (24 entites)
Stockage objet
MinIO (S3-compatible)
Stockage des fichiers chiffres
IA / RAG
Python brain-api + Ollama + ChromaDB
LLM local + base vectorielle pour Bobby
Temps reel
Socket.io WebSockets
Mises a jour en direct, notifications
Paiement
Stripe
Abonnements et facturation
Authentification
JWT + OAuth2 + TOTP
Securite multi-couches

3. Parcours d'Authentification
   L'authentification est au coeur de la securite de SUPFile. La plateforme impose le MFA obligatoire pour tous les utilisateurs et supporte plusieurs methodes de connexion.
   3.1 Inscription — Web
   Chemin : /register
   Logo SUPFile : centre en haut (icon-full.svg, 192px)
   Formulaire 4 champs : Prenom, Nom, Email, Mot de passe
   Bouton "S'inscrire" : fond bleu primaire #4F46E5
   Separateur "ou continuer avec" + boutons OAuth Google / GitHub
   Lien "Deja un compte ? Se connecter" en bas
   Indicateur de force du mot de passe en temps reel (rouge → orange → vert)
   Si succes : redirection vers la configuration MFA obligatoire
   Si erreur : toast rouge "Cet email est deja utilise"
   SCREEN A CAPTURER — (WEB) Page /register en mode clair — formulaire et boutons OAuth visibles

3.1b Inscription — Mobile (RegisterScreen)
Card blanche avec ombre (shadows.xl) sur fond gris clair
Logo SUPFile (80x80px) + titre en violet primaire #4F46E5
4 champs : Prenom, Nom, Email, Mot de passe (avec oeil pour afficher/masquer)
Bouton bleu pleine largeur + boutons OAuth Google / GitHub
KeyboardAvoidingView : clavier automatiquement evite
SCREEN A CAPTURER — (MOBILE) RegisterScreen — logo, card blanche, formulaire et boutons OAuth
Mobile — RegisterScreen

3.2 Connexion — Web
Chemin : /login
Logo icon-full.svg (mode clair) / icon-full-light.svg (mode sombre)
Email + Mot de passe (lien "Mot de passe oublie ?" a droite)
Bouton "Se connecter" : fond bleu bg-primary-600
Boutons OAuth Google / GitHub + lien S'inscrire
Gestion des cas : session expiree, compte supprime, MFA requis
SCREEN A CAPTURER — (WEB) Page /login — mode clair ET mode sombre (2 captures)

3.2b Connexion — Mobile (LoginScreen)
Logo (80px) centre + card blanche avec ombre
Champ mot de passe : bouton Voir/Masquer + spinner si chargement
Boutons OAuth + lien "Mot de passe oublie ?"
SCREEN A CAPTURER — (MOBILE) LoginScreen — logo, formulaire complet et boutons OAuth
Mobile — LoginScreen

3.3 Authentification Multi-Facteurs (MFA) — TOTP
MFA OBLIGATOIRE sur toute la plateforme. La modale MFASetupModal s'ouvre automatiquement a la premiere connexion.
Web — Modale MFASetupModal
Etape 1 : QR Code a scanner dans Google Authenticator, Authy, etc.
Etape 2 : Code secret affiche en clair pour saisie manuelle
Etape 3 : Champ TOTP 6 chiffres + bouton "Activer MFA"
Apres validation : modale BackupCodesModal avec 10 codes de secours (avertissement rouge)
Mobile — Configuration MFA
Bouton "Ajouter a l'application d'authentification"
Code secret affiche en texte + bouton Copier
Avertissement jaune : "Conservez ce code en lieu sur"
6 cases de saisie TOTP + bouton Verifier
SCREEN A CAPTURER — (WEB) Modale MFASetupModal — QR code visible ou BackupCodes
SCREEN A CAPTURER — (MOBILE) Ecran de configuration MFA — code secret et cases TOTP
Mobile — Configuration MFA (code secret + 6 cases TOTP)

3.4 Connexion OAuth2 (Google / GitHub)
Clic sur Google/GitHub → navigateur OAuth du fournisseur
Connexion automatique si compte existant, sinon creation automatique + MFA
SCREEN A CAPTURER — (WEB) Boutons OAuth visibles sur la page de connexion

3.5 Reinitialisation du mot de passe
Chemin Web : /forgot-password
Champ email + bouton "Envoyer le lien de reinitialisation"
Chemin Web : /reset-password?token=...
Champ nouveau mot de passe + confirmation + indicateur de force
Mobile : ForgotPasswordScreen et ResetPasswordScreen (card blanche centree)
SCREEN A CAPTURER — (WEB) Page /forgot-password avec le champ email et le bouton
SCREEN A CAPTURER — (MOBILE) Ecran ForgotPasswordScreen
Mobile — ForgotPasswordScreen

4. Tableau de Bord (Dashboard)
   4.1 Dashboard Web
   Chemin : /dashboard
   Layout : sidebar gauche (navigation) + header + contenu principal.
   En-tete : "Bonjour, [Prenom] !" (text-3xl font-bold) + sous-titre
   4 Stats Cards : Total Fichiers / Stockage Utilise / Taille Totale / Types de Fichiers
   Pie Chart (Recharts) : repartition par type avec legende coloree
   Fichiers recents : liste avec icone typee, nom, taille, date — clic → previsualisation
   Sidebar : Logo + liens navigation + avatar + plan + barre de stockage mini
   ActivityLog (PRO) : journal d'activite en temps reel via Socket.io
   SCREEN A CAPTURER — (WEB) Page /dashboard complete — sidebar, 4 stats, pie chart — mode clair
   SCREEN A CAPTURER — (WEB) Meme page en mode sombre

4.2 Dashboard Mobile (DashboardScreen)
Salutation en violet primaire + bouton loupe a droite
3 cartes statistiques : fichiers | espace utilise | espace total
Barre de stockage : bleue < 70% — orange 70-90% — rouge > 90%
PieChart SVG (160px) : slices colorees par type de fichier
Fichiers recents : icone typee, nom tronque, taille + date + chevron
Pull-to-refresh : geste vers le bas pour actualiser
SCREEN A CAPTURER — (MOBILE) DashboardScreen — stats, quota, pie chart et fichiers recents
Mobile — DashboardScreen

5. Gestion des Fichiers et Dossiers
   5.1 Navigation dans les fichiers — Web
   Chemin : /files ou /files/:folderId
   Breadcrumbs : ex. Mes fichiers > Projets > SUPFile > Assets
   Barre d'actions : Upload, Nouveau dossier, Rechercher, Trier, Filtrer
   Modes : Grille (cards) ou Liste (tableau)
   Actions fichier : Renommer, Deplacer, Telecharger, Partager, Favoris, Tag, Versions, Commentaires, Supprimer
   Selection multiple : coches + barre batch (deplacer, supprimer, telecharger ZIP)
   Drag & drop : glisser-deposer depuis le bureau
   SCREEN A CAPTURER — (WEB) Page /files — breadcrumb, barre d'actions — vue liste
   SCREEN A CAPTURER — (WEB) Vue grille avec cards de fichiers

5.1b Navigation dans les fichiers — Mobile (FilesScreen)
Header sticky : "Mes Fichiers" + boutons tri/recherche/ajout
Breadcrumbs scrollables : ex. Racine > Projets > Images
Tags en bandeau : Tous / Famille / Hugo parachute / Speed riding (filtrage instantane)
Chaque fichier : icone typee, nom tronque, taille + date, etoile favori
Tags colores affiches directement sous le nom du fichier
SCREEN A CAPTURER — (MOBILE) FilesScreen — fichiers avec tags colores et filtres visibles
Mobile — FilesScreen (avec tags Famille, Hugo parachute, Speed riding)

5.2 Upload de fichiers
Web
Bouton Upload → selecteur de fichiers systeme
Drag & drop directement sur la zone de fichiers
Barre de progression par fichier + indicateur global en pourcentage
Upload multiple simultane + toast de succes
Mobile
Bouton + dans le header : ActionSheet → galerie photos / appareil photo / Fichiers
Progression affichee dans une barre en haut de l'ecran
SCREEN A CAPTURER — (WEB) Progression d'upload en cours — barre de progression visible

5.3 Creation de dossiers
Bouton "Nouveau dossier" dans la barre d'actions (Web) ou header (Mobile)
Modale NewFolderModal : champ nom + bouton Annuler / Creer
Validation en temps reel + apparition instantanee sans rechargement
SCREEN A CAPTURER — (WEB) Modale NewFolderModal
SCREEN A CAPTURER — (MOBILE) NewFolderModal — champ nom du dossier avec clavier
Mobile — NewFolderModal (champ Nom du dossier + clavier)

5.4 Renommer et Deplacer
Renommer Web : menu contextuel → champ inline ou modale
Deplacer Web : menu 3 points → modale avec arborescence navigable
Mobile — ItemActionsSheet : bottom sheet avec toutes les options par appui long
Fichier : Selectionner / Renommer / Deplacer / Partager / Tags / Commentaires / Versions / Telecharger / Supprimer
Dossier : Selectionner / Renommer / Deplacer / Partager / Telecharger en ZIP / Supprimer
SCREEN A CAPTURER — (MOBILE) ItemActionsSheet fichier — toutes les options visibles
Mobile — ItemActionsSheet fichier (GX018031.MP4)
SCREEN A CAPTURER — (MOBILE) ItemActionsSheet dossier — options specifiques aux dossiers
Mobile — ItemActionsSheet dossier (Hugo)

5.5 Suppression et Corbeille
Suppression soft delete : element envoye a la corbeille, pas supprime definitivement
Web — /trash
Liste avec date de suppression + bouton Restaurer + bouton Supprimer definitivement
Bouton "Vider la corbeille" en haut
Mobile — TrashScreen
Liste avec icone fleche retour (restaurer) et croix rouge (supprimer)
Bouton "Vider" en haut a droite
SCREEN A CAPTURER — (WEB) Page /trash — fichiers supprimes + boutons Restaurer / Supprimer
SCREEN A CAPTURER — (MOBILE) TrashScreen — liste avec boutons restaurer et supprimer
Mobile — TrashScreen (4 fichiers supprimes le 20 mai)

5.6 Fichiers Favoris
Web (/favorites) : etoile jaune — page dedicee dans la sidebar — toggle instant
Mobile : etoile accessible depuis chaque item de la liste de fichiers
SCREEN A CAPTURER — (WEB) Page /favorites — liste de fichiers etoiles

5.7 Versions des fichiers
Web — VersionHistory : panel lateral avec liste chronologique des versions (date, taille, version actuelle)
Actions : Restaurer ou Supprimer une version specifique
Mobile — VersionsPanel : bottom sheet avec meme fonctionnalite
SCREEN A CAPTURER — (WEB) VersionHistory — plusieurs versions listees chronologiquement

5.8 Tags et organisation
Web
Creation depuis Parametres ou depuis un fichier directement
Chaque tag : nom + couleur (palette)
TagSelector : dropdown pour ajouter/retirer — badges colores dans la liste
Mobile — TagsPicker
Bottom sheet : palette de couleurs + champ nom + bouton +
Tags disponibles avec toggle (coche) pour ajouter/retirer
Appui long sur un tag pour le supprimer
SCREEN A CAPTURER — (WEB) TagSelector — tags colores visibles sur un fichier
SCREEN A CAPTURER — (MOBILE) TagsPicker — palette + tags disponibles (Hugo parachute coche, Speed riding, Famille)
Mobile — TagsPicker (palette de couleurs et liste de tags)

5.9 Previsualisation des fichiers
Web — FilePreviewModal + OfficePreview
Images : affichage direct avec zoom
PDF : visionneuse PDF integree
Office (Word, Excel, PPT) : previsualisation via OnlyOffice integre
Videos / Audio : lecteurs HTML5 natifs
Header : nom, taille, date + boutons Telecharger / Partager / Fermer
Mobile — FilePreviewModal
Modale plein ecran + pinch-to-zoom pour images
Barre inferieure : Telecharger / Favori / Partager / Supprimer
Infos fichier : Taille, Type, Cree le, Modifie le
SCREEN A CAPTURER — (WEB) FilePreviewModal — image ou PDF ouvert
SCREEN A CAPTURER — (WEB) OnlyOffice Preview — document Word ouvert
SCREEN A CAPTURER — (MOBILE) FilePreviewModal — image avec barre d'actions Telecharger/Favori/Partager/Supprimer
Mobile — FilePreviewModal (IMG_1468.jpeg — 7.0 Mo — image/jpeg)

5.10 Telechargement
Menu contextuel / barre batch / previsualisation → bouton Telecharger
Dossier entier : telecharge en ZIP (GET /api/folders/:folderId/download)
Fichier unique : telechargement direct — dechiffre a la volee
Selection multiple : batch ZIP genere cote serveur

6. Partage et Collaboration
   6.1 Liens de partage public
   Accessible depuis le menu contextuel → Partager → onglet Lien public.
   Generation : token UUID unique par fichier
   Options : mot de passe optionnel / date d'expiration / max telechargements
   Bouton "Copier le lien" + liste des liens existants
   Liens bundle : plusieurs fichiers en un seul lien
   SCREEN A CAPTURER — (WEB) ShareFileModal — onglet Lien public avec options et lien genere
   SCREEN A CAPTURER — (MOBILE) ShareModal — onglet Lien public (option PRO pour mot de passe, champ telechargements max)
   Mobile — ShareModal onglet Lien public (IMG_1454.jpeg)

6.2 Partage avec d'autres utilisateurs
Web — onglet Partager avec dans ShareFileModal.
4 permissions : Lecture / Ecriture / Suppression / Partage
Invitation → notification au destinataire + liste des partages actifs
SCREEN A CAPTURER — (WEB) ShareFileModal — onglet Partager avec, utilisateur et permissions
SCREEN A CAPTURER — (MOBILE) ShareModal — onglet Utilisateur (email + 4 permissions cochables)
Mobile — ShareModal onglet Utilisateur (IMG_1454.jpeg — permissions : Lecture coche)

6.3 Partage de dossiers entre utilisateurs
Page /shared avec 3 onglets : En attente / Avec moi / Par moi.
En attente : invitations recues avec boutons Accepter (vert) / Refuser (rouge)
Avec moi : dossiers/fichiers partages par d'autres + permissions
Par moi : partages envoyes avec statut + boutons Modifier / Revoquer
PendingSharesModal : badge rouge sur la cloche → modale des invitations
SCREEN A CAPTURER — (WEB) Page /shared — onglets et invitations en attente
SCREEN A CAPTURER — (MOBILE) SharedScreen — onglet En attente avec invitation de Franck Bouland
Mobile — SharedScreen (IMG_1530.png de Franck Bouland — En attente)

6.4 Gestion des permissions
Composant PermissionsManager : 4 toggles Lecture / Ecriture / Suppression / Repartage. Modification en temps reel.
SCREEN A CAPTURER — (WEB) PermissionsManager — 4 cases a cocher

6.5 Protection par mot de passe des partages
Option a la creation du partage (lien ou direct)
Acces → ShareUnlockModal : champ mot de passe, 5 tentatives max avant blocage
SCREEN A CAPTURER — (WEB) ShareUnlockModal — page de deverrouillage

6.6 Acces a un lien partage (vue invite)
Chemin : /share/:token
Logo + nom du fichier + proprietaire + bouton Telecharger
Si protege : champ mot de passe — si expire/quota atteint : message d'erreur
SCREEN A CAPTURER — (WEB) Page /share/:token — vue invite sans connexion

6.7 Commentaires sur les fichiers
Web — CommentsPanel
Panel lateral : avatar, prenom, date, texte, reponses imbriquees
Champ "Ajouter un commentaire" + bouton Envoyer
Mobile — CommentsPanel
Bottom sheet ou section dans FilePreviewModal
SCREEN A CAPTURER — (WEB) CommentsPanel — commentaires et reponses visibles
SCREEN A CAPTURER — (MOBILE) CommentsPanel — bottom sheet avec commentaires et champ de saisie
Mobile — CommentsPanel (Rudy Gault — "Ceci est un deuxieme commentaire" / "Hello")

6.8 Notifications de partage
Web : cloche + badge rouge → NotificationCenter : texte, date relative, marquer lu
Types : partage recu / nouveau commentaire / alerte quota 90%
Mobile : notifications push Expo (voir section 16)
SCREEN A CAPTURER — (WEB) NotificationCenter ouvert avec plusieurs notifications

7. Bobby — L'Assistant IA
   Disponible pour : plans PRO, BUSINESS et ENTERPRISE
   Bobby est un assistant IA base sur une architecture RAG 100% locale via Ollama et ChromaDB. Aucune donnee ne quitte le serveur.

7.1 Interface de chat IA
Web — /ai
Interface style messagerie : messages utilisateur a droite (bleu), Bobby a gauche
Avatar Bobby : idle en attente, working.gif pendant la reflexion
Historique des conversations + bouton Nouvelle conversation
Mobile — Onglet Bobby
Meme interface adaptee au mobile
Si plan FREE : affiche "Bobby est inclus a partir du plan PRO" + bouton Voir les plans
SCREEN A CAPTURER — (WEB) Interface Bobby — conversation ouverte
SCREEN A CAPTURER — (MOBILE) AIScreen Bobby — ecran plan PRO requis OU conversation active
Mobile — AIScreen Bobby (plan PRO requis — "Voir les plans")

7.2 Analyse de fichiers par IA
Depuis FilePreviewModal → "Analyser avec Bobby" OU depuis le chat
Bobby retourne : resume, points cles, informations importantes
Formats : PDF, Word, Excel, fichiers texte
SCREEN A CAPTURER — (WEB) Resultat d'une analyse de fichier dans Bobby

7.3 Recherche semantique / IA
Web : toggle "Recherche IA" sur la SearchBar → requete en langage naturel → resultats ChromaDB avec score
Mobile : SearchBar avec mode semantique et resultats temps reel
SCREEN A CAPTURER — (WEB) SearchBar mode IA — resultats semantiques

7.4 Generation de fichiers par IA
Depuis Bobby : "Genere un document sur [sujet]"
Fichier cree et sauvegarde directement dans les fichiers de l'utilisateur

8. Coffre-Fort Securise (Vault)
   Disponible pour : plans PRO et superieurs
   Double protection : les fichiers du vault sont chiffres avec un mot de passe supplementaire independant du compte.

8.1 Web — /settings
Etat initial : bouton "Configurer" + champ mot de passe + code TOTP
Etat verrouille : badge Verrouille + bouton Deverrouiller (mot de passe + TOTP)
Etat deverrouille : badge + minuteur de session + acces dossier Vault + bouton Verrouiller
SCREEN A CAPTURER — (WEB) Section Vault dans les parametres — etat verrouille
8.2 Mobile — VaultScreen
Etats : idle / setup / unlock / rotate
Chaque etat : champs mot de passe + code TOTP 6 chiffres
SCREEN A CAPTURER — (MOBILE) VaultScreen — champs de configuration ou deverrouillage
[IMAGE A INTEGRER : VaultScreen — a integrer]

9. Recherche
   9.1 Web — SearchBar
   Par nom : suggestions temps reel des 2 caracteres
   Full-text : dans le contenu des fichiers indexes
   IA : requete langage naturel (PRO+)
   Filtres : type / dossier parent / plage de dates / tags
   SCREEN A CAPTURER — (WEB) SearchBar — dropdown avec resultats de recherche
   9.2 Mobile — SearchBar
   Overlay plein ecran avec resultats filtres en temps reel
   SCREEN A CAPTURER — (MOBILE) SearchBar mobile en overlay avec resultats

10. Parametres et Profil Utilisateur
    10.1 Edition du profil — Web
    Informations : Prenom, Nom, Email (lecture seule)
    Avatar : uploadable (clic → selecteur)
    Stockage : barre de progression + lien Ameliorer le plan
    SCREEN A CAPTURER — (WEB) Section profil dans /settings

10.2 Changement de mot de passe
Mot de passe actuel + nouveau + confirmation + Code MFA obligatoire
SCREEN A CAPTURER — (WEB) Section changement de mot de passe

10.3 Theme clair / sombre
Web : toggle Soleil/Lune — instantane — persistant (localStorage + base)
Mobile : toggle dans les parametres (useThemeStore Zustand) + Light/Dark/System
SCREEN A CAPTURER — (WEB) Toggle de theme dans les parametres — mode sombre actif

10.4 Configuration MFA — Web (MFASettingsSection)
Si active : badge vert Actif + Desactiver MFA + Regenerer les codes de secours
Si desactive : bouton Activer MFA → QR code setup
Appareils de confiance : liste + date derniere utilisation + bouton Revoquer
SCREEN A CAPTURER — (WEB) Section MFA — badge Actif + appareils de confiance
Mobile — Panneau MFA dans SettingsScreen
Bottom sheet "Authentification a deux facteurs"
Si active : badge MFA active (coche) + codes restants + appareils de confiance
Boutons : Regenerer les codes de recuperation + Desactiver le MFA (rouge)
SCREEN A CAPTURER — (MOBILE) SettingsScreen avec panneau MFA — MFA active, 10 codes restants
Mobile — SettingsScreen (panneau MFA active — Regenerer / Desactiver)

10.5 Coffre-fort dans les parametres
Voir Section 8 pour les details complets.
10.6 Conformite RGPD — RGPDSection
Export : bouton Telecharger mes donnees → ZIP metadonnees JSON
Suppression : bouton rouge + confirmation double (mot de passe + texte SUPPRIMER)
SCREEN A CAPTURER — (WEB) Section RGPD — boutons Export et Suppression
10.7 Langue
Web : selecteur Francais / English — instantane
Mobile : selecteur dans parametres (useI18nStore)

11. Abonnements et Plans
    11.1 Web — /plans
    4 cards cote a cote : FREE / PRO / BUSINESS / ENTERPRISE. Chaque card : nom, prix, badge Plan actuel, fonctionnalites avec icones, bouton Stripe.
    Plan
    Stockage
    Bobby IA
    Audit
    Coffre
    Orgas
    FREE
    30 Go
    Non
    Non
    Non
    Non
    PRO
    Augmente
    Oui
    Oui
    Oui
    Non
    BUSINESS
    Augmente
    Oui
    Oui
    Oui
    Oui
    ENTERPRISE
    Sur mesure
    Oui
    Oui
    Oui
    Oui

Stripe Checkout pour S'abonner + Stripe Portal pour Gerer
SCREEN A CAPTURER — (WEB) Page /plans — 4 cards avec plan actuel mis en evidence

11.2 Mobile — PlansModal
Modal plein ecran ou bottom sheet — meme presentation
SCREEN A CAPTURER — (MOBILE) PlansModal — 4 plans
[IMAGE A INTEGRER : PlansModal — a integrer]

12. Organisations et Multi-Tenants
    Disponible pour : plans BUSINESS et superieurs

12.1 Web — /organization-admin
Creation : bouton → modale nom → utilisateur devient OWNER automatiquement
Role
Description
Droits
OWNER
Proprietaire
Tous droits, suppression organisation
ADMIN
Administrateur
Gestion membres et fichiers partages
MEMBER
Membre standard
Acces selon les permissions

Inviter un membre : email + role — Modifier role : dropdown — Retirer : bouton
Switcher : Compte personnel ↔ Organisation [Nom] dans header/sidebar
SCREEN A CAPTURER — (WEB) /organization-admin — liste des membres avec roles et actions

13. Journal d'Audit
    Disponible pour : plans PRO et superieurs

13.1 Web — /audit
Colonne
Description
Date/Heure
Horodatage precis de l'action
Utilisateur
Avatar + nom
Action
UPLOAD, DOWNLOAD, DELETE, LOGIN, SHARE_CREATE, PASSWORD_CHANGE, VAULT_UNLOCK...
Ressource
Nom du fichier ou dossier
IP
Adresse IP de provenance

Filtres : type d'action / utilisateur / plage de dates — Export CSV — Pagination
13.2 Mobile — AuditScreen
Liste scrollable + memes filtres adaptes
SCREEN A CAPTURER — (WEB) /audit — tableau d'activite filtre avec plusieurs entrees
SCREEN A CAPTURER — (MOBILE) AuditScreen — liste des entrees d'audit
[IMAGE A INTEGRER : AuditScreen — a integrer]

14. Delegation et Changement de Compte
    14.1 Delegation
    Permet a un utilisateur A de donner des permissions a B pour acceder a ses fichiers sans partager son mot de passe.
    Creer : selectionner utilisateur + 4 permissions granulaires
    Assumer : l'utilisateur B voit "Acceder aux fichiers de [A]" → sous-session

14.2 Changement de Compte (AccountSwitcherModal)
Accessible depuis l'avatar en bas de la sidebar
Liste des comptes lies + bouton Ajouter un compte (lien de switch)
Switch → sous-session + bouton Retour au compte principal
SCREEN A CAPTURER — (WEB) AccountSwitcherModal — comptes lies

15. Panel Administrateur
    Accessible uniquement aux utilisateurs role ADMIN

15.1 Web — /admin
Stats globales : utilisateurs / stockage total / fichiers — graphiques d'activite
Tableau users : avatar, nom, email, plan, statut ACTIVE/SUSPENDED, date inscription
Actions : Activer/Suspendre (badge vert/rouge) / Modifier role / Forcer plan
Export CSV utilisateurs + Export CSV stockage
Reindexation IA : bouton → relance embeddings ChromaDB pour tous les utilisateurs
SCREEN A CAPTURER — (WEB) /admin — tableau utilisateurs avec filtres et actions
15.2 Mobile — AdminScreen
Vue simplifiee stats + liste utilisateurs + memes actions
SCREEN A CAPTURER — (MOBILE) AdminScreen
[IMAGE A INTEGRER : AdminScreen — a integrer]

16. Notifications
    16.1 Centre de Notifications — Web
    Cloche dans le header + badge rouge
    Contenu : icone typee + texte descriptif + date relative + bouton Marquer comme lu
    Bouton Tout marquer comme lu — Clic → navigation vers l'element
    SCREEN A CAPTURER — (WEB) NotificationCenter ouvert — plusieurs notifications typees

16.2 Push Notifications — Mobile (Expo Push)
Activation a la premiere utilisation (permission iOS/Android)
Types : nouveau partage / commentaire / alerte quota 90-100%
Clic : ouverture directe de l'ecran concerne (deep link Expo)

16.3 Web Push (navigateur)
Opt-in apres connexion — notifications systeme en arriere-plan

17. Recapitulatif — Tous les Screens a Capturer
    17.1 Web — 40 captures

#

Screen / Etat
URL / Composant
1
Page de connexion (mode clair)
/login
2
Page de connexion (mode sombre)
/login dark
3
Page d'inscription
/register
4
Modale MFA Setup (QR code)
MFASetupModal
5
Modale Backup Codes (10 codes)
BackupCodesModal
6
Page verification MFA
/mfa-verify
7
Page mot de passe oublie
/forgot-password
8
Dashboard complet (mode clair)
/dashboard
9
Dashboard (mode sombre)
/dashboard dark
10
Fichiers — vue liste
/files (list)
11
Fichiers — vue grille
/files (grid)
12
Progression d'upload
UploadProgressBar
13
Modale nouveau dossier
NewFolderModal
14
Menu contextuel fichier
ContextMenu
15
Previsualisation image ou PDF
FilePreviewModal
16
OnlyOffice Preview — Word
OfficePreview
17
Historique des versions
VersionHistory
18
CommentsPanel avec threads
CommentsPanel
19
TagSelector — tags colores
TagSelector
20
Page Favoris
/favorites
21
Page Corbeille
/trash
22
ShareModal — lien public
ShareFileModal (lien)
23
ShareModal — partage utilisateur
ShareFileModal (user)
24
Vue invite sans connexion
/share/:token
25
Page invitations de partage
/shared
26
ShareUnlockModal
ShareUnlockModal
27
PermissionsManager (4 toggles)
PermissionsManager
28
Bobby — chat IA
AI /ai
29
Bobby — recherche semantique
SearchBar IA
30
Parametres — profil
/settings (profil)
31
Parametres — MFA
/settings (MFA)
32
Parametres — Vault
/settings (vault)
33
Parametres — RGPD
/settings (RGPD)
34
Parametres — theme sombre
/settings (theme)
35
Page plans (4 cards)
/plans
36
Organisation admin
/organization-admin
37
Journal d'audit
/audit
38
AccountSwitcherModal
AccountSwitcherModal
39
Panel administrateur
/admin
40
NotificationCenter
NotificationCenter

17.2 Mobile — 19 captures

#

Screen
Composant
Image integree
1
LoginScreen
LoginScreen
✓ integre
2
RegisterScreen
RegisterScreen
✓ integre
3
MfaVerifyScreen (6 cases)
MfaVerifyScreen
A capturer
4
ForgotPasswordScreen
ForgotPasswordScreen
✓ integre
5
DashboardScreen
DashboardScreen
✓ integre
6
FilesScreen (avec tags)
FilesScreen
✓ integre
7a
ItemActionsSheet fichier
ItemActionsSheet
✓ integre
7b
ItemActionsSheet dossier
ItemActionsSheet
✓ integre
8
NewFolderModal
NewFolderModal
✓ integre
9
FilePreviewModal image
FilePreviewModal
✓ integre
10
CommentsPanel
CommentsPanel
✓ integre
11
TagsPicker
TagsPicker
✓ integre
12
TrashScreen
TrashScreen
✓ integre
13
SharedScreen
SharedScreen
✓ integre
14
AIScreen Bobby
AIScreen
✓ integre
15
VaultScreen
VaultScreen
A capturer
16
SettingsScreen + MFA
SettingsScreen
✓ integre
17
PlansModal
PlansModal
A capturer
18
AuditScreen
AuditScreen
A capturer
19
AdminScreen
AdminScreen
A capturer

18. Conclusion
    SUPFile represente une solution complete et mature de stockage cloud developpee entierement par Paul Mazzon, Rudy Gault, Mathis Malzac et Hugo Bouland dans le cadre du projet 4PROJ.

18.1 Bilan du parcours utilisateur
Coherence Web / Mobile : experience unifiee, charte graphique commune (indigo/violet, mode sombre)
Securite a chaque etape : MFA obligatoire, chiffrement DEK/KEK, coffre-fort, delegations granulaires
IA integree (Bobby) : analyse, recherche semantique, generation documentaire — 100% local et confidentiel
Conformite RGPD native : export de donnees et suppression de compte integres nativement
Scalabilite : deploiement Docker Compose sur VPS sans dependance cloud

Le parcours est concu pour etre intuitif pour un non-technicien tout en offrant des fonctionnalites avancees (vault, delegations, audit) accessibles progressivement.

18.2 Points forts techniques
100+ endpoints REST : 23 modules de routes, architecture modulaire
24 entites PostgreSQL : modelisation complete via Prisma ORM
RAG 100% local : Ollama + ChromaDB, zero dependance IA externe
Chiffrement DEK/KEK : securite de bout en bout sur tous les fichiers
WebSockets Socket.io : temps reel pour uploads, notifications, commentaires
Multi-plateforme : React 18 (Web) + React Native Expo (iOS & Android)
