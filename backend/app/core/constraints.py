"""Constraint engine. JSON-driven, unit-testable, no framework dependency."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .forge_config import config_path
from .models import ConstraintResult, ScaffoldConfig, Severity


def load_constraints(path: Path | None = None) -> list[dict[str, Any]]:
    with open(path or config_path("constraints"), encoding="utf-8") as f:
        return json.load(f)


def _match_condition(condition: dict[str, Any], config_flat: dict[str, Any]) -> bool:
    """Check if all keys in a constraint condition match the flat config.

    A value may be a string (equals), a list (any of), or {"not": value}.
    Mirrored in frontend/src/lib/constraints.ts — keep the two in sync.
    """
    for key, expected in condition.items():
        actual = config_flat.get(key)
        if actual is None:
            return False

        if isinstance(expected, dict) and "not" in expected:
            if _match_condition({key: expected["not"]}, config_flat):
                return False
        elif isinstance(expected, list):
            # For list conditions, check if any expected value is in the actual list
            if isinstance(actual, list):
                if not any(e in actual for e in expected):
                    return False
            else:
                if actual not in expected:
                    return False
        elif isinstance(actual, list):
            # Actual is a list, expected is scalar — check membership
            if expected not in actual:
                return False
        else:
            if actual != expected:
                return False

    return True


def validate(
    config: ScaffoldConfig,
    constraints: list[dict[str, Any]] | None = None,
) -> list[ConstraintResult]:
    """Validate a scaffold config against all constraints.

    Returns a list of triggered constraint results, ordered by severity
    (hard first, then error, warn, info).
    """
    if constraints is None:
        constraints = load_constraints()

    config_flat = config.to_flat_dict()
    results: list[ConstraintResult] = []

    for c in constraints:
        condition = c.get("if", {})
        if not condition:
            continue

        if _match_condition(condition, config_flat):
            results.append(
                ConstraintResult(
                    constraint_id=c["id"],
                    severity=Severity(c["severity"]),
                    message=c.get("message", ""),
                    war_story=c.get("war_story"),
                    then=c.get("then", {}),
                )
            )

    severity_order = {Severity.HARD: 0, Severity.ERROR: 1, Severity.WARN: 2, Severity.INFO: 3}
    results.sort(key=lambda r: severity_order[r.severity])

    return results


def has_blockers(results: list[ConstraintResult]) -> bool:
    return any(r.blocks for r in results)

