ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
    SHELL := cmd.exe
    POWERSHELL := powershell.exe -ExecutionPolicy Bypass -File
    NULL_REDIRECT := 2>nul
    CHECK_NODE := where node >nul 2>nul
    CHECK_NPM := where npm >nul 2>nul
    MOBILE_DIR := mobile
    ifeq ($(AI),1)
        AI_ARG := -Ai
    else
        AI_ARG :=
    endif
else
    DETECTED_OS := Unix
    SHELL := /bin/bash
    NULL_REDIRECT := 2>/dev/null
    CHECK_NODE := command -v node >/dev/null 2>&1
    CHECK_NPM := command -v npm >/dev/null 2>&1
    MOBILE_DIR := mobile
    ifeq ($(AI),1)
        AI_ARG := --ai
    else
        AI_ARG :=
    endif
endif


COMPOSE_PROD := docker compose -f docker-compose.yml
COMPOSE_DEV  := docker compose -f docker-compose.dev.yml
DEFAULT_MODEL := gemma2:2b


.PHONY: help \
        dev stop-dev logs-dev db-push \
        start stop logs \
        mobile mobile-android mobile-ios mobile-web mobile-install mobile-clean mobile-tunnel \
        configure-network \
        pull-model \
        backup restore \
        clean status

.DEFAULT_GOAL := help

# 
# HELP
ifeq ($(DETECTED_OS),Windows)
help:
	@echo.
	@echo  ======================================================
	@echo   SUPFILE - Development ^& Production Commands
	@echo  ======================================================
	@echo.
	@echo  DEVELOPMENT (Docker):
	@echo    make dev                 Start hot-reload dev mode
	@echo    make stop-dev            Stop dev services
	@echo    make logs-dev            Follow dev logs
	@echo    make db-push             Push Prisma schema to database
	@echo.
	@echo  PRODUCTION (Docker):
	@echo    make start               Start production services
	@echo    make start AI=1          Start with AI profile enabled
	@echo    make stop                Stop production services
	@echo    make logs                Follow production logs
	@echo.
	@echo  MOBILE (Expo):
	@echo    make mobile              Start Expo dev server (auto-installs deps)
	@echo    make mobile-android      Run on Android device/emulator
	@echo    make mobile-ios          Run on iOS simulator (macOS only)
	@echo    make mobile-web          Run in web browser
	@echo    make mobile-install      Install mobile dependencies
	@echo    make mobile-clean        Clean mobile cache and reinstall
	@echo    make mobile-tunnel       Start Expo with tunnel mode
	@echo.
	@echo  CONFIGURATION:
	@echo    make configure-network   Detect local IP and update .env
	@echo    make status              Show running containers status
	@echo.
	@echo  AI/ML:
	@echo    make pull-model          Pull default Ollama model (gemma2:2b)
	@echo    make pull-model MODEL=x  Pull specific model (e.g., qwen2.5:0.5b)
	@echo.
	@echo  MAINTENANCE:
	@echo    make clean               Stop all ^& remove volumes
	@echo    make backup              Backup PostgreSQL ^& MinIO (Unix)
	@echo    make restore             Restore from backup (Unix)
	@echo.
else
help:
	@echo ""
	@echo "======================================================"
	@echo "  SUPFILE - Development & Production Commands"
	@echo "======================================================"
	@echo ""
	@echo "DEVELOPMENT (Docker):"
	@echo "  make dev                 Start hot-reload dev mode"
	@echo "  make stop-dev            Stop dev services"
	@echo "  make logs-dev            Follow dev logs"
	@echo "  make db-push             Push Prisma schema to database"
	@echo ""
	@echo "PRODUCTION (Docker):"
	@echo "  make start               Start production services"
	@echo "  make start AI=1          Start with AI profile enabled"
	@echo "  make stop                Stop production services"
	@echo "  make logs                Follow production logs"
	@echo ""
	@echo "MOBILE (Expo):"
	@echo "  make mobile              Start Expo dev server (auto-installs deps)"
	@echo "  make mobile-android      Run on Android device/emulator"
	@echo "  make mobile-ios          Run on iOS simulator (macOS only)"
	@echo "  make mobile-web          Run in web browser"
	@echo "  make mobile-install      Install mobile dependencies"
	@echo "  make mobile-clean        Clean mobile cache and reinstall"
	@echo "  make mobile-tunnel       Start Expo with tunnel mode"
	@echo ""
	@echo "CONFIGURATION:"
	@echo "  make configure-network   Detect local IP and update .env"
	@echo "  make status              Show running containers status"
	@echo ""
	@echo "AI/ML:"
	@echo "  make pull-model          Pull default Ollama model (gemma2:2b)"
	@echo "  make pull-model MODEL=x  Pull specific model (e.g., qwen2.5:0.5b)"
	@echo ""
	@echo "MAINTENANCE:"
	@echo "  make clean               Stop all & remove volumes"
	@echo "  make backup              Backup PostgreSQL & MinIO"
	@echo "  make restore             Restore from backup"
	@echo ""
endif

# DEVELOPMENT TARGETS
# 
ifeq ($(DETECTED_OS),Windows)
dev:
	@$(POWERSHELL) scripts/hot-start.ps1
else
dev:
	@bash scripts/hot-start.sh
endif

stop-dev:
	@$(COMPOSE_DEV) down

logs-dev:
	@$(COMPOSE_DEV) logs -f

db-push:
	@$(COMPOSE_DEV) exec backend npx prisma db push

# PRODUCTION TARGETS

ifeq ($(DETECTED_OS),Windows)
start:
	@$(POWERSHELL) scripts/START.ps1 $(AI_ARG)
else
start:
	@bash scripts/START.sh $(AI_ARG)
endif

stop:
	@$(COMPOSE_PROD) down

logs:
	@$(COMPOSE_PROD) logs -f

# =============================================================================
# MOBILE TARGETS (Expo)
# =============================================================================
ifeq ($(DETECTED_OS),Windows)
mobile:
	@$(POWERSHELL) scripts/start-mobile.ps1

mobile-android:
	@$(POWERSHELL) scripts/start-mobile.ps1 -Platform android

mobile-ios:
	@echo iOS development requires macOS
	@exit 1

mobile-web:
	@$(POWERSHELL) scripts/start-mobile.ps1 -Platform web

mobile-install:
	@$(POWERSHELL) scripts/start-mobile.ps1 -InstallOnly

mobile-clean:
	@$(POWERSHELL) scripts/start-mobile.ps1 -Clean

mobile-tunnel:
	@$(POWERSHELL) scripts/start-mobile.ps1 -Tunnel
else
mobile:
	@bash scripts/start-mobile.sh

mobile-android:
	@bash scripts/start-mobile.sh --android

mobile-ios:
	@bash scripts/start-mobile.sh --ios

mobile-web:
	@bash scripts/start-mobile.sh --web

mobile-install:
	@bash scripts/start-mobile.sh --install-only

mobile-clean:
	@bash scripts/start-mobile.sh --clean

mobile-tunnel:
	@bash scripts/start-mobile.sh --tunnel
endif

# =============================================================================
# CONFIGURATION TARGETS
# =============================================================================
ifeq ($(DETECTED_OS),Windows)
configure-network:
	@$(POWERSHELL) scripts/configure-network.ps1
else
configure-network:
	@bash scripts/configure-network.sh
endif

status:
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "supfile|NAME" || docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# =============================================================================
# AI/ML TARGETS
# =============================================================================
pull-model:
	@docker compose -f docker-compose.dev.yml exec ollama ollama pull $(if $(MODEL),$(MODEL),$(DEFAULT_MODEL))

# =============================================================================
# BACKUP / RESTORE TARGETS (Unix primarily)
# =============================================================================
backup:
ifeq ($(DETECTED_OS),Windows)
	@echo Backup is currently supported on Unix/Linux/macOS only
else
	@bash scripts/backup-vps.sh
endif

restore:
ifeq ($(DETECTED_OS),Windows)
	@echo Restore is currently supported on Unix/Linux/macOS only
else
ifndef POSTGRES
	$(error POSTGRES file is required. Usage: make restore POSTGRES=<file> MINIO=<file>)
endif
ifndef MINIO
	$(error MINIO file is required. Usage: make restore POSTGRES=<file> MINIO=<file>)
endif
	@CONFIRM_RESTORE=yes bash scripts/restore-vps.sh $(POSTGRES) $(MINIO)
endif

# =============================================================================
# MAINTENANCE TARGETS
# =============================================================================
clean:
	@$(COMPOSE_PROD) down -v --remove-orphans $(NULL_REDIRECT) || true
	@$(COMPOSE_DEV) down -v --remove-orphans $(NULL_REDIRECT) || true
ifeq ($(DETECTED_OS),Windows)
	@echo Cleanup complete
else
	@echo "Cleanup complete"
endif
