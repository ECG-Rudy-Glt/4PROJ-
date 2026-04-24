FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

RUN mkdir -p /app/chromadb /.cache && chown -R nobody:nogroup /app/chromadb /.cache
ENV XDG_CACHE_HOME=/.cache

EXPOSE 8001

USER nobody

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
