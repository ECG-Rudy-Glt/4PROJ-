from fastembed import TextEmbedding
from typing import List

# sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 : ~220MB,
# supports French natively, available in fastembed 0.3.x.
# query_embed() is safe to call — for non-e5 models it behaves like embed().
EMBED_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


class Embedder:
    def __init__(self) -> None:
        # Downloaded automatically on first use and cached in ~/.cache/fastembed
        self._model = TextEmbedding(EMBED_MODEL)

    def embed(self, texts: List[str]) -> List[List[float]]:
        """For document/passage indexing — adds 'passage:' prefix."""
        return [e.tolist() for e in self._model.embed(texts)]

    def embed_query(self, query: str) -> List[float]:
        """For search queries — adds 'query:' prefix. Must NOT use embed() here."""
        return next(self._model.query_embed([query])).tolist()


embedder = Embedder()
