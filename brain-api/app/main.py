import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from .rag import analyze_text, chat_with_rag, embed_and_store, generate_text, search_documents
from .vector_store import vector_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("brain-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("brain-api starting - embedder + ChromaDB ready")
    yield
    logger.info("brain-api shutting down")


app = FastAPI(title="brain-api", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

MAX_QUERY_CHARS    = 10_000
MAX_HISTORY_MSGS   = 50
MAX_MSG_CHARS      = 5_000
MAX_TEXT_CHARS     = 200_000
MAX_PROMPT_CHARS   = 10_000


class EmbedRequest(BaseModel):
    file_id: str
    user_id: str
    file_name: str
    text: str = Field(max_length=MAX_TEXT_CHARS)


class SearchRequest(BaseModel):
    user_id: str
    query: str = Field(max_length=MAX_QUERY_CHARS)
    limit: int = Field(default=3, ge=1, le=20)


class ChatRequest(BaseModel):
    user_id: str
    query: str = Field(max_length=MAX_QUERY_CHARS)
    history: Optional[List[Dict[str, str]]] = None

    @field_validator("history")
    @classmethod
    def validate_history(cls, v: Optional[List[Dict[str, str]]]) -> Optional[List[Dict[str, str]]]:
        if v is None:
            return v
        if len(v) > MAX_HISTORY_MSGS:
            raise ValueError(f"history must not exceed {MAX_HISTORY_MSGS} messages")
        for msg in v:
            if msg.get("role") not in ("user", "assistant", "system"):
                raise ValueError("history[].role must be 'user', 'assistant' or 'system'")
            if len(msg.get("content", "")) > MAX_MSG_CHARS:
                raise ValueError(f"each history message must not exceed {MAX_MSG_CHARS} chars")
        return v


class AnalyzeRequest(BaseModel):
    text: str = Field(max_length=MAX_TEXT_CHARS)
    question: str = Field(max_length=MAX_QUERY_CHARS)


class GenerateRequest(BaseModel):
    prompt: str = Field(max_length=MAX_PROMPT_CHARS)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/embed")
def embed(req: EmbedRequest):
    n_chunks = embed_and_store(req.file_id, req.user_id, req.file_name, req.text)
    logger.info("Embedded %d chunks for file %s (user %s)", n_chunks, req.file_id, req.user_id)
    return {"file_id": req.file_id, "chunks": n_chunks}


@app.post("/search")
def search(req: SearchRequest):
    results = search_documents(req.user_id, req.query, req.limit)
    return {"results": results}


@app.post("/chat")
def chat(req: ChatRequest):
    try:
        response = chat_with_rag(req.user_id, req.query, req.history)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Ollama error: {exc.response.text}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama unreachable. Is the container running?")
    return {"response": response}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    try:
        response = analyze_text(req.text, req.question)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama unreachable.")
    return {"response": response}


@app.post("/generate")
def generate(req: GenerateRequest):
    try:
        response = generate_text(req.prompt)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama unreachable.")
    return {"response": response}


@app.delete("/embed/{file_id}")
def delete_embed(file_id: str):
    vector_store.delete_file(file_id)
    logger.info("Deleted vectors for file %s", file_id)
    return {"deleted": file_id}
