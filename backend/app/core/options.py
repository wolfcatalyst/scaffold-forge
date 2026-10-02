"""Options loader. Reads from JSON, never hardcoded."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .forge_config import config_path


def load_options(path: Path | None = None) -> dict[str, Any]:
    with open(path or config_path("options"), encoding="utf-8") as f:
        return json.load(f)


def load_steps(path: Path | None = None) -> list[dict[str, Any]]:
    with open(path or config_path("steps"), encoding="utf-8") as f:
        return json.load(f)
