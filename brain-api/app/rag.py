import re
from typing import Any, Dict, List

from .embedder import embedder
from .llm import generate
from .vector_store import vector_store

# Sentence-based chunking — respects sentence boundaries to preserve meaning.
# A chunk groups sentences until MAX_CHUNK_CHARS is reached, then rolls over
# with OVERLAP_SENTENCES sentences of context from the previous chunk.
MAX_CHUNK_CHARS = 600
OVERLAP_SENTENCES = 2
MAX_CONTEXT_CHARS = 1_400  # stays well inside 2048-token context window

# Sentence boundary: ends with . ! ? followed by whitespace or end-of-string
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


# ---------------------------------------------------------------------------
# Chunking — sentence-based with sentence-level overlap
# ---------------------------------------------------------------------------

def _chunk_text(text: str) -> List[str]:
    """
    Split text into chunks that respect sentence boundaries.
    Better than fixed-character splitting which breaks words and sentences mid-way.
    """
    sentences = [s.strip() for s in _SENTENCE_RE.split(text.strip()) if s.strip()]
    if not sentences:
        return []

    chunks: List[str] = []
    current: List[str] = []
    current_len = 0

    for sentence in sentences:
        if current_len + len(sentence) > MAX_CHUNK_CHARS and current:
            chunks.append(" ".join(current))
            # Keep last OVERLAP_SENTENCES sentences for context continuity
            current = current[-OVERLAP_SENTENCES:]
            current_len = sum(len(s) for s in current)
        current.append(sentence)
        current_len += len(sentence)

    if current:
        chunks.append(" ".join(current))

    return chunks


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def embed_and_store(file_id: str, user_id: str, file_name: str, text: str) -> int:
    chunks = _chunk_text(text)
    if not chunks:
        return 0
    embeddings = embedder.embed(chunks)
    vector_store.add_chunks(file_id, user_id, file_name, chunks, embeddings)
    return len(chunks)


def search_documents(user_id: str, query: str, limit: int = 3) -> List[Dict[str, Any]]:
    # Use query_embed() — adds the "query:" prefix required by e5 models
    query_embedding = embedder.embed_query(query)
    return vector_store.search(user_id, query_embedding, limit)


def chat_with_rag(user_id: str, query: str, history: List[Dict[str, str]] = None) -> str:
    chunks = search_documents(user_id, query, limit=3)

    if chunks:
        context = "\n\n".join(
            f"[{c['file_name']}]\n{c['text']}" for c in chunks
        )[:MAX_CONTEXT_CHARS]
        system = (
            "Tu es Bobby, un assistant de gestion de fichiers RIGOUREUX et STRICT.\n"
            "RÈGLE 1 : Tu ne peux répondre qu'aux questions portant SEULEMENT sur les extraits de documents fournis ci-dessous.\n"
            "RÈGLE 2 : Tu as INTERDICTION FORMELLE d'utiliser tes connaissances générales ou de répondre à des sujets extérieurs aux documents.\n"
            "RÈGLE 3 : Si la réponse n'est pas EXPLICITEMENT dans les extraits, affirme clairement 'Je ne trouve pas cette information dans vos documents.' sans rien inventer."
        )
        prompt = f"Extraits de documents :\n{context}\n\nQuestion de l'utilisateur : {query}"
    else:
        system = (
            "Tu es Bobby, un assistant de gestion de fichiers STRICT.\n"
            "Si l'utilisateur ne te donne pas de document pour faire une recherche, tu dois lui dire 'Aucun document trouvé pour répondre à votre question. Je ne réponds qu'aux questions concernant vos documents.'"
        )
        prompt = f"Question : {query}"

    return generate(prompt, system=system, history=history)


def analyze_text(text: str, question: str) -> str:
    truncated = text[:MAX_CONTEXT_CHARS] + ("…" if len(text) > MAX_CONTEXT_CHARS else "")
    system = "Tu es un assistant d'analyse de documents. Réponds en français."
    prompt = f"Contenu du document :\n{truncated}\n\nQuestion : {question}"
    return generate(prompt, system=system)


def generate_text(prompt: str) -> str:
    system = "Tu es un assistant créatif. Génère du contenu en français selon les instructions."
    return generate(prompt, system=system, max_tokens=1024)
