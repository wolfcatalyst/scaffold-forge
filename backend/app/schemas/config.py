"""Pydantic schemas for API request/response models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.models import DataLifecycle, Intent, ScaffoldConfig, StackConfig


class IntentSchema(BaseModel):
    project_type: str = ""
    users: str = ""
    lifespan: str = ""


class DataLifecycleSchema(BaseModel):
    survive_restart: str = "no"
    return_to_previous: str = "no"
    search_query: str = "no"
    user_data_isolation: str = "no"


class StackSchema(BaseModel):
    # Custom option groups from the config editor arrive as extra fields.
    model_config = ConfigDict(extra="allow")

    target: str = "linux"
    backend: str = "fastapi"
    backend_language: str = "python"
    runtime: str = "venv"
    frontend: str = "react"
    styling: str = "tailwind"
    component_library: str = "shadcn"
    theme: str = "dark"
    frontend_features: list[str] = Field(default_factory=list)
    database: str = "none"
    database_addons: list[str] = Field(default_factory=list)
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
    data_sources: list[str] = Field(default_factory=list)
    data_export_formats: list[str] = Field(default_factory=list)
    custom_notes: str = ""


class ScaffoldConfigSchema(BaseModel):
    project_name: str = "my-project"
    intent: IntentSchema = Field(default_factory=IntentSchema)
    data_lifecycle: DataLifecycleSchema = Field(default_factory=DataLifecycleSchema)
    stack: StackSchema = Field(default_factory=StackSchema)

    def to_model(self) -> ScaffoldConfig:
        return ScaffoldConfig(
            project_name=self.project_name,
            intent=Intent(**self.intent.model_dump()),
            data_lifecycle=DataLifecycle(**self.data_lifecycle.model_dump()),
            stack=StackConfig.from_dict(self.stack.model_dump()),
        )


class ConstraintResultSchema(BaseModel):
    constraint_id: str
    severity: str
    message: str
    war_story: str | None = None
    then: dict = Field(default_factory=dict)


class ValidationResponse(BaseModel):
    valid: bool
    has_blockers: bool
    results: list[ConstraintResultSchema]


class TreePreviewResponse(BaseModel):
    files: list[str]
    tree_display: str


class AiPromptResponse(BaseModel):
    prompt: str


class TemplateSaveRequest(BaseModel):
    name: str
    config: dict


class TemplateResponse(BaseModel):
    id: str
    name: str
    config: dict


class SettingsUpdate(BaseModel):
    theme: str | None = None
    accent: str | None = None
    compact: bool | None = None
    sidebar_width: str | None = None
    custom_templates_dir: str | None = None


class PortsUpdate(BaseModel):
    backend_port: int
    frontend_port: int
