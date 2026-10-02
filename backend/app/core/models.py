"""Core data models for scaffold configuration. No framework dependency."""

from __future__ import annotations

from dataclasses import dataclass, field, fields
from enum import Enum
from typing import Any


class Severity(str, Enum):
    HARD = "hard"
    ERROR = "error"
    WARN = "warn"
    INFO = "info"


class DataLifecycleResult(str, Enum):
    EPHEMERAL = "ephemeral"
    JSON_OR_SQLITE = "json_or_sqlite"
    RELATIONAL = "relational"
    DOCUMENT = "document"


@dataclass
class Intent:
    project_type: str = ""
    users: str = ""
    lifespan: str = ""


@dataclass
class DataLifecycle:
    survive_restart: str = "no"
    return_to_previous: str = "no"
    search_query: str = "no"
    user_data_isolation: str = "no"

    @property
    def result(self) -> DataLifecycleResult:
        answers = [
            self.survive_restart,
            self.return_to_previous,
            self.search_query,
            self.user_data_isolation,
        ]
        yes_count = sum(1 for a in answers if a == "yes")

        if yes_count == 0:
            return DataLifecycleResult.EPHEMERAL
        if self.search_query == "no" and self.user_data_isolation == "no":
            return DataLifecycleResult.JSON_OR_SQLITE
        return DataLifecycleResult.RELATIONAL


@dataclass
class StackConfig:
    target: str = "linux"
    backend: str = "fastapi"
    backend_language: str = "python"
    runtime: str = "venv"
    frontend: str = "react"
    styling: str = "tailwind"
    component_library: str = "shadcn"
    theme: str = "dark"
    frontend_features: list[str] = field(default_factory=list)
    database: str = "none"
    database_addons: list[str] = field(default_factory=list)
    orm: str = "sqlalchemy"
    auth: str = "none"
    multiuser: str = "no"
    docker: str = "no"
    cicd: str = "none"
    reverse_proxy: str = "none"
    ai_integration: str = "none"
    ai_primary_provider: str = "anthropic"
    ai_pattern: str = "response_agent"
    git: str = "init"
    build: str = "makefile"
    ide: str = "none"
    linting: str = "none"
    data_sources: list[str] = field(default_factory=list)
    data_export_formats: list[str] = field(default_factory=list)
    custom_notes: str = ""
    # Option groups added in the Forge Configuration editor.
    extras: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> StackConfig:
        known = {f.name for f in fields(cls)} - {"extras"}
        return cls(
            **{k: v for k, v in data.items() if k in known},
            extras={k: v for k, v in data.items() if k not in known},
        )

    def to_flat_dict(self) -> dict[str, Any]:
        """Flatten config for constraint matching."""
        d = {k: v for k, v in self.__dict__.items() if k != "extras"}
        d.update(self.extras)
        return d


@dataclass
class ScaffoldConfig:
    project_name: str = "my-project"
    intent: Intent = field(default_factory=Intent)
    data_lifecycle: DataLifecycle = field(default_factory=DataLifecycle)
    stack: StackConfig = field(default_factory=StackConfig)

    def to_flat_dict(self) -> dict[str, Any]:
        """Flatten entire config for constraint matching."""
        d = {"project_name": self.project_name}
        d.update(self.intent.__dict__)
        d["data_lifecycle_result"] = self.data_lifecycle.result.value
        d.update(self.data_lifecycle.__dict__)
        d.update(self.stack.to_flat_dict())
        return d


@dataclass
class ConstraintResult:
    constraint_id: str
    severity: Severity
    message: str
    war_story: str | None = None
    then: dict[str, Any] = field(default_factory=dict)

    @property
    def blocks(self) -> bool:
        return self.severity == Severity.HARD
