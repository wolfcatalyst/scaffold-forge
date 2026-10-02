"""App preferences (appearance, custom templates folder) and port configuration.

Preferences are stored server-side rather than in localStorage because the
desktop app gets a new loopback port, and therefore a new origin, on every launch.
"""

from __future__ import annotations

import json
import os
import socket
from pathlib import Path
from typing import Any

from .paths import BACKEND_DIR, custom_templates_dir, data_dir, runtime_mode

DEFAULT_SETTINGS: dict[str, Any] = {
    "theme": "dark",
    "accent": "neutral",
    "compact": False,
    "sidebar_width": "normal",
    # Empty means the default folder inside the data dir.
    "custom_templates_dir": "",
}
THEMES = {"dark", "light", "system"}
ACCENTS = {"neutral", "blue", "green", "violet", "orange", "rose"}
SIDEBAR_WIDTHS = {"narrow", "normal", "wide"}
ENV_FILE = BACKEND_DIR.parent / ".env"


def _settings_path() -> Path:
    return data_dir() / "settings.json"


def load_settings() -> dict[str, Any]:
    settings = dict(DEFAULT_SETTINGS)
    path = _settings_path()
    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                settings.update(json.load(f))
        except (OSError, json.JSONDecodeError):
            pass
    return settings


def save_settings(update: dict[str, Any]) -> dict[str, Any]:
    settings = load_settings()
    settings.update(update)
    if settings["theme"] not in THEMES:
        raise ValueError(f"theme must be one of {sorted(THEMES)}")
    if settings["accent"] not in ACCENTS:
        raise ValueError(f"accent must be one of {sorted(ACCENTS)}")
    if settings["sidebar_width"] not in SIDEBAR_WIDTHS:
        raise ValueError(f"sidebar_width must be one of {sorted(SIDEBAR_WIDTHS)}")
    settings["compact"] = bool(settings["compact"])
    settings["custom_templates_dir"] = _validated_templates_dir(settings["custom_templates_dir"])
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)
    return settings


def _validated_templates_dir(value: Any) -> str:
    value = str(value or "").strip()
    if not value:
        return ""
    if runtime_mode() == "docker":
        raise ValueError("The custom templates folder can't be changed in Docker; mount a volume at backend/data instead.")
    path = Path(value).expanduser()
    if not path.is_absolute():
        raise ValueError(r"Use a full path, e.g. C:\Users\you\Documents\forge-templates.")
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise ValueError(f"Can't create {path}: {e.strerror or e}")
    return str(path)


def templates_dir() -> Path:
    """Where user template overrides live: the configured folder, or the default."""
    configured = load_settings().get("custom_templates_dir")
    return Path(configured) if configured else custom_templates_dir()


def ensure_templates_dir() -> None:
    try:
        templates_dir().mkdir(parents=True, exist_ok=True)
    except OSError:
        pass  # e.g. a removed USB drive; generation still falls back to built-ins


def _read_env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                values[key.strip()] = val.strip()
    return values


def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def runtime_info() -> dict[str, Any]:
    mode = runtime_mode()
    env = _read_env_file() if mode == "dev" else {}
    preferred = {
        "backend": int(env.get("BACKEND_PORT", "8000")),
        "frontend": int(env.get("FRONTEND_PORT", "3000")),
    }
    # dev.py exports the ports it actually picked.
    current = {
        "backend": int(os.environ["BACKEND_PORT"]) if os.environ.get("BACKEND_PORT") else None,
        "frontend": int(os.environ["FRONTEND_PORT"]) if os.environ.get("FRONTEND_PORT") else None,
    }
    return {
        "mode": mode,
        "ports_editable": mode == "dev",
        "preferred_ports": preferred,
        "current_ports": current,
        "data_dir": str(data_dir()),
        "custom_templates_dir": str(templates_dir()),
        "default_custom_templates_dir": str(custom_templates_dir()),
        "custom_templates_editable": mode != "docker",
    }


def save_ports(backend: int, frontend: int) -> None:
    if runtime_mode() != "dev":
        raise ValueError("Ports can only be changed when running from source (make dev / start-forge.bat).")
    for port in (backend, frontend):
        if not 1024 <= port <= 65535:
            raise ValueError("Ports must be between 1024 and 65535.")
    if backend == frontend:
        raise ValueError("Backend and frontend ports must differ.")

    updates = {"BACKEND_PORT": str(backend), "FRONTEND_PORT": str(frontend)}
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []
    out = []
    for line in lines:
        key = line.split("=", 1)[0].strip()
        if not line.strip().startswith("#") and key in updates:
            out.append(f"{key}={updates.pop(key)}")
        else:
            out.append(line)
    out += [f"{k}={v}" for k, v in updates.items()]
    ENV_FILE.write_text("\n".join(out) + "\n", encoding="utf-8")
