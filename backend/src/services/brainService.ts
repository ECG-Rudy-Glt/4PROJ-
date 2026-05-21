/**
 * HTTP client for the brain-api RAG microservice.
 * Uses Node.js 20 native fetch - no extra dependency.
 */

const BRAIN_URL = process.env.BRAIN_API_URL || 'http://brain-api:8001';

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;

interface SearchResult {
  text: string;
  file_name: string;
  file_id: string;
  distance: number | null;
}

function isRetryable(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

async function post<T = any>(path: string, body: object, timeoutMs = 30_000): Promise<T> {
  let lastError: Error = new Error('brain-api unreachable');

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${BRAIN_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        lastError = new Error(`brain-api ${res.status}: ${msg}`);
        if (!isRetryable(res.status)) throw lastError;
      } else {
        return res.json() as Promise<T>;
      }
    } catch (err: any) {
      // AbortError = timeout - do not retry
      if (err.name === 'AbortError') throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }

    if (attempt < RETRY_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
    }
  }

  throw lastError;
}

export class BrainService {
  /**
   * Chunk and embed a file's text into ChromaDB.
   * Called fire-and-forget from fileIndexService - errors are non-fatal.
   */
  static async embedFile(
    fileId: string,
    userId: string,
    fileName: string,
    text: string,
  ): Promise<void> {
    await post('/embed', { file_id: fileId, user_id: userId, file_name: fileName, text });
  }

  /**
   * Semantic search - returns the N closest document chunks for this user.
   */
  static async search(userId: string, query: string, limit = 3): Promise<SearchResult[]> {
    const data = await post<{ results: SearchResult[] }>('/search', { user_id: userId, query, limit });
    return data.results;
  }

  /**
   * RAG chat - semantic search + LLM generation via Ollama.
   * Generous timeout: small model on CPU can take ~30s.
   */
  static async chat(userId: string, query: string, history: any[] = []): Promise<string> {
    const data = await post<{ response: string }>('/chat', { user_id: userId, query, history }, 120_000);
    return data.response;
  }

  /**
   * Analyze a specific text block (no vector search, direct LLM call).
   */
  static async analyze(text: string, question: string): Promise<string> {
    const data = await post<{ response: string }>('/analyze', { text, question }, 120_000);
    return data.response;
  }

  /**
   * Plain generation without RAG context (used for createGeneratedFile).
   */
  static async generate(prompt: string): Promise<string> {
    const data = await post<{ response: string }>('/generate', { prompt }, 120_000);
    return data.response;
  }

  /**
   * Remove all vector chunks for a deleted file.
   */
  static async deleteFile(fileId: string): Promise<void> {
    try {
      await fetch(`${BRAIN_URL}/embed/${fileId}`, { method: 'DELETE' });
    } catch {
      // Non-critical - vectors will be orphaned but won't affect other users
    }
  }
}
