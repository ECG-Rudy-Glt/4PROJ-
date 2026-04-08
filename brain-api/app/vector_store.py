import os
from typing import Any, Dict, List

import chromadb
from chromadb.config import Settings


class VectorStore:
    def __init__(self) -> None:
        chroma_path = os.getenv("CHROMA_PATH", "/app/chromadb")
        self._client = chromadb.PersistentClient(
            path=chroma_path,
            settings=Settings(anonymized_telemetry=False),
        )
        self._col = self._client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"},
        )

    # ------------------------------------------------------------------
    def add_chunks(
        self,
        file_id: str,
        user_id: str,
        file_name: str,
        chunks: List[str],
        embeddings: List[List[float]],
    ) -> None:
        # Delete any previous version of this file before re-inserting
        self.delete_file(file_id)

        ids = [f"{file_id}__chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "file_id": file_id,
                "user_id": user_id,
                "file_name": file_name,
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]
        self._col.add(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)

    # ------------------------------------------------------------------
    def search(
        self,
        user_id: str,
        query_embedding: List[float],
        limit: int = 3,
    ) -> List[Dict[str, Any]]:
        results = self._col.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where={"user_id": user_id},
        )

        docs = results.get("documents", [[]])[0]
        if not docs:
            return []

        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[None] * len(docs)])[0]

        return [
            {
                "text": docs[i],
                "file_name": metas[i]["file_name"],
                "file_id": metas[i]["file_id"],
                "distance": distances[i],
            }
            for i in range(len(docs))
        ]

    # ------------------------------------------------------------------
    def delete_file(self, file_id: str) -> None:
        try:
            existing = self._col.get(where={"file_id": file_id})
            if existing["ids"]:
                self._col.delete(ids=existing["ids"])
        except Exception:
            pass


vector_store = VectorStore()
