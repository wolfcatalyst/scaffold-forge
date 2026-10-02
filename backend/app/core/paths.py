"""Filesystem locations. Bundled defaults live next to the code; anything the
user changes lives in the data dir so app updates never overwrite it."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
BUNDLED_CONFIG_DIR = BACKEND_DIR / "config"
BUILTIN_TEMPLATES_DIR = BACKEND_DIR / "templates"


def data_dir() -> Path:
    """SCAFFOLD_DATA_DIR in the desktop app; backend/data otherwise (Docker mounts it)."""
    env = os.environ.get("SCAFFOLD_DATA_DIR")
    return Path(env) if env else BACKEND_DIR / "data"


def custom_templates_dir() -> Path:
    return data_dir() / "custom_templates"


def runtime_mode() -> str:
    if os.environ.get("SCAFFOLD_DESKTOP") == "1":
        return "desktop"
    if Path("/.dockerenv").exists():
        return "docker"
    return "dev"
