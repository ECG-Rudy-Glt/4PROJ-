# Stratégie de Tests Globale - SUPFILE

Ce document définit la stratégie de test pour assurer la sécurité, la fiabilité et la performance de l'application SUPFILE.

## 1. Tests de Bout-en-Bout (E2E) - Cypress
L'objectif est de valider les flux critiques du point de vue de l'utilisateur.

### Flux Fondamentaux
- **Authentification & MFA** : Inscription, activation MFA, connexion sécurisée, codes de secours.
- **Gestion Documentaire** : Upload de fichiers, création de dossiers, renommage, suppression (corbeille).
- **IA (Bobby)** : Question sur un document, recherche sémantique, vérification du quota (50 req/jour).
- **Coffre-fort (Vault)** : Chiffrement additionnel, verrouillage session, isolation des données.

### Collaboration
- **Partage** : Création de liens publics (avec/sans mot de passe), partage entre utilisateurs, gestion des permissions (Lecture/Écriture).
- **Temps Réel** : Notification instantanée lors d'un commentaire ou d'un partage reçu.

---

## 2. Stratégie de Sécurité & Chiffrement
Vérification que la promesse de "zéro connaissance" ou de chiffrement fort est tenue.

### Audit du Chiffrement (At Rest)
- **Test de Fuite S3** : Simulation d'un accès direct aux buckets MinIO/S3. Vérification que les fichiers `.enc` sont indéchiffrables sans la clé `FILE_ENCRYPTION_KEY`.
- **Intégrité AES-GCM** : Vérification que toute modification mineure du fichier chiffré (bit flipping) rend le déchiffrement impossible (via AuthTag).

### Isolation
- **Vault Security** : Vérification qu'aucune métadonnée sensible (noms de fichiers du vault) ne fuite dans les logs ou les requêtes API non authentifiées.
- **Délégation de session** : Vérification que l'admin ne peut accéder qu'aux fichiers explicitement autorisés lors d'une session assumée.

---

## 3. Tests de Limites & Performance (Stress Tests)
Vérification des garde-fous techniques.

### Taille & Quotas
- **Upload > 30 Go** : Vérifier le rejet immédiat par le serveur via le header `Content-Length` et la validation streamée.
- **Saturation Quota** : Vérifier que l'utilisateur ne peut pas uploader 1 octet de plus que son forfait (Free/Pro/etc.).
- **Nettoyage Automatique** : Vérifier la purge automatique de la corbeille après 90 jours (simulation temporelle).

### Charge IA
- **Concurrence** : Simuler 10 utilisateurs posant des questions à Bobby simultanément pour vérifier la file d'attente et la stabilité locale de `brain-api`.

---

## 4. Tests Unitaires & Intégration (Jest)
Validation des briques logiques internes.

- **Services** : `encryptionService`, `mfaService`, `vaultService`.
- **Utilitaires** : `formatBytes`, `fileUtils`, `validationSchemas`.

---

## 5. Matrice de Responsabilité des Tests
| Type de Test | Outil | Fréquence | Cible |
| :--- | :--- | :--- | :--- |
| **E2E** | Cypress | CI/CD & Pré-release | Frontend + API |
| **Unitaires** | Jest | À chaque commit | Services Backend |
| **Audit Sécurité** | Scripts Node.js | Audit mensuel | Storage & DB |
| **Performance** | k6 / JMeter | Avant soutenance | Infrastructure |
