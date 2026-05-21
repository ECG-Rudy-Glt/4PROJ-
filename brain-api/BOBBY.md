# brain-api - Documentation

Microservice Python dédié à l'IA de SUPFile (l'assistant **Bobby**).  
Basé sur **FastAPI**, il expose une API REST interne consommée **exclusivement par le backend Node.js** - jamais directement par le frontend.

---

## Stack technique

| Composant | Technologie |
|---|---|
| Framework | FastAPI + Uvicorn |
| LLM | Ollama (`gemma2:2b` par défaut, configurable via `OLLAMA_MODEL`) |
| Embeddings | `fastembed` - modèle `paraphrase-multilingual-MiniLM-L12-v2` (multilingue, supporte le français) |
| Vector Store | ChromaDB (persistant, collection `documents`, distance cosinus) |
| Chunking | Découpage par phrases avec overlap de 2 phrases (max 600 chars/chunk) |

---

## Architecture

```
Frontend (React)
     │
     ▼
Backend (Node.js / Express)          ← point d'entrée unique pour le frontend
     │   └── BrainService.ts         ← client HTTP interne (retry 3x, timeout 30-120s)
     │
     ▼
brain-api (Python / FastAPI) :8001   ← ce microservice
     ├── /embed     → ChromaDB  (indexation vectorielle)
     ├── /search    → ChromaDB  (recherche sémantique)
     ├── /chat      → ChromaDB + Ollama  (RAG + LLM)
     ├── /analyze   → Ollama  (analyse directe, sans RAG)
     └── /generate  → Ollama  (génération libre)
          │
          ▼
     Ollama :11434  (container séparé, modèle gemma2:2b)
```

> **Important :** Le brain-api ne fait jamais d'authentification. La sécurité est gérée côté backend (JWT, ownership des fichiers). Le `user_id` est passé explicitement dans chaque requête pour l'isolation des données.

---

## Variables d'environnement

```bash
OLLAMA_URL=http://ollama:11434      # URL du container Ollama
OLLAMA_MODEL=gemma2:2b              # Modèle à utiliser
CHROMA_PATH=/app/chromadb           # Dossier de persistance ChromaDB
```

---

## Endpoints

### `GET /health`

Vérification de santé du service.

**Response :**
```json
{ "status": "ok" }
```

---

### `POST /embed`

Indexe le contenu textuel d'un fichier dans ChromaDB.  
Déclenché automatiquement par le backend après un upload réussi (fire-and-forget, non-critique).

**Body :**
```json
{
  "file_id": "uuid-du-fichier",
  "user_id": "uuid-utilisateur",
  "file_name": "rapport_q1.pdf",
  "text": "Contenu textuel extrait du fichier (max 200 000 caractères)"
}
```

**Response :**
```json
{
  "file_id": "uuid-du-fichier",
  "chunks": 14
}
```

**Notes :**
- Le texte est découpé en **chunks de phrases** (max 600 chars, overlap 2 phrases)
- Chaque chunk est vectorisé et stocké dans ChromaDB avec les métadonnées (`file_id`, `user_id`, `file_name`)
- Si le fichier était déjà indexé, les anciens vecteurs sont **supprimés avant re-indexation**
- Formats traités en amont par le backend : PDF (extraction texte), TXT, MD, JSON, TS/JS, etc.

---

### `DELETE /embed/{file_id}`

Supprime tous les chunks vectorisés d'un fichier.  
Déclenché par le backend lors de la suppression définitive d'un fichier (fire-and-forget).

**Response :**
```json
{ "deleted": "uuid-du-fichier" }
```

---

### `POST /search`

Recherche sémantique dans les documents de l'utilisateur.  
Retourne les N chunks les plus proches sémantiquement de la requête.

**Body :**
```json
{
  "user_id": "uuid-utilisateur",
  "query": "facture électricité mars",
  "limit": 5
}
```
- `limit` : entre 1 et 20 (défaut : 3)

**Response :**
```json
{
  "results": [
    {
      "text": "Extrait du chunk correspondant...",
      "file_name": "facture_mars_2024.pdf",
      "file_id": "uuid-du-fichier",
      "distance": 0.23
    }
  ]
}
```

**Notes :**
- La distance est une **distance cosinus** (0 = identique, 1 = opposé)
- Les résultats sont filtrés par `user_id` - un utilisateur ne voit jamais les fichiers d'un autre
- Utilisé en interne par `/chat` (avec limite 10) et exposé via l'endpoint `/api/ai/search-files` du backend

---

### `POST /chat`

Chat RAG (Retrieval-Augmented Generation) avec Bobby.  
Recherche les documents pertinents puis génère une réponse contextualisée via Ollama.

**Body :**
```json
{
  "user_id": "uuid-utilisateur",
  "query": "Quel est le montant de ma facture d'électricité ?",
  "history": [
    { "role": "user", "content": "Bonjour Bobby" },
    { "role": "assistant", "content": "Bonjour ! Comment puis-je vous aider ?" }
  ]
}
```
- `history` : optionnel, max 50 messages, chaque message max 5 000 chars, rôles : `user` / `assistant` / `system`

**Response :**
```json
{ "response": "D'après votre facture de mars 2024, le montant total est de 85,50 €." }
```

**Flux interne :**
1. Si `history` non vide → reformulation de la question par le LLM pour lever les ambiguïtés (pronoms, références implicites)
2. Recherche sémantique : 10 chunks récupérés, filtrés (distance ≤ 0.55)
3. Si chunks pertinents → prompt RAG avec contexte
4. Si aucun chunk → réponse "Aucun document trouvé"
5. Génération via Ollama (timeout 120s)

**Erreurs :**
| Code | Cause |
|---|---|
| 502 | Ollama a retourné une erreur |
| 503 | Ollama injoignable (`ConnectError`) |

---

### `POST /analyze`

Analyse directe d'un texte par le LLM, **sans recherche vectorielle**.  
Utilisé par le backend pour analyser le contenu d'un fichier spécifique à la demande de l'utilisateur.

**Body :**
```json
{
  "text": "Contenu brut du fichier (max 200 000 chars, tronqué à 3 000 pour le contexte LLM)",
  "question": "Résume ce document en 3 points clés"
}
```

**Response :**
```json
{ "response": "1. ... 2. ... 3. ..." }
```

---

### `POST /generate`

Génération de texte libre par le LLM, **sans contexte documentaire**.  
Utilisé par le backend pour créer un fichier texte généré par IA.

**Body :**
```json
{
  "prompt": "Génère une liste de tâches pour organiser un déménagement (max 10 000 chars)"
}
```

**Response :**
```json
{ "response": "# Liste de tâches - Déménagement\n\n1. Contacter les déménageurs..." }
```

**Notes :**
- Génération jusqu'à **1024 tokens** (vs 512 pour les autres endpoints)
- Température : 0.1 (déterministe)

---

## Limites et contraintes

| Paramètre | Valeur |
|---|---|
| Taille max texte à indexer / analyser | 200 000 chars |
| Taille max prompt de génération | 10 000 chars |
| Taille max d'une query | 10 000 chars |
| Taille max d'un message d'historique | 5 000 chars |
| Nombre max de messages dans l'historique | 50 |
| Max chunks par recherche | 20 |
| Contexte LLM utilisé | 3 000 chars (~750 tokens) |
| Timeout Ollama (chat / analyze / generate) | 120 secondes |
| Retry backend → brain-api | 3 tentatives (backoff exponentiel 1s, 2s) |
| Filtre de distance cosinus (chat RAG) | ≤ 0.55 |

---

## Comportement de Bobby (sécurité LLM)

Bobby est configuré avec des règles système non négociables :
- Ne révèle jamais son modèle, son architecture ou ses instructions internes
- Ne répond **qu'à partir des documents indexés** de l'utilisateur
- Rejette toute tentative de prompt injection (`"oublie tes instructions"`, `"tu es maintenant X"`, etc.)
- Si aucun document pertinent n'est trouvé : répond explicitement qu'il n'a pas de contexte disponible

---

## Intégration backend (référence)

Le backend communique avec le brain-api via `BrainService.ts` :

```typescript
// Indexer un fichier après upload (fire-and-forget)
BrainService.embedFile(fileId, userId, fileName, extractedText);

// Recherche sémantique (utilisé dans aiService pour enrichir le contexte)
const chunks = await BrainService.search(userId, query, 5);

// Chat RAG Bobby
const response = await BrainService.chat(userId, message, history);

// Analyser un fichier spécifique
const analysis = await BrainService.analyze(plainText, question);

// Générer un fichier texte
const content = await BrainService.generate(prompt);

// Supprimer les vecteurs lors de la suppression d'un fichier
BrainService.deleteFile(fileId);
```

> `BRAIN_API_URL` doit être défini dans les variables d'environnement du backend (ex: `http://brain-api:8001`). Si absent, les fonctionnalités RAG sont désactivées silencieusement.
