
### Vue d'ensemble rapide

| Domaine | Web | Mobile | Écart |
| :--- | :---: | :---: | :--- |
| Authentification | ✅ Complet | 🟡 Partiel | Trusted devices |
| Gestionnaire de fichiers | ✅ Complet | 🟡 Partiel | Pas de filtres avancés (date / taille / mime) |
| Corbeille | ✅ Complet | 🟡 Partiel | Pas de restauration de dossiers, pas de vidage global |
| Prévisualisation | ✅ Complet | 🟡 Partiel | Pas de texte/Markdown, pas d'OnlyOffice |
| Recherche | ✅ Complet | 🟡 Partiel | Pas de filtres avancés |
| Favoris | ✅ Complet | ✅ Complet | — |
| Partage & Collaboration | ✅ Complet | ✅ Complet | Bundle multi-fichiers : mobile only |
| Tags | ✅ Complet | 🟡 Partiel | Pas d'édition (renommage / recoloriage) |
| Commentaires | ✅ Complet | ✅ Complet | — |
| Versions | ✅ Complet | ✅ Complet | — |
| Notifications | ✅ Complet | ✅ Complet | — |
| Dashboard | ✅ Complet | 🟡 Partiel | Pas de flux d'activité |
| Profil & Paramètres | ✅ Complet | 🟡 Partiel | Pas de thème sombre, suppression compte |
| MFA dans les paramètres | ✅ Complet | 🟡 Partiel | Pas de désactivation, codes, trusted devices |
| Comptes multiples | ✅ Complet | ✅ Complet | — |
| Administration | ✅ Complet | 🟡 Partiel | Pas d'export CSV |
| Coffre-fort (Vault) | ✅ Complet | ❌ Absent | — |
| Journal d'audit | ✅ Complet | ❌ Absent | — |
| Organisations | ✅ Complet | ❌ Absent | — |
| Plans & Billing (Stripe) | ✅ Complet | ❌ Absent | — |
| Assistant IA Bobby | ✅ Complet | ❌ Absent | — |

---

### Détail par fonctionnalité

#### 1. Authentification & Identité

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Inscription email / mot de passe | ✅ | ✅ |
| Connexion email / mot de passe | ✅ | ✅ |
| OAuth Google | ✅ | ✅ |
| OAuth GitHub | ✅ | ✅ |
| Mot de passe oublié (envoi email) | ✅ | ✅ |
| Réinitialisation via lien | ✅ | ✅ |
| MFA TOTP — configuration initiale | ✅ | ✅ |
| MFA TOTP — vérification à la connexion | ✅ | ✅ |
| Gestion session JWT sécurisée (SecureStore) | ✅ | ✅ |
| Déconnexion globale (toutes sessions) | ✅ | ✅ |
| Trusted devices (liste & révocation) | ✅ | ❌ |

---

#### 2. Gestionnaire de fichiers

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Listing fichiers & dossiers | ✅ | ✅ |
| Navigation dossiers avec fil d'Ariane | ✅ | ✅ |
| Création de dossier | ✅ | ✅ |
| Renommage fichier / dossier | ✅ | ✅ |
| Déplacement fichier / dossier | ✅ | ✅ |
| Suppression fichier / dossier | ✅ | ✅ |
| Upload fichier (document natif) | ✅ | ✅ |
| Upload photos / vidéos depuis galerie | ✅ | ✅ |
| Upload multi-fichiers séquentiel | ✅ | ✅ |
| Barre de progression upload | ✅ | ✅ |
| Drag & Drop upload (glisser-déposer) | ✅ | — (N/A mobile) |
| Drag & Drop déplacement (glisser-déposer) | ✅ | — (N/A mobile) |
| Sélection multiple + actions batch | ✅ | ✅ |
| Tri (nom, date, taille) | ✅ | ❌ |
| Filtres avancés (type MIME, date, taille) | ✅ | ❌ |
| Filtre par tag | ✅ | ✅ |
| Téléchargement de dossier en ZIP | ✅ | ❌ |
| Actualisation temps réel (WebSocket) | ✅ | ✅ |

---

#### 3. Corbeille

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Voir les fichiers supprimés | ✅ | ✅ |
| Restaurer un fichier | ✅ | ✅ |
| Restaurer un dossier | ✅ | ❌ |
| Suppression définitive d'un fichier | ✅ | ✅ |
| Vider la corbeille (tout supprimer) | ✅ | ❌ |

---

#### 4. Prévisualisation

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Images (JPEG, PNG, WEBP…) | ✅ | ✅ |
| Vidéo (MP4, streaming) | ✅ | ✅ |
| Audio (MP3, streaming) | ✅ | ✅ |
| PDF (via WebView) | ✅ | ✅ |
| Texte brut / Markdown | ✅ | ❌ |
| Documents Office (OnlyOffice) | ✅ | ❌ |
| Téléchargement depuis la prévisualisation | ✅ | ✅ |

---

#### 5. Recherche

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Recherche globale par nom de fichier | ✅ | ✅ |
| Filtre par type MIME | ✅ | ❌ |
| Filtre par date (de → à) | ✅ | ❌ |
| Filtre par taille (min / max) | ✅ | ❌ |
| Recherche par tag | ✅ | ✅ |

---

#### 6. Favoris

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Ajouter / retirer des favoris | ✅ | ✅ |
| Écran dédié (liste des favoris) | ✅ | ✅ |

---

#### 7. Partage & Collaboration

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Lien public (mot de passe, expiration, limite DL) | ✅ | ✅ |
| Lien bundle multi-fichiers (archive ZIP) | ❌ | ✅ |
| Page publique de téléchargement | ✅ | — (navigateur) |
| Partage interne fichier (permissions R/W/D/S) | ✅ | ✅ |
| Partage interne dossier | ✅ | ✅ |
| Voir « partagés avec moi » | ✅ | ✅ |
| Voir « partagés par moi » | ✅ | ✅ |
| Accepter / refuser un partage reçu | ✅ | ✅ |
| Révoquer un partage | ✅ | ✅ |
| Badge de partages en attente | ✅ | ✅ |
| Partage en lot (sélection multiple) | ✅ | ✅ |

---

#### 8. Tags

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Lister tous ses tags | ✅ | ✅ |
| Créer un tag (nom + couleur) | ✅ | ✅ |
| Modifier un tag (renommer / recolorer) | ✅ | ❌ |
| Supprimer un tag | ✅ | ✅ |
| Assigner un tag à un fichier | ✅ | ✅ |
| Retirer un tag d'un fichier | ✅ | ✅ |
| Chips de tags visibles sur chaque fichier | ✅ | ✅ |
| Filtre par tag dans la liste de fichiers | ✅ | ✅ |

---

#### 9. Commentaires

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Voir les commentaires d'un fichier | ✅ | ✅ |
| Ajouter un commentaire | ✅ | ✅ |
| Supprimer son commentaire | ✅ | ✅ |

---

#### 10. Historique de versions

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Voir l'historique des versions | ✅ | ✅ |
| Restaurer une version | ✅ | ✅ |
| Supprimer une version | ✅ | ✅ |

---

#### 11. Notifications

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Liste des notifications | ✅ | ✅ |
| Marquer comme lu (unitaire) | ✅ | ✅ |
| Tout marquer comme lu | ✅ | ✅ |
| Supprimer une notification | ✅ | ✅ |
| Badge temps réel (WebSocket) | ✅ | ✅ |
| Alertes quota (25 / 50 / 75 / 95 %) | ✅ | ✅ |
| Notification partage reçu | ✅ | ✅ |
| Notification nouveau commentaire | ✅ | ✅ |

---

#### 12. Dashboard

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Jauge quota de stockage | ✅ | ✅ |
| Répartition par type de fichier | ✅ | ✅ |
| Fichiers récemment modifiés | ✅ | ✅ |
| Flux d'activité (audit feed) | ✅ | ❌ |

---

#### 13. Profil & Paramètres

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Modifier nom / prénom | ✅ | ✅ |
| Modifier l'email | ✅ | ✅ |
| Upload d'avatar depuis la galerie | ✅ | ✅ |
| Changer le mot de passe | ✅ | ✅ |
| Export données personnelles (RGPD) | ✅ | ✅ |
| Suppression du compte | ✅ | ❌ |
| Thème sombre (dark mode) | ✅ | ❌ |
| Langue FR / EN (i18next) | ✅ | ✅ |
| Activer le MFA | ✅ | ✅ |
| Désactiver le MFA | ✅ | ❌ |
| Voir / regénérer les codes de secours | ✅ | ❌ |
| Gestion trusted devices | ✅ | ❌ |

---

#### 14. Comptes multiples & Délégations

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| Lier un compte secondaire | ✅ | ✅ |
| Basculer vers un compte lié | ✅ | ✅ |
| Délier un compte | ✅ | ✅ |
| Accorder une délégation | ✅ | ✅ |
| Assumer une délégation | ✅ | ✅ |
| Révoquer une délégation | ✅ | ✅ |

---

#### 15. Administration

| Fonctionnalité | Web | Mobile |
| :--- | :---: | :---: |
| KPIs système (utilisateurs, stockage, plans) | ✅ | ✅ |
| Liste utilisateurs + recherche + filtre plan | ✅ | ✅ |
| Modifier le plan d'un utilisateur | ✅ | ✅ |
| Export CSV (utilisateurs / stockage) | ✅ | ❌ |

---

#### 16. Fonctionnalités absentes sur mobile

Les domaines suivants sont entièrement implémentés sur le web mais **absents du mobile**.

| Domaine | Complexité estimée |
| :--- | :---: |
| **Coffre-fort chiffré (Vault)** — setup, déverrouillage, upload | Élevée |
| **Journal d'audit** — historique d'actions, filtres, export CSV | Moyenne |
| **Organisations** — création, membres, rôles, switch d'organisation | Élevée |
| **Plans & Billing (Stripe)** — voir le plan, passer à PRO, checkout | Moyenne |
| **Assistant IA Bobby** — chat, analyse fichier, recherche sémantique | Élevée |

---

### Récapitulatif des écarts à combler (par priorité)

| Priorité | Fonctionnalité manquante | Complexité |
| :--- | :--- | :---: |
| 🔴 Haute | Filtres avancés dans la recherche (type, date, taille) | Faible |
| 🔴 Haute | Tri des fichiers (nom, date, taille) | Faible |
| 🔴 Haute | Restauration de dossiers depuis la corbeille | Faible |
| 🔴 Haute | Vider la corbeille | Faible |
| 🔴 Haute | Désactiver MFA + codes de secours dans les paramètres | Faible |
| ~~🟠 Moyenne~~ | ~~Mot de passe oublié / réinitialisation~~ | ~~Faible~~ ✅ |
| 🟠 Moyenne | Prévisualisation texte / Markdown | Faible |
| 🟠 Moyenne | Édition de tag (renommer, recolorer) | Faible |
| 🟠 Moyenne | Flux d'activité dans le Dashboard | Moyenne |
| 🟠 Moyenne | Suppression de compte (RGPD) | Faible |
| 🟠 Moyenne | Téléchargement dossier en ZIP | Faible |
| 🟠 Moyenne | Export CSV admin | Faible |
| 🟠 Moyenne | Thème sombre | Faible |
| ~~🟡 Basse~~ | ~~OAuth Google / GitHub~~ | ~~Moyenne~~ ✅ |
| 🟡 Basse | Trusted devices (liste & révocation) | Moyenne |
| ~~🟡 Basse~~ | ~~Internationalisation FR/EN~~ | ~~Élevée~~ ✅ |
| 🟡 Basse | Coffre-fort chiffré (Vault) | Élevée |
| 🟡 Basse | Journal d'audit | Moyenne |
| 🟡 Basse | Organisations | Élevée |
| 🟡 Basse | Plans & Billing (Stripe) | Moyenne |
| 🟡 Basse | Assistant IA Bobby | Élevée |