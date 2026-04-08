#!/bin/bash
# Pull the Ollama model into the running Ollama container.
# Run this ONCE after first `docker compose up`:
#   ./brain-api/pull_model.sh
# Or specify a different model:
#   ./brain-api/pull_model.sh qwen2.5:0.5b
#
# The model is stored in the `ollama_data` Docker volume and persists
# across restarts — no need to pull again unless you change the model.

set -e

MODEL="${1:-gemma2:2b}"

echo "Pulling model '$MODEL' into the Ollama container..."
docker compose exec ollama ollama pull "$MODEL"
echo "Done. Bobby is ready."
