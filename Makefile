ifeq ($(OS),Windows_NT)
# Windows NT configuration
SHELL := cmd.exe
POWERSHELL := powershell.exe -ExecutionPolicy Bypass -File

ifeq ($(AI),1)
AI_ARG := -Ai
else
AI_ARG :=
endif

dev:
	@$(POWERSHELL) scripts/hot-start.ps1
start:
	@$(POWERSHELL) scripts/START.ps1 $(AI_ARG)
configure-network:
	@$(POWERSHELL) scripts/configure-network.ps1
help:
	@echo Usage: make ^<target^>
	@cmd /c echo.
	@echo Development:
	@echo   dev                  Start in hot-reload dev mode
	@echo   stop-dev             Stop dev services
	@echo   logs-dev             Follow dev logs
	@echo   db-push              Push Prisma schema to dev database
	@echo   configure-network    Detect local IP and update .env
	@cmd /c echo.
	@echo Production:
	@echo   start                Start in production mode (requires .env)
	@echo   start AI=1           Start in production mode with AI profile enabled
	@echo   stop                 Stop production services
	@echo   logs                 Follow production logs
	@cmd /c echo.
	@echo AI:
	@echo   pull-model [MODEL=name]  Pull Ollama model (default: gemma2:2b)
	@cmd /c echo.
	@echo Backup / Restore:
	@echo   backup               Backup PostgreSQL and MinIO (Unix only)
	@echo   restore POSTGRES=^<file^> MINIO=^<file^>  Restore from backup (Unix only)
	@cmd /c echo.
	@echo   clean                Stop all services and remove volumes
else
# Unix / Linux / macOS configuration
SHELL := /bin/bash

ifeq ($(AI),1)
AI_ARG := --ai
else
AI_ARG :=
endif

dev:
	@bash scripts/hot-start.sh
start:
	@bash scripts/START.sh $(AI_ARG)
configure-network:
	@bash scripts/configure-network.sh
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Development:"
	@echo "  dev                  Start in hot-reload dev mode"
	@echo "  stop-dev             Stop dev services"
	@echo "  logs-dev             Follow dev logs"
	@echo "  db-push              Push Prisma schema to dev database"
	@echo "  configure-network    Detect local IP and update .env"
	@echo ""
	@echo "Production:"
	@echo "  start                Start in production mode (requires .env)"
	@echo "  start AI=1           Start in production mode with AI profile enabled"
	@echo "  stop                 Stop production services"
	@echo "  logs                 Follow production logs"
	@echo ""
	@echo "AI:"
	@echo "  pull-model [MODEL=name]  Pull Ollama model (default: gemma2:2b)"
	@echo ""
	@echo "Backup / Restore:"
	@echo "  backup               Backup PostgreSQL and MinIO"
	@echo "  restore POSTGRES=<file> MINIO=<file>  Restore from backup"
	@echo ""
	@echo "  clean                Stop all services and remove volumes"
endif

COMPOSE_PROD := docker compose -f docker-compose.yml
COMPOSE_DEV  := docker compose -f docker-compose.dev.yml

.PHONY: dev start stop stop-dev logs logs-dev configure-network db-push pull-model backup restore clean help

stop:
	$(COMPOSE_PROD) down

stop-dev:
	$(COMPOSE_DEV) down

logs:
	$(COMPOSE_PROD) logs -f

logs-dev:
	$(COMPOSE_DEV) logs -f

db-push:
	$(COMPOSE_DEV) exec backend npx prisma db push

# Usage: make pull-model MODEL=qwen2.5:0.5b  (default: gemma2:2b)
pull-model:
	@docker compose -f docker-compose.dev.yml exec ollama ollama pull $(if $(MODEL),$(MODEL),gemma2:2b)

backup:
	@bash scripts/backup-vps.sh

# Usage: make restore POSTGRES=backups/postgres.sql MINIO=backups/minio.tar.gz
restore:
	@CONFIRM_RESTORE=yes bash scripts/restore-vps.sh $(POSTGRES) $(MINIO)

clean:
	$(COMPOSE_PROD) down -v --remove-orphans
	$(COMPOSE_DEV) down -v --remove-orphans 2>/dev/null || true
