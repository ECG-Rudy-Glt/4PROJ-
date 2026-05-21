


Ergonomie & Choix graphiques - Justification
Palette de couleurs : Vert sauge (#254441 / #5A9A94)
Pourquoi le vert sauge et pas du bleu comme Dropbox ?

Le bleu est la couleur par défaut du secteur tech (Dropbox, Google Drive, OneDrive). Le choix du vert sauge profond positionne SUPFile comme une alternative qui inspire confiance et sérieux sans être générique. Le vert évoque aussi la sécurité et la stabilité - deux valeurs centrales pour une plateforme de stockage de données personnelles.

La teinte est délibérément désaturée (#254441) pour rester professionnelle et ne pas fatiguer l'œil sur une utilisation longue.

Double palette light / dark pensée dès le départ
Le dark mode n'est pas un ajout cosmétique - il a été conçu avec deux palettes distinctes dans tailwind.config.js :

Light : vert foncé sur fond blanc cassé (#F5F3EF) - chaud, lisible, professionnel
Dark : vert menthe clair (#5A9A94) sur fond anthracite (#1a1a1a) - contraste optimal, yeux reposés
La préférence est persistée en base de données et synchronisée à la connexion - pas juste un localStorage qui se perd.

Layout : sidebar fixe + header fixe
Choix classique mais éprouvé, identique à Dropbox, Google Drive, Notion. La sidebar à 64px est organisée en 3 zones fonctionnelles :

Navigation principale (Dashboard, Fichiers, Favoris, Vault)
Navigation secondaire (Partages, Corbeille, Audit, Organisation)
Zone utilisateur en bas (Plans, Paramètres)
Cette hiérarchie visuelle guide naturellement l'œil du plus fréquent (fichiers) au moins fréquent (facturation).

Feedback utilisateur systématique
Chaque action critique déclenche un retour visuel :

Toasts animés (entrée slide, sortie fade) pour confirmations et erreurs
Barre de progression par fichier pendant l'upload
Indicateur de quota en couleur : vert  orange (75%)  rouge (90%)
Badge sur la sidebar pour les partages en attente
Shimmer/skeleton pendant les chargements
Iconographie unifiée (Lucide React)
Un seul système d'icônes sur toute l'application - pas de mix entre FontAwesome, Material Icons et SVG custom. Lucide React a été choisi pour sa cohérence de trait (1.5px, arrondi identique) et son poids léger (tree-shakeable).

Hiérarchie typographique
TailwindCSS impose une échelle typographique stricte (text-xs / text-sm / text-base / text-lg / text-xl…) appliquée de façon cohérente :

Labels de navigation : text-sm
Titres de page : text-xl font-bold
Métadonnées fichier : text-xs text-gray-500
Pas de tailles custom arbitraires - tout suit l'échelle de 4px.

Accessibilité de base
Boutons avec title pour les actions icône seule
Contraste couleurs respecté entre light et dark
Focus visible sur les inputs
États hover/active/disabled distincts visuellement
En résumé
SUPFile n'a pas de charte graphique imposée par un designer. Elle a émergé d'un système de design cohérent : une palette restreinte (vert sauge + accents terre cuite/moutarde), un layout éprouvé par les leaders du marché, et une attention systématique au feedback utilisateur. L'objectif était qu'un nouvel utilisateur venant de Google Drive ou Dropbox ne soit pas dépaysé, mais qu'il ressente immédiatement que le produit est plus sobre et plus sérieux.