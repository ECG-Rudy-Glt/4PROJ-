#!/bin/bash
# Pull the Qwen2.5 model into the running Ollama container.
# Run this ONCE after first `docker compose up`:
#   ./brain-api/pull_model.sh
#
# The model is stored in the `ollama_data` Docker volume and persists
# across restarts — no need to pull again unless you change the model.

set -e

MODEL="${1:-qwen2.5:0.5b}"

echo "Pulling model '$MODEL' into the Ollama container..."
docker compose exec ollama ollama pull "$MODEL"
echo "Done. Bobby is ready."
