# 🤖 API Bobby le Robot - Documentation

## Endpoints disponibles

Tous les endpoints nécessitent une authentification JWT via le header `Authorization: Bearer <token>`.

Base URL : `http://localhost:5001/api/ai`

---

## 1. Chat général

Discuter avec Bobby le robot.

**Endpoint :** `POST /api/ai/chat`

**Body :**
```json
{
  "message": "Bonjour Bobby, comment ça va ?",
  "history": [
    {
      "role": "user",
      "parts": [{ "text": "Message précédent de l'utilisateur" }]
    },
    {
      "role": "model",
      "parts": [{ "text": "Réponse précédente de Bobby" }]
    }
  ]
}
```

**Response :**
```json
{
  "response": "Bonjour ! Je vais très bien, merci. Comment puis-je vous aider ?",
  "timestamp": "2025-12-16T15:30:00.000Z"
}
```

**Exemple avec curl :**
```bash
curl -X POST http://localhost:5001/api/ai/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Bonjour Bobby !"
  }'
```

---

## 2. Analyser un fichier

Demander à Bobby d'analyser le contenu d'un fichier (image, PDF, texte).

**Endpoint :** `POST /api/ai/analyze-file`

**Body :**
```json
{
  "fileId": "uuid-du-fichier",
  "prompt": "Décris ce que tu vois dans ce document" // Optionnel
}
```

**Response :**
```json
{
  "fileId": "uuid-du-fichier",
  "analysis": "Ce document est une facture d'électricité pour le mois de mars 2024. Le montant total est de 85.50€...",
  "timestamp": "2025-12-16T15:30:00.000Z"
}
```

**Formats supportés :**
- Images : PNG, JPG, JPEG, GIF, WebP
- PDF : Extraction de texte automatique
- Texte : TXT, JSON, JS, TS, etc.

**Exemple avec curl :**
```bash
curl -X POST http://localhost:5001/api/ai/analyze-file \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "abc-123-def-456",
    "prompt": "Résume ce document en 3 points"
  }'
```

---

## 3. Rechercher des fichiers

Recherche intelligente de fichiers avec extraction automatique des critères.

**Endpoint :** `POST /api/ai/search-files`

**Body :**
```json
{
  "query": "Trouve ma facture d'électricité de mars"
}
```

**Response :**
```json
{
  "files": [
    {
      "id": "file-uuid-1",
      "name": "facture_electricite_mars_2024.pdf",
      "mimeType": "application/pdf",
      "size": 245678,
      "createdAt": "2024-03-15T10:00:00.000Z",
      "folder": { ... },
      "tags": [ ... ]
    }
  ],
  "searchCriteria": {
    "keyword": "facture",
    "mimeType": "application/pdf"
  },
  "message": "J'ai trouvé 1 fichier correspondant à votre recherche.",
  "timestamp": "2025-12-16T15:30:00.000Z"
}
```

**Function Calling :** Bobby extrait automatiquement :
- `keyword` : Mot-clé à chercher dans le nom
- `mimeType` : Type de fichier (ex: `application/pdf`, `image/png`)
- `category` : Catégorie (image, video, doc, audio, other)
- `isFavorite` : Fichiers favoris

**Exemples de requêtes :**
- "Trouve mes images favorites"
- "Cherche tous mes fichiers PDF"
- "Où sont mes vidéos ?"
- "Montre-moi mes documents Word"

**Exemple avec curl :**
```bash
curl -X POST http://localhost:5001/api/ai/search-files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Cherche mes images favorites"
  }'
```

---

## 4. Générer un fichier

Créer un nouveau fichier avec du contenu généré par Bobby.

**Endpoint :** `POST /api/ai/generate-file`

**Body :**
```json
{
  "prompt": "Crée un résumé de réunion pour le projet SUPFILE avec les points suivants : nouvelle interface, API REST, intégration Gemini",
  "fileName": "resume_reunion_supfile.txt", // Optionnel
  "folderId": "uuid-du-dossier" // Optionnel
}
```

**Response :**
```json
{
  "file": {
    "id": "new-file-uuid",
    "name": "resume_reunion_supfile.txt",
    "mimeType": "text/plain",
    "size": 1024,
    "storagePath": "/app/uploads/generated-1234567890-resume_reunion_supfile.txt",
    "userId": "user-uuid",
    "folderId": "folder-uuid",
    "createdAt": "2025-12-16T15:30:00.000Z"
  },
  "content": "# Résumé de réunion - Projet SUPFILE\n\n## Points abordés\n\n1. **Nouvelle interface**...",
  "message": "Fichier \"resume_reunion_supfile.txt\" créé avec succès !",
  "timestamp": "2025-12-16T15:30:00.000Z"
}
```

**Notes :**
- Le fichier est automatiquement sauvegardé dans `/app/uploads`
- Le quota utilisateur est vérifié avant la création
- Par défaut, le nom du fichier est `document-genere-<timestamp>.txt`
- Le fichier est de type `text/plain`

**Exemple avec curl :**
```bash
curl -X POST http://localhost:5001/api/ai/generate-file \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Génère une liste de tâches pour organiser un événement",
    "fileName": "todolist_evenement.txt"
  }'
```

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| 401 | Non authentifié - Token JWT manquant ou invalide |
| 400 | Requête invalide - Paramètres manquants ou incorrects |
| 404 | Fichier non trouvé ou accès refusé |
| 500 | Erreur serveur - Erreur avec l'API Gemini ou problème interne |

**Exemple d'erreur :**
```json
{
  "error": "File not found or access denied"
}
```

---

## Configuration

### Variables d'environnement requises

```bash
# Dans backend/.env
GEMINI_API_KEY=your_gemini_api_key_here
UPLOAD_DIR=/app/uploads
```

### Obtenir une clé API Gemini

1. Va sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Connecte-toi avec ton compte Google
3. Clique sur "Create API Key"
4. Copie la clé et ajoute-la dans `.env`

---

## Limites

### API Gemini gratuite
- Requêtes par minute : 15 RPM
- Requêtes par jour : 1500 RPD
- Tokens par minute : 1M TPM

### Taille des fichiers
- Maximum : 5 GB (configuré dans `index.ts`)
- PDF : Extraction de texte uniquement (pas d'OCR)

---

## Exemples d'utilisation dans le frontend

```typescript
import { aiService } from '@/services/aiService';

// Chat
const response = await aiService.chat('Bonjour Bobby !');

// Analyser un fichier
const analysis = await aiService.analyzeFile('file-uuid', 'Résume ce document');

// Rechercher
const results = await aiService.searchFiles('Trouve mes factures PDF');

// Générer
const newFile = await aiService.generateFile('Crée une liste de courses', 'courses.txt');
```
