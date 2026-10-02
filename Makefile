.PHONY: dev dev-backend dev-frontend build docker-up docker-down test

# Local development — auto-finds free ports
dev:
	python scripts/dev.py

# Manual single-service start (reads BACKEND_PORT / FRONTEND_PORT from .env)
dev-backend:
	cd backend && uvicorn app.main:app --reload --port $${BACKEND_PORT:-8000}

dev-frontend:
	cd frontend && npm run dev -- --port $${FRONTEND_PORT:-3000}

# Docker
docker-up:
	docker compose up --build

docker-down:
	docker compose down

# Build
build:
	cd frontend && npm run build

# Test
test:
	cd backend && python -m pytest tests/ -v

# Electron
electron-dev:
	cd electron && npm run dev

electron-build:
	cd electron && npm run build

# Generate built-in templates
seed-templates:
	cd backend && python -c "from app.core.templates import seed_builtin_templates; seed_builtin_templates()"
