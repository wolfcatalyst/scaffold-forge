"""Tests for the forge config store, settings, templates and their API routes."""

import io
import json
import sys
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.core import forge_config  # noqa: E402
from app.core.constraints import has_blockers, validate  # noqa: E402
from app.core.generator import generate_zip  # noqa: E402
from app.core.models import ScaffoldConfig, StackConfig  # noqa: E402
from app.core.templates import list_templates  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.config import ScaffoldConfigSchema  # noqa: E402


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("SCAFFOLD_DATA_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def client():
    return TestClient(app)


def _zip_files(config: ScaffoldConfig) -> dict[str, str]:
    z = zipfile.ZipFile(io.BytesIO(generate_zip(config)))
    return {n.split("/", 1)[1]: z.read(n).decode() for n in z.namelist()}


class TestForgeConfig:
    def test_defaults_are_valid(self):
        forge_config.validate_pack(forge_config.load_all())

    def test_save_writes_override_and_reset_restores(self, data_dir):
        options = forge_config.load("options")
        options["stack"]["theme"]["label"] = "Colour scheme"
        forge_config.save("options", options)
        assert (data_dir / "forge-config" / "options.json").exists()
        assert forge_config.load("options")["stack"]["theme"]["label"] == "Colour scheme"

        forge_config.reset("options")
        assert forge_config.load("options")["stack"]["theme"]["label"] == "Theme"

    def test_cannot_remove_group_used_by_a_step(self):
        options = forge_config.load("options")
        del options["stack"]["docker"]
        with pytest.raises(forge_config.ConfigValidationError) as e:
            forge_config.save("options", options)
        assert any("docker" in err for err in e.value.errors)

    def test_cannot_remove_builtin_step(self):
        steps = [s for s in forge_config.load("steps") if s["id"] != "review"]
        with pytest.raises(forge_config.ConfigValidationError):
            forge_config.save("steps", steps)

    def test_constraint_on_unknown_field_rejected(self):
        constraints = forge_config.load("constraints") + [
            {"id": "bad", "if": {"nope": "x"}, "severity": "warn", "message": "m"}
        ]
        with pytest.raises(forge_config.ConfigValidationError):
            forge_config.save("constraints", constraints)

    def test_reset_refused_when_others_depend_on_it(self):
        options = forge_config.load("options")
        options["stack"]["queue"] = {"label": "Queue", "options": [{"id": "celery", "label": "Celery"}]}
        forge_config.save("options", options)
        steps = forge_config.load("steps")
        steps[2]["option_groups"].append("queue")
        forge_config.save("steps", steps)
        with pytest.raises(forge_config.ConfigValidationError):
            forge_config.reset("options")
        assert "queue" in forge_config.load("options")["stack"]

    def test_import_export_roundtrip(self):
        pack = forge_config.export_pack()
        pack["steps"][0]["label"] = "What are we building?"
        forge_config.import_pack(pack)
        assert forge_config.load("steps")[0]["label"] == "What are we building?"

    def test_import_rejects_foreign_json(self):
        with pytest.raises(forge_config.ConfigValidationError):
            forge_config.import_pack({"name": "a template"})


class TestCustomGroups:
    def test_extra_stack_fields_flow_into_constraints(self):
        config = ScaffoldConfigSchema(stack={"queue": "celery"}).to_model()
        assert config.stack.extras == {"queue": "celery"}
        rule = [{"id": "q", "if": {"queue": "celery"}, "severity": "hard", "message": "m"}]
        assert has_blockers(validate(config, rule))

    def test_extra_fields_listed_in_readme(self):
        config = ScaffoldConfig(stack=StackConfig.from_dict({"queue": "celery"}))
        assert "**queue:** celery" in _zip_files(config)["README.md"]


class TestGenerator:
    def test_readme_starts_with_ai_note(self):
        readme = _zip_files(ScaffoldConfig())["README.md"]
        assert readme.startswith("> **AI note:**")

    def test_custom_notes_in_readme(self):
        config = ScaffoldConfig(stack=StackConfig(custom_notes="Use Celery for jobs."))
        assert "Use Celery for jobs." in _zip_files(config)["README.md"]

    def test_custom_template_overrides_builtin(self, data_dir):
        custom = data_dir / "custom_templates"
        custom.mkdir()
        (custom / ".gitignore.j2").write_text("custom {{ project_name }}\n")
        assert _zip_files(ScaffoldConfig())[".gitignore"] == "custom my-project\n"

    def test_every_builtin_template_renders(self):
        for frontend in ("react", "vue", "streamlit", "none"):
            config = ScaffoldConfig(stack=StackConfig(
                frontend=frontend, docker="yes", database="postgresql", auth="jwt",
                ai_integration="multi", reverse_proxy="nginx", ide="devcontainer", cicd="github_actions",
            ))
            files = _zip_files(config)
            placeholders = [n for n, c in files.items() if c == f"# {n.rsplit('/', 1)[-1]}\n"]
            assert placeholders == []

    def test_builtin_desktop_template_can_generate(self):
        desktop = next(t for t in list_templates() if t["id"] == "wolf-desktop")
        config = ScaffoldConfigSchema(**desktop["config"]).to_model()
        assert not has_blockers(validate(config))


class TestRoutes:
    def test_config_get_put_reset(self, client):
        state = client.get("/api/config").json()
        assert state["customized"] == {"options": False, "steps": False, "constraints": False}
        assert "docker" in state["known_fields"]

        steps = state["steps"]
        steps[0]["label"] = "Intent"
        r = client.put("/api/config/steps", json=steps)
        assert r.status_code == 200 and r.json()["customized"]["steps"]

        assert client.delete("/api/config/steps").json()["customized"]["steps"] is False

    def test_save_many_removes_group_and_its_step_reference(self, client):
        state = client.get("/api/config").json()
        options, steps = state["options"], state["steps"]
        del options["stack"]["cicd"]
        for s in steps:
            if "cicd" in s.get("option_groups", []):
                s["option_groups"].remove("cicd")
        r = client.put("/api/config", json={"options": options, "steps": steps})
        assert r.status_code == 200
        assert r.json()["customized"] == {"options": True, "steps": True, "constraints": False}

    def test_invalid_config_returns_errors(self, client):
        r = client.put("/api/config/steps", json=[])
        assert r.status_code == 422
        assert isinstance(r.json()["detail"], list)

    def test_settings_roundtrip(self, client, data_dir):
        assert client.get("/api/settings").json()["theme"] == "dark"
        r = client.put("/api/settings", json={"theme": "light", "accent": "blue"})
        assert r.json()["accent"] == "blue"
        assert json.loads((data_dir / "settings.json").read_text())["theme"] == "light"
        assert client.put("/api/settings", json={"accent": "plaid"}).status_code == 422

    def test_runtime_info(self, client):
        info = client.get("/api/settings/runtime").json()
        assert info["mode"] in ("dev", "docker", "desktop")
        assert info["custom_templates_dir"].endswith("custom_templates")


class TestAiPrompt:
    def test_prompt_contains_spec_and_tree(self, client):
        config = {"project_name": "equip-tracker", "stack": {"custom_notes": "Barcode scanning later."}}
        prompt = client.post("/api/scaffold/prompt", json=config).json()["prompt"]
        assert "# Project: equip-tracker" in prompt
        assert "**Backend Framework:** FastAPI" in prompt
        assert "Barcode scanning later." in prompt
        assert "equip-tracker/" in prompt  # file tree

    def test_prompt_template_is_overridable(self, client, data_dir):
        (data_dir / "custom_templates").mkdir()
        (data_dir / "custom_templates" / "_ai_prompt.md.j2").write_text("Review {{ project_name }}")
        assert client.post("/api/scaffold/prompt", json={}).json()["prompt"] == "Review my-project"


class TestCustomTemplatesFolder:
    def test_default_folder_created_on_startup(self, data_dir):
        with TestClient(app):  # runs lifespan
            pass
        assert (data_dir / "custom_templates").is_dir()

    def test_custom_location_is_created_and_used(self, client, tmp_path):
        target = tmp_path / "elsewhere" / "tpl"
        r = client.put("/api/settings", json={"custom_templates_dir": str(target)})
        assert r.status_code == 200 and target.is_dir()
        assert client.get("/api/settings/runtime").json()["custom_templates_dir"] == str(target)
        (target / ".gitignore.j2").write_text("moved\n")
        assert _zip_files(ScaffoldConfig())[".gitignore"] == "moved\n"

    def test_relative_path_rejected_and_empty_resets(self, client, data_dir):
        assert client.put("/api/settings", json={"custom_templates_dir": "relative/dir"}).status_code == 422
        client.put("/api/settings", json={"custom_templates_dir": ""})
        assert client.get("/api/settings/runtime").json()["custom_templates_dir"] == str(data_dir / "custom_templates")
