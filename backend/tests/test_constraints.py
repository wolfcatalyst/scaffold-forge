"""Tests for the constraint engine. No FastAPI dependency."""

import sys
from pathlib import Path

# Ensure backend is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.constraints import has_blockers, load_constraints, validate
from app.core.models import (
    DataLifecycle,
    DataLifecycleResult,
    Intent,
    ScaffoldConfig,
    Severity,
    StackConfig,
)


def _make_config(**overrides) -> ScaffoldConfig:
    intent_keys = {"project_type", "users", "lifespan"}
    dl_keys = {"survive_restart", "return_to_previous", "search_query", "user_data_isolation"}

    intent_kwargs = {k: overrides.pop(k) for k in list(overrides) if k in intent_keys}
    dl_kwargs = {k: overrides.pop(k) for k in list(overrides) if k in dl_keys}

    return ScaffoldConfig(
        intent=Intent(**intent_kwargs),
        data_lifecycle=DataLifecycle(**dl_kwargs),
        stack=StackConfig(**overrides),
    )


class TestDataLifecycle:
    def test_all_no_is_ephemeral(self):
        dl = DataLifecycle()
        assert dl.result == DataLifecycleResult.EPHEMERAL

    def test_survive_restart_only(self):
        dl = DataLifecycle(survive_restart="yes")
        assert dl.result == DataLifecycleResult.JSON_OR_SQLITE

    def test_querying_needed(self):
        dl = DataLifecycle(survive_restart="yes", search_query="yes")
        assert dl.result == DataLifecycleResult.RELATIONAL

    def test_user_isolation_needed(self):
        dl = DataLifecycle(survive_restart="yes", user_data_isolation="yes")
        assert dl.result == DataLifecycleResult.RELATIONAL


class TestConstraintEngine:
    def setup_method(self):
        self.constraints = load_constraints()

    def test_docker_windows_server_triggers_error(self):
        config = _make_config(target="windows_server", docker="yes")
        results = validate(config, self.constraints)
        ids = [r.constraint_id for r in results]
        assert "docker-windows-server" in ids
        match = next(r for r in results if r.constraint_id == "docker-windows-server")
        assert match.severity == Severity.ERROR
        assert match.war_story is not None

    def test_electron_with_docker_warns_but_allows(self):
        # Hybrid projects (Electron app + Dockerized dev/server) are legitimate.
        config = _make_config(target="electron", docker="yes")
        results = validate(config, self.constraints)
        match = next(r for r in results if r.constraint_id == "electron-no-docker")
        assert match.severity == Severity.WARN
        assert not has_blockers(results)

    def test_electron_with_reverse_proxy_blocks(self):
        config = _make_config(target="electron", reverse_proxy="nginx", docker="yes")
        assert "electron-no-reverse-proxy" in [r.constraint_id for r in validate(config, self.constraints) if r.blocks]

    def test_plain_electron_config_is_not_blocked(self):
        config = _make_config(target="electron", docker="no", multiuser="no")
        assert not has_blockers(validate(config, self.constraints))

    def test_sqlite_saas_multiuser_error(self):
        config = _make_config(
            project_type="saas", database="sqlite", multiuser="yes"
        )
        results = validate(config, self.constraints)
        ids = [r.constraint_id for r in results]
        assert "sqlite-multiuser-saas" in ids

    def test_saas_no_auth_error(self):
        config = _make_config(project_type="saas", auth="none")
        results = validate(config, self.constraints)
        ids = [r.constraint_id for r in results]
        assert "saas-no-auth" in ids

    def test_multiuser_no_auth_error(self):
        config = _make_config(multiuser="yes", auth="none")
        results = validate(config, self.constraints)
        ids = [r.constraint_id for r in results]
        assert "multiuser-requires-auth" in ids

    def test_clean_config_no_blockers(self):
        config = _make_config(target="linux", docker="no", auth="none")
        results = validate(config, self.constraints)
        assert not has_blockers(results)

    def test_results_sorted_by_severity(self):
        config = _make_config(
            project_type="saas", target="electron", auth="none", multiuser="yes"
        )
        results = validate(config, self.constraints)
        severities = [r.severity for r in results]
        order = {Severity.HARD: 0, Severity.ERROR: 1, Severity.WARN: 2, Severity.INFO: 3}
        assert severities == sorted(severities, key=lambda s: order[s])

    def test_authentik_requires_docker_and_linux(self):
        config = _make_config(auth="authentik", docker="no", target="windows")
        results = validate(config, self.constraints)
        ids = [r.constraint_id for r in results]
        assert "authentik-requires-docker" in ids
        assert "authentik-requires-linux" in ids

    def test_authentik_on_linux_docker_is_allowed(self):
        config = _make_config(auth="authentik", docker="yes", target="linux")
        assert not has_blockers(validate(config, self.constraints))

    def test_not_condition(self):
        constraints = [{"id": "x", "if": {"target": {"not": ["linux", "macos"]}}, "severity": "warn", "message": "m"}]
        assert validate(_make_config(target="windows"), constraints)
        assert not validate(_make_config(target="linux"), constraints)

    def test_prototype_throwaway_warns(self):
        config = _make_config(project_type="prototype", lifespan="throwaway")
        results = validate(config, self.constraints)
        ids = [r.constraint_id for r in results]
        assert "prototype-overengineering" in ids

    def test_ephemeral_data_hides_db(self):
        # All data lifecycle answers are "no" by default → ephemeral
        config = _make_config()
        results = validate(config, self.constraints)
        ids = [r.constraint_id for r in results]
        assert "no-storage-needed" in ids


class TestFlatConfig:
    def test_flat_dict_contains_all_fields(self):
        config = ScaffoldConfig()
        flat = config.to_flat_dict()
        assert "project_name" in flat
        assert "project_type" in flat
        assert "data_lifecycle_result" in flat
        assert "target" in flat
        assert "docker" in flat
