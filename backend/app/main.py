"""FastAPI app for Scaffold Forge."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import forge_config, health, options, scaffold, settings, templates
from app.core.settings import ensure_templates_dir
from app.core.templates import seed_builtin_templates


@asynccontextmanager
async def lifespan(_app: FastAPI):
    seed_builtin_templates()
    ensure_templates_dir()
    yield


app = FastAPI(
    title="Scaffold Forge",
    description="Opinionated app scaffolding tool with constraint validation",
    version="1.0.0",
    lifespan=lifespan,
)

frontend_port = os.getenv("FRONTEND_PORT", "3000")
default_origins = f"http://localhost:{frontend_port},http://localhost:3000"
origins = os.getenv("CORS_ORIGINS", default_origins).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(options.router, prefix="/api", tags=["options"])
app.include_router(scaffold.router, prefix="/api/scaffold", tags=["scaffold"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(forge_config.router, prefix="/api/config", tags=["config"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
