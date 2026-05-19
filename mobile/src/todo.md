
### Vue d'ensemble rapide

| Domaine | Web | Mobile | Écart |
| :--- | :---: | :---: | :--- |
| Authentification | ✅ Complet | 🟡 Partiel | OAuth, reset password, trusted devices |
| Gestionnaire de fichiers | ✅ Complet | 🟡 Partiel | Pas de tri, pas de filtres avancés (date / taille / mime), pas de DL en ZIP |
| Corbeille | ✅ Complet | ✅ Complet | — |
| Prévisualisation | ✅ Complet | 🟡 Partiel | Pas de texte/Markdown, pas d'OnlyOffice |
| Recherche | ✅ Complet | 🟡 Partiel | Pas de filtres avancés (type / date / taille) |
| Favoris | ✅ Complet | ✅ Complet | — |
| Partage & Collaboration | ✅ Complet | ✅ Complet | Bundle multi-fichiers : mobile only |
| Tags | ✅ Complet | 🟡 Partiel | Pas d'édition (renommage / recoloriage) |
| Commentaires | ✅ Complet | ✅ Complet | — |
| Versions | ✅ Complet | ✅ Complet | — |
| Notifications | ✅ Complet | ✅ Complet | — |
| Dashboard | ✅ Complet | 🟡 Partiel | Pas de flux d'activité |
| Profil & Paramètres | ✅ Complet | ✅ Complet | — |
| MFA dans les paramètres | ✅ Complet | ✅ Complet | — |
| Comptes multiples | ✅ Complet | ✅ Complet | — |
| Administration | ✅ Complet | 🟡 Partiel | Pas d'export CSV |
| Coffre-fort (Vault) | ✅ Complet | ✅ Complet | — |
| Journal d'audit | ✅ Complet | 🟡 Partiel | Pas de filtres ni d'export CSV |
| Organisations | ✅ Complet | ❌ Absent | — |
| Plans & Billing (Stripe) | ✅ Complet | ✅ Complet | — |
| Assistant IA Bobby | ✅ Complet | ✅ Complet | — |

---

### Détail par fonctionnalité

#### 1. Authentification & Identité

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Inscription email / mot de passe | ✅ | ✅ | |
| Connexion email / mot de passe | ✅ | ✅ | |
| OAuth Google | ✅ | ❌ | Non implémenté |
| OAuth GitHub | ✅ | ❌ | Non implémenté |
| Mot de passe oublié (envoi email) | ✅ | ❌ | Aucun écran dédié |
| Réinitialisation via lien | ✅ | ❌ | Aucun écran dédié |
| MFA TOTP — configuration initiale | ✅ | ✅ | `MfaSetupModal` |
| MFA TOTP — vérification à la connexion | ✅ | ✅ | `MfaVerifyScreen` |
| Gestion session JWT sécurisée (SecureStore) | ✅ | ✅ | |
| Déconnexion globale (toutes sessions) | ✅ | ✅ | Dans SettingsScreen |
| Trusted devices (liste & révocation) | ✅ | ❌ | Compteur affiché, pas de gestion |

---

#### 2. Gestionnaire de fichiers

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Listing fichiers & dossiers | ✅ | ✅ | |
| Navigation dossiers avec fil d'Ariane | ✅ | ✅ | |
| Création de dossier | ✅ | ✅ | |
| Renommage fichier / dossier | ✅ | ✅ | Via `ItemActionsSheet` |
| Déplacement fichier / dossier | ✅ | ✅ | Unitaire & batch |
| Suppression fichier / dossier | ✅ | ✅ | Unitaire & batch |
| Upload fichier (document natif) | ✅ | ✅ | |
| Upload photos / vidéos depuis galerie | ✅ | ✅ | |
| Upload multi-fichiers séquentiel | ✅ | ✅ | |
| Barre de progression upload | ✅ | ✅ | Avec annulation |
| Drag & Drop upload | ✅ | — | N/A mobile |
| Drag & Drop déplacement | ✅ | — | N/A mobile |
| Sélection multiple + actions batch | ✅ | ✅ | Déplacer, partager, supprimer |
| Tri (nom, date, taille) | ✅ | ❌ | Pas implémenté |
| Filtres avancés (type MIME, date, taille) | ✅ | ❌ | Pas implémenté |
| Filtre par tag | ✅ | ✅ | Chips horizontaux |
| Téléchargement de dossier en ZIP | ✅ | ❌ | Pas implémenté |
| Actualisation temps réel (WebSocket) | ✅ | ✅ | `SocketListener` |

---

#### 3. Corbeille

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Voir les fichiers supprimés | ✅ | ✅ | |
| Restaurer un fichier | ✅ | ✅ | |
| Restaurer un dossier | ✅ | ✅ | `folderService.restoreFolder` |
| Suppression définitive d'un fichier | ✅ | ✅ | |
| Suppression définitive d'un dossier | ✅ | ✅ | |
| Vider la corbeille (tout supprimer) | ✅ | ❌ | Pas de bouton global |

---

#### 4. Prévisualisation

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Images (JPEG, PNG, WEBP…) | ✅ | ✅ | |
| Vidéo (MP4, streaming) | ✅ | ✅ | `expo-video` |
| Audio (MP3, streaming) | ✅ | ✅ | `expo-av` |
| PDF (via WebView) | ✅ | ✅ | |
| Texte brut / Markdown | ✅ | ❌ | Pas implémenté |
| Documents Office (OnlyOffice) | ✅ | ❌ | `DocumentEditorModal` existe mais incomplet |
| Téléchargement depuis la prévisualisation | ✅ | ✅ | |

---

#### 5. Recherche

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Recherche globale par nom de fichier | ✅ | ✅ | `SearchBar` modal |
| Filtre par type MIME | ✅ | ❌ | |
| Filtre par date (de → à) | ✅ | ❌ | |
| Filtre par taille (min / max) | ✅ | ❌ | |
| Recherche par tag | ✅ | ✅ | Via filtre de tag dans FilesScreen |

---

#### 6. Favoris

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Ajouter / retirer des favoris | ✅ | ✅ | |
| Écran dédié (liste des favoris) | ✅ | ✅ | `FavoritesScreen` |

---

#### 7. Partage & Collaboration

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Lien public (mot de passe, expiration, limite DL) | ✅ | ✅ | |
| Lien bundle multi-fichiers (archive ZIP) | ❌ | ✅ | Mobile only |
| Page publique de téléchargement | ✅ | — | Via navigateur |
| Partage interne fichier (permissions R/W/D/S) | ✅ | ✅ | |
| Partage interne dossier | ✅ | ✅ | |
| Voir « partagés avec moi » | ✅ | ✅ | |
| Voir « partagés par moi » | ✅ | ✅ | |
| Accepter / refuser un partage reçu | ✅ | ✅ | |
| Révoquer un partage | ✅ | ✅ | |
| Badge de partages en attente | ✅ | ✅ | |
| Partage en lot (sélection multiple) | ✅ | ✅ | Batch share via `ShareModal` |

---

#### 8. Tags

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Lister tous ses tags | ✅ | ✅ | |
| Créer un tag (nom + couleur) | ✅ | ✅ | `TagsPicker` |
| Modifier un tag (renommer / recolorer) | ✅ | ❌ | Pas implémenté |
| Supprimer un tag | ✅ | ✅ | |
| Assigner un tag à un fichier | ✅ | ✅ | |
| Retirer un tag d'un fichier | ✅ | ✅ | |
| Chips de tags visibles sur chaque fichier | ✅ | ✅ | |
| Filtre par tag dans la liste de fichiers | ✅ | ✅ | |

---

#### 9. Commentaires

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Voir les commentaires d'un fichier | ✅ | ✅ | `CommentsPanel` |
| Ajouter un commentaire | ✅ | ✅ | |
| Supprimer son commentaire | ✅ | ✅ | |

---

#### 10. Historique de versions

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Voir l'historique des versions | ✅ | ✅ | `VersionsPanel` |
| Restaurer une version | ✅ | ✅ | |
| Supprimer une version | ✅ | ✅ | |

---

#### 11. Notifications

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Liste des notifications | ✅ | ✅ | `NotificationCenter` |
| Marquer comme lu (unitaire) | ✅ | ✅ | |
| Tout marquer comme lu | ✅ | ✅ | |
| Supprimer une notification | ✅ | ✅ | |
| Badge temps réel (WebSocket) | ✅ | ✅ | |
| Alertes quota (25 / 50 / 75 / 95 %) | ✅ | ✅ | |
| Notification partage reçu | ✅ | ✅ | |
| Notification nouveau commentaire | ✅ | ✅ | |

---

#### 12. Dashboard

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Jauge quota de stockage | ✅ | ✅ | |
| Répartition par type de fichier | ✅ | ✅ | |
| Fichiers récemment modifiés | ✅ | ✅ | |
| Flux d'activité (audit feed) | ✅ | ❌ | Pas implémenté dans DashboardScreen |

---

#### 13. Profil & Paramètres

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Modifier nom / prénom | ✅ | ✅ | |
| Modifier l'email | ✅ | ✅ | |
| Upload d'avatar depuis la galerie | ✅ | ✅ | |
| Changer le mot de passe | ✅ | ✅ | |
| Export données personnelles (RGPD) | ✅ | ✅ | |
| Suppression du compte | ✅ | ✅ | Zone dangereuse dans SettingsScreen |
| Thème sombre (dark mode) | ✅ | ✅ | `useThemeStore` : light / dark / system |
| Langue FR / EN | ✅ | ✅ | Sélection dans le profil (sauvegardée en BDD) |
| Activer le MFA | ✅ | ✅ | `MfaSetupModal` |
| Désactiver le MFA | ✅ | ✅ | Étape `disable` dans `MfaSetupModal` |
| Voir / regénérer les codes de secours | ✅ | ✅ | `handleRegenerate` dans `MfaSetupModal` |
| Gestion trusted devices (liste & révocation) | ✅ | ❌ | Compteur visible, pas de liste/révocation |

---

#### 14. Comptes multiples & Délégations

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Lier un compte secondaire | ✅ | ✅ | `AccountSwitcherModal` |
| Basculer vers un compte lié | ✅ | ✅ | |
| Délier un compte | ✅ | ✅ | |
| Accorder une délégation | ✅ | ✅ | |
| Assumer une délégation | ✅ | ✅ | |
| Révoquer une délégation | ✅ | ✅ | |

---

#### 15. Administration

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| KPIs système (utilisateurs, stockage, plans) | ✅ | ✅ | `AdminScreen` |
| Liste utilisateurs + recherche + filtre plan | ✅ | ✅ | |
| Modifier le plan d'un utilisateur | ✅ | ✅ | |
| Export CSV (utilisateurs / stockage) | ✅ | ❌ | Pas implémenté |

---

#### 16. Coffre-fort (Vault)

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Configuration initiale (mot de passe + TOTP) | ✅ | ✅ | `VaultScreen` |
| Déverrouillage | ✅ | ✅ | |
| Verrouillage manuel | ✅ | ✅ | |
| Rotation du mot de passe | ✅ | ✅ | |
| Statut (verrouillé / déverrouillé / non configuré) | ✅ | ✅ | |

---

#### 17. Journal d'audit

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Voir les logs d'activité | ✅ | ✅ | `AuditScreen` — pagination infinie |
| Filtres (action, date, utilisateur) | ✅ | ❌ | Pas implémenté sur mobile |
| Export CSV | ✅ | ❌ | Pas implémenté sur mobile |

---

#### 18. Plans & Billing (Stripe)

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Voir son plan actuel | ✅ | ✅ | Badge dans SettingsScreen |
| Voir les plans disponibles | ✅ | ✅ | `PlansModal` |
| Initier un checkout Stripe | ✅ | ✅ | Via WebView/lien dans `PlansModal` |

---

#### 19. Assistant IA Bobby

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Chat conversationnel | ✅ | ✅ | `AIScreen` — onglet dédié |
| Historique de conversation (session) | ✅ | ✅ | |
| Restriction par plan (PRO+) | ✅ | ✅ | `isFeatureAvailableForPlan` |
| Analyse de fichiers (RAG) | ✅ | 🟡 | Dépend de l'API back, pas d'UI dédiée |

---

#### 20. Organisations

| Fonctionnalité | Web | Mobile | Notes |
| :--- | :---: | :---: | :--- |
| Création d'organisation | ✅ | ❌ | Absent |
| Gestion des membres / rôles | ✅ | ❌ | Absent |
| Switch d'organisation | ✅ | ❌ | Absent |

---

### Récapitulatif des écarts restants (par priorité)

| Priorité | Fonctionnalité manquante | Complexité |
| :--- | :--- | :---: |
| 🔴 Haute | Filtres avancés dans la recherche (type, date, taille) | Faible |R
| 🔴 Haute | Tri des fichiers (nom, date, taille) | Faible |R
| 🔴 Haute | Vider la corbeille (bouton global) | Faible |R
| 🔴 Haute | Filtres dans le journal d'audit 
| Faible |R
| 🔴 Haute | Partage publique 
| Faible |
| 🔴 Haute | lorce que je reste appuyer sur le boutton proposer de téléchargerle fichier , et si dossier en zip
| Faible |
| 🟠 Moyenne | Mot de passe oublié / réinitialisation | Faible |
| 🟠 Moyenne | Prévisualisation texte / Markdown | Faible |
| 🟠 Moyenne | Édition de tag (renommer, recolorer) | Faible |
| 🟠 Moyenne | Flux d'activité dans le Dashboard | Moyenne |
| 🟠 Moyenne | Téléchargement dossier en ZIP | Faible |
| 🟠 Moyenne | Export CSV admin | Faible |
| 🟠 Moyenne | Gestion trusted devices (liste & révocation) | Faible |
| 🟡 Basse | OAuth Google / GitHub | Moyenne |
| 🟡 Basse | Organisations | Élevée |
