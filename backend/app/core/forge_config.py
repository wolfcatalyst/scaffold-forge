"""Editable forge configuration (options, steps, constraints).

Reads the user's override from the data dir when present, otherwise the
bundled default. Saves are validated across all three files so the wizard
can never be left referencing something that no longer exists.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from .paths import BUNDLED_CONFIG_DIR, data_dir

CONFIG_NAMES = ("options", "steps", "constraints")
PACK_FORMAT = "scaffold-forge-config"
CUSTOM_STEP_IDS = {"intent", "data", "review"}
SEVERITIES = {"hard", "error", "warn", "info"}
KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")

# Flat-config keys that exist regardless of the option groups.
BASE_FIELDS = [
    "project_name", "project_type", "users", "lifespan", "data_lifecycle_result",
    "survive_restart", "return_to_previous", "search_query", "user_data_isolation",
]


class ConfigValidationError(ValueError):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


def override_dir() -> Path:
    return data_dir() / "forge-config"


def config_path(name: str) -> Path:
    override = override_dir() / f"{name}.json"
    return override if override.exists() else BUNDLED_CONFIG_DIR / f"{name}.json"


def is_customized(name: str) -> bool:
    return (override_dir() / f"{name}.json").exists()


def load(name: str) -> Any:
    with open(config_path(name), encoding="utf-8") as f:
        return json.load(f)


def load_all() -> dict[str, Any]:
    return {name: load(name) for name in CONFIG_NAMES}


def known_fields(options: dict[str, Any]) -> list[str]:
    return BASE_FIELDS + list(options.get("stack", {}).keys())


def save(name: str, data: Any) -> None:
    save_many({name: data})


def save_many(updates: dict[str, Any]) -> None:
    """Validate the merged result, then write only the files that were sent."""
    unknown = set(updates) - set(CONFIG_NAMES)
    if unknown:
        raise ConfigValidationError([f"Unknown config file: {n}" for n in sorted(unknown)])
    pack = {**load_all(), **updates}
    validate_pack(pack)
    for name, data in updates.items():
        _write(name, data)


def reset(name: str | None = None) -> None:
    if name:
        # Resetting one file must not leave the others pointing at removed items.
        pack = load_all()
        with open(BUNDLED_CONFIG_DIR / f"{name}.json", encoding="utf-8") as f:
            pack[name] = json.load(f)
        try:
            validate_pack(pack)
        except ConfigValidationError as e:
            raise ConfigValidationError(
                [f"Can't reset {name} alone: the other customized files depend on it. Reset everything instead."]
                + e.errors
            )
    for n in [name] if name else CONFIG_NAMES:
        (override_dir() / f"{n}.json").unlink(missing_ok=True)


def export_pack() -> dict[str, Any]:
    return {"format": PACK_FORMAT, "version": 1, **load_all()}


def import_pack(pack: dict[str, Any]) -> None:
    if pack.get("format") != PACK_FORMAT:
        raise ConfigValidationError(["Not a Scaffold Forge configuration pack."])
    data = {name: pack.get(name) for name in CONFIG_NAMES}
    validate_pack(data)
    for name in CONFIG_NAMES:
        _write(name, data[name])


def _write(name: str, data: Any) -> None:
    target = override_dir() / f"{name}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    os.replace(tmp, target)


def validate_pack(pack: dict[str, Any]) -> None:
    errors: list[str] = []
    options, steps, constraints = (pack.get(n) for n in CONFIG_NAMES)

    groups = _validate_options(options, errors)
    _validate_steps(steps, groups, errors)
    if isinstance(options, dict):
        _validate_constraints(constraints, set(known_fields(options)), errors)

    if errors:
        raise ConfigValidationError(errors)


def _validate_options(options: Any, errors: list[str]) -> set[str]:
    if not isinstance(options, dict) or not isinstance(options.get("stack"), dict):
        errors.append("options must be an object with a 'stack' section.")
        return set()
    for section in ("intent", "data_lifecycle"):
        if section not in options:
            errors.append(f"options is missing the '{section}' section.")

    for key, group in options["stack"].items():
        where = f"Option group '{key}'"
        if not KEY_PATTERN.match(key):
            errors.append(f"{where}: key must be lowercase letters, digits and underscores.")
        if not isinstance(group, dict):
            errors.append(f"{where}: must be an object.")
            continue
        if not str(group.get("label", "")).strip():
            errors.append(f"{where}: label is required.")
        if group.get("type") == "textarea":
            continue
        opts = group.get("options")
        if not isinstance(opts, list) or not opts:
            errors.append(f"{where}: needs at least one option.")
            continue
        seen: set[str] = set()
        for opt in opts:
            oid = str(opt.get("id", "")).strip() if isinstance(opt, dict) else ""
            if not oid or not str(opt.get("label", "")).strip():
                errors.append(f"{where}: every option needs an id and a label.")
            elif oid in seen:
                errors.append(f"{where}: duplicate option id '{oid}'.")
            seen.add(oid)
    return set(options["stack"].keys())


def _validate_steps(steps: Any, groups: set[str], errors: list[str]) -> None:
    if not isinstance(steps, list) or not steps:
        errors.append("steps must be a non-empty list.")
        return
    seen: set[str] = set()
    for step in steps:
        if not isinstance(step, dict):
            errors.append("Every step must be an object.")
            continue
        sid = str(step.get("id", "")).strip()
        where = f"Step '{sid or '?'}'"
        if not sid:
            errors.append("Every step needs an id.")
        elif sid in seen:
            errors.append(f"{where}: duplicate step id.")
        seen.add(sid)
        if not str(step.get("label", "")).strip():
            errors.append(f"{where}: label is required.")
        stype = step.get("type")
        if stype == "custom":
            if sid not in CUSTOM_STEP_IDS:
                errors.append(f"{where}: custom steps must be one of {sorted(CUSTOM_STEP_IDS)}.")
        elif stype == "options":
            refs = step.get("option_groups")
            if not isinstance(refs, list) or not refs:
                errors.append(f"{where}: pick at least one option group.")
                continue
            for ref in refs:
                if ref not in groups:
                    errors.append(f"{where}: uses option group '{ref}', which doesn't exist.")
        else:
            errors.append(f"{where}: type must be 'custom' or 'options'.")
    for required in sorted(CUSTOM_STEP_IDS - seen):
        errors.append(f"The built-in '{required}' step can't be removed.")


def _validate_constraints(constraints: Any, fields: set[str], errors: list[str]) -> None:
    if not isinstance(constraints, list):
        errors.append("constraints must be a list.")
        return
    seen: set[str] = set()
    for c in constraints:
        if not isinstance(c, dict):
            errors.append("Every constraint must be an object.")
            continue
        cid = str(c.get("id", "")).strip()
        where = f"Constraint '{cid or '?'}'"
        if not cid:
            errors.append("Every constraint needs an id.")
        elif cid in seen:
            errors.append(f"{where}: duplicate id.")
        seen.add(cid)
        if c.get("severity") not in SEVERITIES:
            errors.append(f"{where}: severity must be one of {sorted(SEVERITIES)}.")
        if not str(c.get("message", "")).strip():
            errors.append(f"{where}: message is required.")
        if not isinstance(c.get("then", {}), dict):
            errors.append(f"{where}: 'then' must be an object.")
        condition = c.get("if")
        if not isinstance(condition, dict) or not condition:
            errors.append(f"{where}: needs at least one condition.")
            continue
        for key, value in condition.items():
            if key not in fields:
                errors.append(f"{where}: condition field '{key}' doesn't exist.")
            if not _valid_condition_value(value):
                errors.append(f"{where}: condition on '{key}' has an invalid value.")


def _valid_condition_value(value: Any) -> bool:
    if isinstance(value, dict):
        return set(value) == {"not"} and _valid_condition_value(value["not"])
    if isinstance(value, list):
        return bool(value) and all(isinstance(v, str) and v for v in value)
    return isinstance(value, str) and bool(value)
