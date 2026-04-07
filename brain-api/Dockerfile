FROM python:3.11-slim

WORKDIR /app

# No build tools needed — llama.cpp is handled by Ollama, not here
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8001

USER nobody

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
