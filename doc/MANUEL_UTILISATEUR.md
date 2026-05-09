# SUPFile — Manuel utilisateur

> Version 1.0 — Avril 2026

---

## Table des matières

1. [Premiers pas](#1-premiers-pas)
2. [Connexion & Authentification](#2-connexion--authentification)
3. [Dashboard](#3-dashboard)
4. [Gestion des fichiers](#4-gestion-des-fichiers)
5. [Gestion des dossiers](#5-gestion-des-dossiers)
6. [Prévisualisation & édition](#6-prévisualisation--édition)
7. [Recherche & filtres](#7-recherche--filtres)
8. [Partage](#8-partage)
9. [Tags](#9-tags)
10. [Commentaires](#10-commentaires)
11. [Versions de fichiers](#11-versions-de-fichiers)
12. [Coffre-fort (Vault)](#12-coffre-fort-vault)
13. [Notifications](#13-notifications)
14. [Bobby — Assistant IA](#14-bobby--assistant-ia)
15. [Paramètres du compte](#15-paramètres-du-compte)
16. [Plans & Facturation](#16-plans--facturation)
17. [Administration](#17-administration)
18. [Application mobile](#18-application-mobile)

---

## 1. Premiers pas

SUPFile est une plateforme de stockage cloud sécurisée, hébergée en France. Vos fichiers sont chiffrés au repos et accessibles depuis n'importe quel navigateur ou depuis l'application mobile iOS/Android.

### Création de compte

1. Rendez-vous sur la page d'accueil et cliquez sur **S'inscrire**
2. Renseignez votre prénom, nom, adresse email et un mot de passe (minimum 6 caractères)
3. Cliquez sur **Créer mon compte**
4. Vous êtes automatiquement connecté et redirigé vers le Dashboard

>  **SCREENSHOT À INSÉRER**
> _Page d'inscription (`/register`) — formulaire avec les champs Prénom, Nom, Email, Mot de passe, Confirmer le mot de passe, et le bouton "Créer mon compte". Montrer également les liens vers les connexions OAuth Google et GitHub en bas du formulaire._

**Connexion via Google ou GitHub :** Cliquez sur le bouton correspondant — votre compte est créé automatiquement lors du premier login.

---

## 2. Connexion & Authentification

### Connexion standard

1. Saisissez votre adresse email et votre mot de passe
2. Cliquez sur **Se connecter**

>  **SCREENSHOT À INSÉRER**
> _Page de connexion (`/login`) — champs Email et Mot de passe remplis (masqué), bouton "Se connecter", boutons OAuth Google et GitHub visibles en bas._

### MFA — Double authentification

Si vous avez activé le MFA (voir [Paramètres](#15-paramètres-du-compte)), une étape supplémentaire s'affiche après la saisie du mot de passe.

>  **SCREENSHOT À INSÉRER**
> _Écran de vérification MFA — les 6 cases de saisie du code TOTP bien visibles, texte explicatif "Saisissez le code affiché dans votre application d'authentification"._

1. Ouvrez votre application d'authentification (Google Authenticator, Authy…)
2. Saisissez le code à 6 chiffres affiché
3. Le code expire toutes les 30 secondes — si vous manquez la fenêtre, attendez le prochain

**Codes de récupération :** Si vous n'avez plus accès à votre application, utilisez un code de récupération (généré lors de l'activation du MFA).

### Appareils de confiance

Cochez **"Se souvenir de cet appareil"** lors de la vérification MFA pour ne plus saisir le code pendant 30 jours sur cet appareil.

---

## 3. Dashboard

Le Dashboard est votre page d'accueil une fois connecté. Il vous donne une vue globale de votre espace.

>  **SCREENSHOT À INSÉRER**
> _Page Dashboard complète (`/dashboard`) — le PieChart de répartition par type de fichier à gauche, les 4 cartes statistiques (total fichiers, stockage utilisé, taille totale, types), la barre de quota avec pourcentage, et la liste des 5 fichiers récents en bas. Prendre en mode clair._

### Éléments affichés

- **Répartition de l'espace** : graphique en anneau par type de fichier (images, vidéos, PDF, documents, autres)
- **Statistiques** : nombre total de fichiers, espace utilisé / quota total, taille totale, nombre de types distincts
- **Barre de quota** : verte (< 75%), orange (75–90%), rouge (> 90%)
- **Fichiers récents** : les 5 derniers fichiers modifiés, cliquables pour ouvrir la prévisualisation

---

## 4. Gestion des fichiers

### Naviguer dans vos fichiers

Cliquez sur **Fichiers** dans la barre latérale gauche. Vous voyez le contenu de votre dossier racine.

>  **SCREENSHOT À INSÉRER**
> _Page Fichiers (`/files`) — vue avec plusieurs dossiers et fichiers listés. Le fil d'Ariane (breadcrumbs) visible en haut avec "Accueil > Dossier X". La barre de recherche visible dans le header. Prendre avec au moins 3 dossiers et 4 fichiers visibles._

**Fil d'Ariane (breadcrumbs) :** En haut de la liste, le chemin de navigation vous indique votre position. Cliquez sur n'importe quel dossier parent pour y revenir.

### Uploader des fichiers

**Méthode 1 — Glisser-déposer**
Faites glisser un ou plusieurs fichiers depuis votre ordinateur directement sur la fenêtre du navigateur. Un overlay bleu/sombre apparaît pour confirmer que le dépôt est reconnu.

>  **SCREENSHOT À INSÉRER**
> _Overlay drag & drop actif — fond semi-transparent sombre couvrant toute la fenêtre, icône upload centrale, texte "Déposez vos fichiers ici". Un fichier est en train d'être glissé (curseur visible si possible)._

**Méthode 2 — Bouton upload**
Cliquez sur le bouton **+** (en bas à droite de la page Fichiers) pour ouvrir le sélecteur de fichiers système.

**Suivi de la progression**

>  **SCREENSHOT À INSÉRER**
> _Modal d'upload en cours — au moins 2 fichiers affichés, l'un avec une barre de progression à ~60% (texte du pourcentage visible), l'autre terminé avec une icône  verte. Le bouton "Annuler tout" visible en bas._

La modal d'upload affiche pour chaque fichier :
- Son nom et sa taille
- Une barre de progression individuelle
- Un icône de statut : en cours (spinner), terminé ( vert), erreur ( rouge)

Vous pouvez annuler un upload individuel ou tous les uploads en cours.

### Actions sur un fichier

Faites un clic droit sur un fichier (ou cliquez sur le menu ****) pour accéder aux actions :

>  **SCREENSHOT À INSÉRER**
> _Menu contextuel d'un fichier ouvert — liste des actions : Renommer, Déplacer, Télécharger, Ajouter aux favoris, Partager, Supprimer. Menu positionné à droite du fichier._

| Action | Description |
|---|---|
| **Renommer** | Modifier le nom du fichier |
| **Déplacer** | Sélectionner un dossier de destination |
| **Télécharger** | Télécharger le fichier sur votre ordinateur |
| **Favoris** | Ajouter / retirer des favoris |
| **Partager** | Créer un lien public ou un partage interne |
| **Supprimer** | Envoyer en corbeille (récupérable pendant 90 jours) |

### Déplacer par glisser-déposer

Glissez un fichier ou un dossier directement sur un dossier de destination dans la liste — le dossier cible se surbrille en bleu. Relâchez pour déplacer.

### Favoris

Les fichiers marqués en favori sont accessibles depuis **Favoris** dans la barre latérale.

### Corbeille

>  **SCREENSHOT À INSÉRER**
> _Page Corbeille (`/trash`) — liste de fichiers supprimés avec pour chaque fichier : son nom, sa taille, et la mention "Supprimé dans X jours" (ex: "Supprimé dans 87 jours"). Boutons Restaurer et Supprimer définitivement visibles._

Les fichiers supprimés sont conservés 90 jours avant suppression définitive automatique. Depuis la Corbeille :
- Cliquez **Restaurer** pour remettre le fichier à son emplacement d'origine
- Cliquez **Supprimer définitivement** pour l'effacer immédiatement

---

## 5. Gestion des dossiers

### Créer un dossier

Dans la page Fichiers, cliquez sur l'icône **Nouveau dossier** (icône dossier+ dans le header). Saisissez un nom et validez.

### Renommer, déplacer, supprimer

Même principe que pour les fichiers : clic droit ou menu **** sur le dossier.

### Télécharger un dossier en ZIP

Faites un clic droit sur un dossier  **Télécharger**. L'archive ZIP est générée à la volée côté serveur et téléchargée automatiquement.

---

## 6. Prévisualisation & édition

Cliquez sur n'importe quel fichier pour l'ouvrir en prévisualisation.

### Images

>  **SCREENSHOT À INSÉRER**
> _Modal de prévisualisation d'une image — une photo bien visible, centrée dans la modal. Boutons "Télécharger" et "Fermer" visibles. Métadonnées (nom, taille, date) affichées sous l'image ou dans un panneau latéral._

### Vidéo et Audio

Le lecteur vidéo/audio intégré permet de lire le contenu sans télécharger le fichier. Les formats MP4, AVI, MKV, MP3, WAV, FLAC sont supportés.

>  **SCREENSHOT À INSÉRER**
> _Lecteur vidéo intégré — barre de contrôle (play/pause, progression, volume, plein écran) visible en bas de la vidéo. La vidéo affiche une première frame._

### PDF

>  **SCREENSHOT À INSÉRER**
> _Prévisualisation PDF — document affiché inline dans la modal, texte du document lisible (pas une page blanche). Si possible montrer un PDF avec du texte et une mise en forme._

### Markdown & Code

Les fichiers `.md` sont rendus avec mise en forme complète (titres, listes, code, liens). Les fichiers code source sont affichés avec coloration syntaxique.

### Documents Office (DOCX, XLSX, PPTX)

>  **SCREENSHOT À INSÉRER**
> _Éditeur OnlyOffice ouvert sur un fichier DOCX — barre d'outils Office (police, taille, gras, etc.) visible en haut, contenu du document affiché et éditable. Le nom du fichier visible dans la barre de titre._

Les fichiers Office s'ouvrent dans l'éditeur **OnlyOffice** intégré directement dans le navigateur. Les modifications sont sauvegardées automatiquement.

---

## 7. Recherche & filtres

### Recherche rapide

Cliquez sur la barre de recherche dans le header (icône loupe). Saisissez le nom d'un fichier ou d'un dossier — les résultats s'affichent en temps réel.

>  **SCREENSHOT À INSÉRER**
> _Barre de recherche ouverte avec un terme saisi (ex: "contrat") et des résultats affichés en dessous — fichiers et dossiers correspondants avec leur chemin d'accès._

### Filtres avancés

Dans la page Fichiers, utilisez les filtres pour affiner l'affichage :

- **Type** : images, vidéos, audio, PDF, documents
- **Date** : plage de dates (du … au …)
- **Taille** : minimum et maximum en Mo

### Recherche sémantique (Bobby)

Pour une recherche par contenu (pas seulement par nom), utilisez Bobby en posant une question en langage naturel. Voir la section [Bobby](#14-bobby--assistant-ia).

---

## 8. Partage

### Liens publics

>  **SCREENSHOT À INSÉRER**
> _Modal de création d'un lien public — champs "Protéger par mot de passe" (avec un mot de passe saisi masqué), "Date d'expiration" (calendrier ou champ date), "Nombre max de téléchargements" rempli à 10. Le lien généré apparaît dans un champ en lecture seule avec un bouton "Copier"._

1. Clic droit sur un fichier ou dossier  **Partager**  **Créer un lien public**
2. Configurez optionnellement :
   - **Mot de passe** : le destinataire devra le saisir pour accéder au fichier
   - **Date d'expiration** : le lien devient inactif après cette date
   - **Limite de téléchargements** : le lien se désactive après N téléchargements
3. Copiez le lien et partagez-le par email, messagerie, etc.

**Côté destinataire :**

>  **SCREENSHOT À INSÉRER**
> _Page d'accès à un lien public (sans être connecté) — affiche le nom du fichier partagé, un champ "Mot de passe" à renseigner, et un bouton "Accéder". L'URL avec le token est visible dans la barre d'adresse._

Le destinataire accède au fichier sans avoir de compte SUPFile.

### Partage interne (entre utilisateurs)

>  **SCREENSHOT À INSÉRER**
> _Modal de partage interne — champ de recherche d'utilisateur (avec un nom en train d'être saisi et une suggestion de compte trouvé), cases à cocher pour les permissions : Lecture , Écriture , Suppression , Re-partage ._

1. Clic droit  **Partager**  **Partager avec un utilisateur**
2. Recherchez l'utilisateur par nom ou email
3. Définissez les permissions : **Lecture**, **Écriture**, **Suppression**, **Re-partage**
4. Cliquez **Envoyer l'invitation**

L'utilisateur reçoit une notification et peut accepter ou refuser le partage depuis son centre de notifications.

### Gérer mes partages

Dans **Partages** (barre latérale) :
- **En attente** : invitations reçues à accepter ou refuser
- **Avec moi** : fichiers/dossiers partagés par d'autres utilisateurs
- **Par moi** : partages que vous avez créés (modification des permissions, révocation)

---

## 9. Tags

Les tags permettent de catégoriser vos fichiers avec des étiquettes colorées personnalisées.

>  **SCREENSHOT À INSÉRER**
> _Panneau de gestion des tags — liste des tags existants avec leur couleur (pastille colorée), leur nom, et le nombre de fichiers associés. Bouton "Créer un tag" visible. Un tag est en cours d'édition (champ de nom + sélecteur de couleur ouverts)._

### Créer un tag

1. Allez dans **Paramètres**  **Tags** ou ouvrez le menu tags dans la barre latérale
2. Cliquez **Nouveau tag**
3. Donnez un nom et choisissez une couleur
4. Validez

### Appliquer un tag sur un fichier

Clic droit sur un fichier  **Tags**  sélectionnez un ou plusieurs tags existants.

### Filtrer par tag

Dans la page Fichiers, cliquez sur un tag dans la barre latérale pour n'afficher que les fichiers qui lui sont associés.

---

## 10. Commentaires

Vous pouvez laisser des commentaires sur n'importe quel fichier.

>  **SCREENSHOT À INSÉRER**
> _Panneau de commentaires ouvert sur un fichier — au moins 2 commentaires affichés avec avatar utilisateur, nom, date, et texte du commentaire. Un commentaire a une réponse visible (thread). Le champ de saisie d'un nouveau commentaire est visible en bas._

1. Ouvrez la prévisualisation d'un fichier
2. Dans le panneau latéral, cliquez sur l'onglet **Commentaires**
3. Rédigez votre commentaire et appuyez sur **Envoyer**

Les autres utilisateurs ayant accès au fichier reçoivent une **notification en temps réel** lors d'un nouveau commentaire.

**Réponses :** Cliquez sur **Répondre** sous un commentaire pour créer un fil de discussion.

---

## 11. Versions de fichiers

SUPFile conserve l'historique des versions de chaque fichier.

>  **SCREENSHOT À INSÉRER**
> _Panneau Versions d'un fichier — liste chronologique des versions avec pour chacune : numéro de version (V1, V2, V3…), date de création, taille, nom de l'utilisateur qui a créé la version. Boutons "Restaurer" et "Supprimer" visibles à droite de chaque version._

1. Ouvrez la prévisualisation d'un fichier
2. Cliquez sur l'onglet **Versions**
3. Chaque modification du fichier via OnlyOffice crée automatiquement une version

**Restaurer une version :** Cliquez sur **Restaurer** à côté de la version souhaitée. Le fichier revient à cet état.

**Limites selon le plan :**
- PRO : 10 versions par fichier
- BUSINESS : 30 versions
- ENTERPRISE : illimité

---

## 12. Coffre-fort (Vault)

Le Vault est un espace de stockage chiffré séparément de vos fichiers normaux, accessible uniquement avec un mot de passe dédié.

> **Disponible uniquement sur les plans PRO et supérieurs. Le MFA doit être activé.**

### Configurer le Vault

1. Allez dans **Paramètres**  **Coffre-fort**
2. Cliquez **Configurer le coffre-fort**
3. Choisissez un mot de passe fort (min. 12 caractères, majuscule, chiffre, caractère spécial)
4. Confirmez avec votre code MFA

### Accéder au Vault

>  **SCREENSHOT À INSÉRER**
> _Écran de déverrouillage du Vault — champ "Mot de passe du coffre-fort" avec une icône cadenas fermé, bouton "Déverrouiller". Message explicatif visible indiquant que ce mot de passe est distinct du mot de passe de compte._

1. Cliquez sur **Vault** dans la barre latérale
2. Saisissez le mot de passe du coffre
3. Le vault se verrouille automatiquement après **10 minutes d'inactivité**

>  **SCREENSHOT À INSÉRER**
> _Contenu du Vault déverrouillé — explorateur de fichiers similaire à la page Fichiers normale, mais avec une indication visuelle que vous êtes dans le vault (badge "Vault" ou cadenas ouvert dans le header, couleur de fond légèrement différente)._

**Sécurité :** Après 5 tentatives incorrectes, le vault se verrouille pendant 15 minutes.

---

## 13. Notifications

### Centre de notifications

>  **SCREENSHOT À INSÉRER**
> _Centre de notifications ouvert (panneau déroulant depuis la cloche dans le header) — au moins 3 notifications listées avec leur type (icône), titre, message et date. Une notification non lue affiche un fond légèrement coloré. Badge avec le nombre de non-lus visible sur la cloche._

Cliquez sur l'icône **** dans le header pour ouvrir le centre de notifications.

**Types de notifications :**
- Nouveau commentaire sur un de vos fichiers
- Partage reçu d'un autre utilisateur
- Partage accepté par un destinataire
- Quota d'espace presque atteint (75% puis 90%)

**Actions :**
- Cliquez sur une notification pour y accéder directement
- Cliquez **Tout marquer comme lu** pour effacer le badge
- Supprimez une notification individuelle avec la croix

### Notifications push

SUPFile supporte les **notifications push navigateur**. Lors de votre première connexion, autorisez les notifications pour les recevoir même lorsque l'onglet est fermé.

---

## 14. Bobby — Assistant IA

Bobby est votre assistant documentaire. Il analyse vos fichiers et répond à vos questions en langage naturel.

> **Bobby est disponible sur les plans PRO et supérieurs.**

### Ouvrir Bobby

Cliquez sur le bouton **Bobby** (avatar animé) en bas à droite de l'écran.

>  **SCREENSHOT À INSÉRER**
> _Bouton Bobby fermé — le bouton flottant circulaire en bas à droite avec l'avatar de Bobby visible (état idle). Le reste de l'interface SUPFile visible en arrière-plan._

>  **SCREENSHOT À INSÉRER**
> _Interface Bobby ouverte — panneau de chat affiché avec le message de bienvenue de Bobby en haut, une question utilisateur saisie (ex: "Quels sont les termes principaux du contrat Dupont ?"), et la réponse de Bobby en Markdown (listes, texte structuré). Le champ de saisie visible en bas._

### Ce que Bobby peut faire

| Commande | Exemple |
|---|---|
| **Recherche dans vos documents** | "Trouve tous les documents qui mentionnent le RGPD" |
| **Résumé d'un document** | "Résume le contrat dans le dossier Juridique" |
| **Extraction d'information** | "Quel est le montant de la facture de mars 2025 ?" |
| **Génération de contenu** | "Génère un compte-rendu de réunion sur le sujet X" |
| **Analyse comparative** | "Compare les deux propositions commerciales" |

### Confidentialité

Bobby **ne répond qu'à partir de vos propres documents**. Il n'a accès à aucune information d'un autre utilisateur et n'envoie aucune donnée à des services externes. Le modèle IA tourne entièrement sur nos serveurs en France.

### Historique des conversations

Vos conversations avec Bobby sont sauvegardées. Cliquez sur l'icône **Historique** dans le panneau Bobby pour reprendre une conversation précédente.

---

## 15. Paramètres du compte

Accédez à vos paramètres via l'icône **Paramètres** en bas de la barre latérale.

>  **SCREENSHOT À INSÉRER**
> _Page Paramètres — onglets visibles en haut (Profil, Sécurité, Apparence, Notifications). L'onglet Profil est actif : champs Prénom, Nom, Email remplis. Avatar de l'utilisateur avec un bouton "Changer l'avatar". Bouton "Enregistrer" en bas._

### Profil

- Modifiez votre prénom, nom, email
- Uploadez une photo de profil (JPG, PNG, WebP — max 5 Mo)
- Changez votre mot de passe (ancien mot de passe requis)

### Sécurité — Activer le MFA

>  **SCREENSHOT À INSÉRER**
> _Page de setup MFA — QR code affiché (floutez-le pour le screenshot si c'est un vrai compte), le secret manuel en texte en dessous, le champ de saisie du code de vérification à 6 chiffres, et le bouton "Activer"._

1. Allez dans **Paramètres**  **Sécurité**  **Double authentification**
2. Cliquez **Activer le MFA**
3. Scannez le QR code avec Google Authenticator ou Authy
4. Saisissez le code généré pour confirmer l'activation
5. **Sauvegardez vos codes de récupération** (affichés une seule fois)

### Appareils de confiance

La liste de vos appareils enregistrés est visible dans **Sécurité**  **Appareils de confiance**. Cliquez sur la croix pour révoquer l'accès d'un appareil.

### Apparence

- **Thème** : clair ou sombre — la préférence est synchronisée entre tous vos appareils
- **Langue** : Français ou English

### Export de données (RGPD)

Dans **Paramètres**  **Confidentialité**  **Exporter mes données** : téléchargez un fichier CSV contenant l'ensemble de vos données personnelles (profil, liste de fichiers, journal d'activité).

---

## 16. Plans & Facturation

>  **SCREENSHOT À INSÉRER**
> _Page Plans (`/plans`) — les 4 plans affichés en colonnes (FREE, PRO, BUSINESS, ENTERPRISE). Chaque colonne liste les fonctionnalités incluses avec des  et . Le plan actuel de l'utilisateur est mis en avant (bordure colorée ou badge "Votre plan"). Boutons "Choisir ce plan" pour les plans supérieurs._

### Changer de plan

1. Allez dans **Plans** dans la barre latérale
2. Sélectionnez le plan souhaité
3. Cliquez **Choisir ce plan**  vous êtes redirigé vers Stripe (paiement sécurisé)
4. Après paiement, votre plan est mis à jour immédiatement

### Gérer votre abonnement

Cliquez **Gérer mon abonnement** pour accéder au portail Stripe : modification du moyen de paiement, téléchargement des factures, résiliation.

### Downgrade

Pour revenir au plan gratuit, cliquez **Revenir au plan FREE** depuis la page Plans. Vos fichiers sont conservés mais les fonctionnalités premium (Vault, IA, versioning avancé) sont désactivées.

---

## 17. Administration

> **Cette section est réservée aux administrateurs de la plateforme.**

>  **SCREENSHOT À INSÉRER**
> _Dashboard admin (`/admin`) — KPIs en haut (nombre total d'utilisateurs, stockage total utilisé, uploads du jour). Liste des utilisateurs avec colonnes : Email, Nom, Plan, Quota utilisé, Date d'inscription. Bouton "Exporter CSV" visible. Barre de recherche et filtre par plan en haut de la liste._

### Fonctionnalités admin

- **Vue globale** : nombre d'utilisateurs, stockage consommé, activité récente
- **Gestion des utilisateurs** : recherche, modification du plan, export CSV
- **Export stockage** : rapport CSV de l'utilisation par utilisateur
- **Réindexation IA** : forcer la réindexation de tous les fichiers dans la base vectorielle Bobby

---

## 18. Application mobile

SUPFile est disponible sur iOS et Android via l'application Expo/React Native.

>  **SCREENSHOT À INSÉRER**
> _Écran d'accueil mobile (Dashboard) — carte quota en haut avec barre de progression colorée, 3 cartes statistiques en dessous, liste des fichiers récents. La barre de navigation par onglets (Accueil / Fichiers / Favoris / Partages / Profil) visible en bas de l'écran. Prendre sur fond blanc (mode clair)._

>  **SCREENSHOT À INSÉRER**
> _Explorateur de fichiers mobile — liste de dossiers et fichiers avec icônes, noms, tailles. Fil d'Ariane visible en haut. Bouton FAB "+" visible en bas à droite pour uploader. Un fichier affiche le menu contextuel (long press) avec les actions : Renommer, Déplacer, Supprimer, Partager._

### Connexion

La connexion sur mobile fonctionne de la même façon que sur le web : email/mot de passe, puis code MFA si activé.

**Sécurité :** Votre token de connexion est stocké dans le trousseau sécurisé de l'OS (iOS Keychain / Android Keystore) — jamais en clair.

### Upload depuis le mobile

Appuyez sur le bouton **+** (bas droite de l'écran Fichiers) :
- **Fichiers** : sélectionnez depuis le système de fichiers
- **Photos/Vidéos** : accédez à votre galerie photo

La progression est affichée avec une barre animée.

### Fonctionnalités disponibles sur mobile

| Fonctionnalité | Mobile |
|---|---|
| Navigation fichiers/dossiers |  |
| Upload depuis galerie / système |  |
| Prévisualisation images, vidéos, audio, PDF |  |
| Partage (création et gestion) |  |
| Favoris |  |
| Corbeille |  |
| Notifications temps réel |  |
| MFA |  |
| Tags, commentaires, versions |  |
| Dashboard & statistiques |  |
| Paramètres profil |  |
| Édition OnlyOffice |  (prévisualisation uniquement) |
| Bobby IA |  (web uniquement pour l'instant) |
| Dark mode |  (en cours de développement) |
