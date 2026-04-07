import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict

from .rag import analyze_text, chat_with_rag, embed_and_store, generate_text, search_documents
from .vector_store import vector_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("brain-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("brain-api starting — embedder + ChromaDB ready")
    yield
    logger.info("brain-api shutting down")


app = FastAPI(title="brain-api", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class EmbedRequest(BaseModel):
    file_id: str
    user_id: str
    file_name: str
    text: str


class SearchRequest(BaseModel):
    user_id: str
    query: str
    limit: int = 3


class ChatRequest(BaseModel):
    user_id: str
    query: str
    history: Optional[List[Dict[str, str]]] = None


class AnalyzeRequest(BaseModel):
    text: str
    question: str


class GenerateRequest(BaseModel):
    prompt: str


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
