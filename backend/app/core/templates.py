"""Template system. Save/load/list/delete scaffold configs as JSON."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any

TEMPLATES_DIR = (
    Path(os.environ["SCAFFOLD_DATA_DIR"]) / "templates"
    if os.environ.get("SCAFFOLD_DATA_DIR")
    else Path(__file__).resolve().parent.parent.parent / "config" / "templates"
)


def _ensure_dir():
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)


def list_templates() -> list[dict[str, Any]]:
    _ensure_dir()
    templates = []
    for f in sorted(TEMPLATES_DIR.glob("*.json")):
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
            data["id"] = f.stem
            templates.append(data)
    return templates


def get_template(template_id: str) -> dict[str, Any] | None:
    _ensure_dir()
    path = TEMPLATES_DIR / f"{template_id}.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
        data["id"] = template_id
        return data


def save_template(name: str, config: dict[str, Any], template_id: str | None = None) -> str:
    _ensure_dir()
    tid = template_id or str(uuid.uuid4())[:8]
    data = {"name": name, "config": config}
    path = TEMPLATES_DIR / f"{tid}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return tid


def delete_template(template_id: str) -> bool:
    path = TEMPLATES_DIR / f"{template_id}.json"
    if path.exists():
        path.unlink()
        return True
    return False


def seed_builtin_templates():
    """Create built-in Wolf templates if they don't exist."""
    _ensure_dir()

    builtins = {
        "wolf-saas": {
            "name": "Wolf Standard SaaS Stack",
            "config": {
                "intent": {"project_type": "saas", "users": "public", "lifespan": "long_term"},
                "data_lifecycle": {"survive_restart": "yes", "return_to_previous": "yes", "search_query": "yes", "user_data_isolation": "yes"},
                "stack": {
                    "target": "linux", "backend": "fastapi", "backend_language": "python", "runtime": "venv",
                    "frontend": "react", "styling": "tailwind", "component_library": "shadcn", "theme": "dark",
                    "database": "postgresql", "database_addons": ["redis"], "orm": "sqlalchemy",
                    "auth": "jwt", "multiuser": "yes", "docker": "yes", "cicd": "github_actions",
                    "ai_integration": "multi", "ai_primary_provider": "anthropic", "ai_pattern": "response_agent",
                    "git": "pre_commit", "build": "makefile", "linting": "both",
                }
            }
        },
        "wolf-internal": {
            "name": "Wolf Internal Tool",
            "config": {
                "intent": {"project_type": "internal_tool", "users": "small_team", "lifespan": "medium_term"},
                "data_lifecycle": {"survive_restart": "yes", "return_to_previous": "yes", "search_query": "no", "user_data_isolation": "no"},
                "stack": {
                    "target": "linux", "backend": "fastapi", "backend_language": "python", "runtime": "venv",
                    "frontend": "react", "styling": "tailwind", "component_library": "shadcn", "theme": "dark",
                    "database": "sqlite", "orm": "sqlalchemy",
                    "auth": "api_key", "multiuser": "no", "docker": "no",
                    "ai_integration": "single", "ai_primary_provider": "anthropic", "ai_pattern": "response_agent",
                    "git": "init", "build": "makefile", "linting": "ruff",
                }
            }
        },
        "wolf-pipeline": {
            "name": "Wolf Processing Pipeline",
            "config": {
                "intent": {"project_type": "internal_tool", "users": "just_me", "lifespan": "medium_term"},
                "data_lifecycle": {"survive_restart": "no", "return_to_previous": "no", "search_query": "no", "user_data_isolation": "no"},
                "stack": {
                    "target": "linux", "backend": "fastapi", "backend_language": "python", "runtime": "venv",
                    "frontend": "react", "styling": "tailwind", "component_library": "shadcn", "theme": "dark",
                    "database": "none", "orm": "none",
                    "auth": "none", "multiuser": "no", "docker": "no",
                    "ai_integration": "single", "ai_primary_provider": "anthropic", "ai_pattern": "response_agent",
                    "git": "init", "build": "makefile", "linting": "ruff",
                }
            }
        },
        "wolf-desktop": {
            "name": "Wolf Local Desktop Tool",
            "config": {
                "intent": {"project_type": "desktop_app", "users": "just_me", "lifespan": "long_term"},
                "data_lifecycle": {"survive_restart": "yes", "return_to_previous": "yes", "search_query": "no", "user_data_isolation": "no"},
                "stack": {
                    "target": "electron", "backend": "fastapi", "backend_language": "python", "runtime": "venv",
                    "frontend": "react", "styling": "tailwind", "component_library": "shadcn", "theme": "dark",
                    "database": "json_files", "orm": "none",
                    "auth": "none", "multiuser": "no", "docker": "no",
                    "ai_integration": "single", "ai_primary_provider": "anthropic", "ai_pattern": "response_agent",
                    "git": "init", "build": "makefile", "linting": "both",
                }
            }
        },
    }

    for tid, data in builtins.items():
        path = TEMPLATES_DIR / f"{tid}.json"
        if not path.exists():
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
