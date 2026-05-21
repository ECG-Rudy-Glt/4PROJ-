# SUPFile - Guide de démonstration

> Durée cible : **6 minutes**
> Préparer un compte de démo avec des fichiers variés pré-chargés avant la soutenance.

---

## Préparation avant la démo

### Compte de démo à préparer
- Utilisateur : `demo@supfile.tech` / mot de passe fort
- MFA activé (pour montrer le flow)
- Fichiers pré-uploadés dans différents dossiers :
  - `Contrats/`  1 PDF multi-pages (contrat fournisseur)
  - `Images/`  3–4 photos JPG/PNG
  - `Vidéos/`  1 courte vidéo MP4
  - `Documents/`  1 fichier DOCX, 1 XLSX
  - `Notes/`  1 fichier Markdown (.md)
- Bobby : fichiers **déjà indexés** (embedding fait en amont)
- 1 partage actif avec un second compte de démo
- Tags créés : `Urgent`, `Client`, `Archive`
- Quelques fichiers en favoris

### Environnement
- Application lancée (`docker compose up`) et testée avant la présentation
- Navigateur en **plein écran**, onglet propre (pas d'historique visible)
- Résolution adaptée pour la projection (zoom navigateur 90%)
- Second onglet prêt avec le compte destinataire du partage

---

## Script de démonstration

### Étape 1 - Connexion & MFA (45 sec)

**Ce qu'on montre :** login + MFA TOTP

1. Aller sur la page de connexion
2. Saisir email + mot de passe  cliquer Connexion
3. L'écran MFA apparaît  saisir le code Google Authenticator
4. *"Notre authentification va plus loin que le login classique : MFA TOTP, et tous les tokens sont versionnés - une seule action côté serveur suffit pour déconnecter tous les appareils d'un coup."*

---

### Étape 2 - Dashboard (30 sec)

**Ce qu'on montre :** quota, stats, fichiers récents

1. Arriver sur le Dashboard
2. Montrer le PieChart de répartition par type de fichier
3. Pointer la barre de quota colorée (vert/orange/rouge selon usage)
4. *"Le dashboard donne une vision instantanée de l'espace utilisé, avec une répartition visuelle par type de contenu."*

---

### Étape 3 - Upload & navigation (60 sec)

**Ce qu'on montre :** drag & drop, progression, corbeille

1. Naviguer dans `Documents/`
2. Glisser un fichier depuis le bureau  l'overlay drag & drop s'active
3. Lâcher  la barre de progression par fichier s'affiche dans la modal
4. Montrer le fichier qui apparaît dans la liste
5. Renommer le fichier (clic droit ou menu )
6. Supprimer le fichier  il va en corbeille
7. Aller dans Corbeille  montrer "X jours avant suppression définitive"  Restaurer
8. *"Suppression non destructive, 90 jours de grâce, restauration en un clic."*

---

### Étape 4 - Prévisualisation multi-format (45 sec)

**Ce qu'on montre :** la richesse du lecteur intégré

1. Cliquer sur le PDF dans `Contrats/`  aperçu inline
2. Cliquer sur une image JPG  prévisualisation plein écran
3. Cliquer sur le fichier DOCX  OnlyOffice s'ouvre, édition directe dans le navigateur
4. *"Pas besoin de télécharger - images, PDF, vidéos, et même les fichiers Office s'ouvrent directement dans le navigateur, avec édition collaborative via OnlyOffice."*

---

### Étape 5 - Partage (45 sec)

**Ce qu'on montre :** lien public protégé + partage interne

1. Clic droit sur un fichier  Partager  Générer un lien public
2. Ajouter un mot de passe + date d'expiration dans 7 jours
3. Copier le lien
4. Dans le second onglet (non connecté)  coller le lien  écran de saisie mot de passe  accès au fichier
5. Revenir sur le premier compte  Partages  montrer le partage interne actif avec permissions (lecture/écriture)
6. *"Deux niveaux de partage : lien public avec mot de passe et expiration, ou partage interne avec permissions granulaires par utilisateur."*

---

### Étape 6 - Bobby - IA documentaire (60 sec)

**Ce qu'on montre :** RAG en action, pas une démo vide

1. Ouvrir le chatbot Bobby (bouton flottant en bas à droite)
2. Poser une question précise sur le contenu du PDF : *"Quel est l'objet du contrat dans le dossier Contrats ?"*
3. Bobby répond en citant le contenu du document (réponse en Markdown)
4. Poser une seconde question : *"Résume ce document en 3 points clés"*
5. *"Bobby ne répond qu'à partir des documents de l'utilisateur - RAG complet avec ChromaDB et un LLM qui tourne 100% on-premise. Zéro donnée envoyée à l'extérieur."*

---

### Étape 7 - Vault & Sécurité (30 sec)

**Ce qu'on montre :** le coffre-fort chiffré

1. Aller dans la Sidebar  Vault
2. Saisir le mot de passe du coffre  déverrouillage
3. Montrer les fichiers dans le vault (icône cadenas)
4. *"Le vault est un espace chiffré avec une clé séparée du compte principal - même un admin de la plateforme ne peut pas accéder aux fichiers d'un vault sans le mot de passe du propriétaire."*

---

### Étape 8 - Mobile (optionnel si temps disponible, 30 sec)

**Ce qu'on montre :** parité des features sur mobile

1. Scanner un QR code ou afficher le téléphone via projection
2. Se connecter sur l'app mobile
3. Montrer la navigation par onglets, le même explorateur de fichiers
4. *"L'application mobile Expo/React Native reprend l'intégralité des fonctionnalités - même store Zustand, même API, même expérience."*

---

## Points à éviter / pièges

| Piège | Prévention |
|---|---|
| Bobby qui met trop longtemps à répondre | Préparer la question à l'avance, fichier déjà indexé |
| OnlyOffice lent à charger | Ouvrir l'onglet à l'avance, garder le DOCX léger (<500 Ko) |
| Upload qui échoue en démo | Tester le fichier exact la veille, avoir un fichier de secours |
| Erreur de connexion réseau | Démo en local (docker compose sur le poste de démo) |
| Questions sur des fonctionnalités non démontrées | "On ne l'a pas montré faute de temps, mais c'est implémenté - voici comment ça fonctionne…" |

---

## Ordre de priorité si le temps manque

1. Upload + navigation (indispensable)
2. Bobby RAG (différenciateur principal)
3. Partage avec lien public
4. Prévisualisation Office (OnlyOffice)
5. Vault (si temps)
6. Mobile (si temps)
