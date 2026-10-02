"""Scaffold generation engine. Produces folder tree preview and zip output."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

from typing import Any

from jinja2 import ChoiceLoader, Environment, FileSystemLoader, TemplateNotFound

from .constraints import validate
from .models import ScaffoldConfig
from .options import load_options, load_steps
from .paths import BUILTIN_TEMPLATES_DIR
from .settings import templates_dir as custom_templates_dir


def _get_jinja_env(templates_dir: Path | None = None) -> Environment:
    """Templates in the user's custom_templates dir override the built-in ones."""
    dirs = [templates_dir] if templates_dir else [custom_templates_dir(), BUILTIN_TEMPLATES_DIR]
    return Environment(
        loader=ChoiceLoader([FileSystemLoader(str(d)) for d in dirs]),
        keep_trailing_newline=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )


def build_file_tree(config: ScaffoldConfig) -> list[str]:
    """Generate a list of file paths that would be created for this config."""
    tree: list[str] = []
    name = config.project_name
    stack = config.stack

    # Root files (always)
    tree.append(f"{name}/.gitignore")
    tree.append(f"{name}/.env.example")
    if stack.build == "makefile":
        tree.append(f"{name}/Makefile")

    # Backend
    if stack.backend != "none":
        prefix = f"{name}/backend"
        tree.append(f"{prefix}/requirements.txt")
        tree.append(f"{prefix}/app/__init__.py")
        tree.append(f"{prefix}/app/main.py")
        tree.append(f"{prefix}/app/core/__init__.py")
        tree.append(f"{prefix}/app/core/config.py")
        tree.append(f"{prefix}/app/api/__init__.py")
        tree.append(f"{prefix}/app/api/deps.py")
        tree.append(f"{prefix}/app/api/routes/__init__.py")
        tree.append(f"{prefix}/app/api/routes/health.py")

        if stack.auth != "none":
            tree.append(f"{prefix}/app/core/security.py")
            tree.append(f"{prefix}/app/api/routes/auth.py")

        tree.append(f"{prefix}/app/models/__init__.py")
        tree.append(f"{prefix}/app/schemas/__init__.py")
        tree.append(f"{prefix}/app/services/__init__.py")

        # AI
        if stack.ai_integration != "none":
            tree.append(f"{prefix}/app/services/ai/__init__.py")
            tree.append(f"{prefix}/app/services/ai/client.py")
            tree.append(f"{prefix}/app/services/ai/router.py")
            tree.append(f"{prefix}/app/services/ai/providers/__init__.py")
            for provider in ai_providers(config):
                tree.append(f"{prefix}/app/services/ai/providers/{provider}.py")

        # Database
        if stack.database in ("postgresql", "mysql"):
            tree.append(f"{prefix}/alembic.ini")
            tree.append(f"{prefix}/alembic/env.py")
            tree.append(f"{prefix}/alembic/versions/.gitkeep")

        # Docker
        if stack.docker == "yes":
            tree.append(f"{prefix}/Dockerfile")

    # Frontend
    if stack.frontend == "react":
        prefix = f"{name}/frontend"
        tree.append(f"{prefix}/package.json")
        tree.append(f"{prefix}/vite.config.js")
        tree.append(f"{prefix}/index.html")
        if stack.styling == "tailwind":
            tree.append(f"{prefix}/tailwind.config.js")
            tree.append(f"{prefix}/postcss.config.js")
        tree.append(f"{prefix}/src/main.jsx")
        tree.append(f"{prefix}/src/App.jsx")
        tree.append(f"{prefix}/src/index.css")
        tree.append(f"{prefix}/src/components/.gitkeep")
        tree.append(f"{prefix}/src/pages/.gitkeep")
        tree.append(f"{prefix}/src/hooks/.gitkeep")
        if stack.component_library == "shadcn":
            tree.append(f"{prefix}/src/components/ui/.gitkeep")
            tree.append(f"{prefix}/components.json")
        if stack.docker == "yes":
            tree.append(f"{prefix}/Dockerfile")

    elif stack.frontend == "streamlit":
        prefix = f"{name}/frontend"
        tree.append(f"{prefix}/app.py")
        tree.append(f"{prefix}/requirements.txt")
        tree.append(f"{prefix}/pages/.gitkeep")

    elif stack.frontend == "vue":
        prefix = f"{name}/frontend"
        tree.append(f"{prefix}/package.json")
        tree.append(f"{prefix}/vite.config.js")
        tree.append(f"{prefix}/index.html")
        tree.append(f"{prefix}/src/main.js")
        tree.append(f"{prefix}/src/App.vue")
        tree.append(f"{prefix}/src/components/.gitkeep")
        tree.append(f"{prefix}/src/pages/.gitkeep")
        if stack.docker == "yes":
            tree.append(f"{prefix}/Dockerfile")

    # Docker compose
    if stack.docker == "yes":
        tree.append(f"{name}/docker-compose.yml")

    # CI/CD
    if stack.cicd == "github_actions":
        tree.append(f"{name}/.github/workflows/ci.yml")

    # Reverse proxy
    if stack.reverse_proxy == "nginx":
        tree.append(f"{name}/nginx/nginx.conf")
    elif stack.reverse_proxy == "caddy":
        tree.append(f"{name}/Caddyfile")

    # IDE
    if stack.ide == "devcontainer":
        tree.append(f"{name}/.devcontainer/devcontainer.json")

    # README
    tree.append(f"{name}/README.md")

    tree.sort()
    return tree


def render_tree_display(file_paths: list[str]) -> str:
    """Render a list of file paths as a visual tree (like the `tree` command)."""
    if not file_paths:
        return ""

    lines: list[str] = []
    # Build a nested dict structure
    root: dict = {}
    for fp in file_paths:
        parts = fp.split("/")
        node = root
        for part in parts:
            node = node.setdefault(part, {})

    def _walk(node: dict, prefix: str, is_last_map: list[bool] | None = None):
        if is_last_map is None:
            is_last_map = []
        entries = sorted(node.keys())
        for i, entry in enumerate(entries):
            is_last = i == len(entries) - 1
            connector = "\u2514\u2500\u2500 " if is_last else "\u251c\u2500\u2500 "
            lines.append(f"{prefix}{connector}{entry}")

            children = node[entry]
            if children:
                extension = "    " if is_last else "\u2502   "
                _walk(children, prefix + extension, is_last_map + [is_last])

    # The root is the project name
    root_keys = list(root.keys())
    if len(root_keys) == 1:
        lines.append(f"{root_keys[0]}/")
        _walk(root[root_keys[0]], "")
    else:
        _walk(root, "")

    return "\n".join(lines)


def ai_providers(config: ScaffoldConfig) -> list[str]:
    """Provider modules to generate, in a stable order."""
    s = config.stack
    if s.ai_integration == "none":
        return []
    providers = []
    for p in ("anthropic", "openai", "ollama"):
        if s.ai_primary_provider == p or s.ai_integration == "multi":
            providers.append(p)
    if s.ai_primary_provider in ("google", "custom"):
        providers.append(s.ai_primary_provider)
    return providers


def build_spec(config: ScaffoldConfig) -> list[dict[str, Any]]:
    """Every choice made in the wizard, grouped by step, with human labels."""
    options = load_options()
    groups = options.get("stack", {})
    flat = config.stack.to_flat_dict()

    def label_for(key: str, value: Any) -> str:
        known = {o["id"]: o["label"] for o in groups.get(key, {}).get("options", [])}
        if isinstance(value, list):
            return ", ".join(known.get(v, v) for v in value)
        return known.get(value, value)

    sections = []
    intent_opts = options.get("intent", {})
    intent_items = []
    for key, title in (("project_type", "Project type"), ("users", "Users"), ("lifespan", "Lifespan")):
        value = getattr(config.intent, key)
        if value:
            known = {o["id"]: o["label"] for o in intent_opts.get(key, [])}
            intent_items.append({"label": title, "value": known.get(value, value)})
    intent_items.append({"label": "Data needs", "value": config.data_lifecycle.result.value.replace("_", " ")})
    sections.append({"title": "Project", "items": intent_items})

    used: set[str] = set()
    for step in load_steps():
        items = []
        for key in step.get("option_groups", []):
            used.add(key)
            value = flat.get(key)
            if key == "custom_notes" or value in (None, "", []):
                continue
            items.append({"label": groups.get(key, {}).get("label", key), "value": label_for(key, value)})
        if items:
            sections.append({"title": step["label"], "items": items})

    leftovers = [
        {"label": groups.get(k, {}).get("label", k), "value": label_for(k, v)}
        for k, v in flat.items()
        if k not in used and k != "custom_notes" and v not in (None, "", [])
    ]
    if leftovers:
        sections.append({"title": "Other", "items": leftovers})
    return sections


def _context(config: ScaffoldConfig) -> dict[str, Any]:
    context = config.to_flat_dict()
    context.update(
        stack=config.stack,
        intent=config.intent,
        data_lifecycle=config.data_lifecycle,
        config=config,
        ai_providers=ai_providers(config),
        spec=build_spec(config),
        constraint_results=[r for r in validate(config) if r.severity.value != "info"],
    )
    return context


def render_ai_prompt(config: ScaffoldConfig, templates_dir: Path | None = None) -> str:
    """A review prompt to paste into any AI assistant. Overridable like the other templates."""
    context = _context(config)
    context["tree_display"] = render_tree_display(build_file_tree(config))
    return _get_jinja_env(templates_dir).get_template("_ai_prompt.md.j2").render(**context)


def generate_zip(config: ScaffoldConfig, templates_dir: Path | None = None) -> bytes:
    """Generate a zip file containing the scaffolded project from Jinja2 templates."""
    env = _get_jinja_env(templates_dir)
    tree = build_file_tree(config)
    context = _context(config)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in tree:
            # Strip project name prefix to find template
            template_path = file_path.split("/", 1)[1]
            try:
                content = env.get_template(template_path + ".j2").render(**context)
            except TemplateNotFound:
                name = template_path.rsplit("/", 1)[-1]
                content = "" if name in ("__init__.py", ".gitkeep") else f"# {name}\n"
            zf.writestr(file_path, content)

    return buf.getvalue()
