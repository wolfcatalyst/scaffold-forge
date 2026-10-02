"""Exercise the shipped backend with no Python/Node on PATH or source cwd."""

import argparse
import io
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import tempfile
import threading
import time
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def request(base, route, payload=None, method=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(base + route, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.read()


def launch(executable, frontend, data_dir):
    env = dict(os.environ, PATH=str(Path(os.environ["SystemRoot"]) / "System32"),
               SCAFFOLD_DATA_DIR=str(data_dir))
    for key in ("PYTHONHOME", "PYTHONPATH", "VIRTUAL_ENV"):
        env.pop(key, None)
    process = subprocess.Popen([str(executable), "--frontend", str(frontend)],
                               cwd=data_dir, env=env, stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               creationflags=subprocess.CREATE_NO_WINDOW)
    lines = queue.Queue()
    threading.Thread(target=lambda: lines.put(process.stdout.readline()), daemon=True).start()
    try:
        line = lines.get(timeout=30)
        if not line:
            raise RuntimeError(process.stderr.read().decode())
        port = json.loads(line)["port"]
        base = f"http://127.0.0.1:{port}"
        for _ in range(100):
            try:
                request(base, "/health")
                return process, base
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError(process.stderr.read().decode())
                time.sleep(0.1)
        raise TimeoutError("Backend never became healthy")
    except BaseException:
        process.kill()
        process.wait()
        raise


def stop(process):
    process.stdin.close()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
        raise AssertionError("Backend did not exit after parent disconnected")
    assert process.returncode == 0, process.stderr.read().decode()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--resources", type=Path)
    args = parser.parse_args()
    executable = (args.resources / "backend/scaffold-backend.exe" if args.resources
                  else ROOT / "build/backend/scaffold-backend/scaffold-backend.exe").resolve()
    frontend = (args.resources / "frontend" if args.resources else ROOT / "frontend/out").resolve()
    with tempfile.TemporaryDirectory(prefix="desktop-smoke-", dir=ROOT / "build") as directory:
        data_dir = Path(directory)
        process, base = launch(executable, frontend, data_dir)
        try:
            html = request(base, "/").decode()
            assert "Scaffold Forge" in html
            assets = re.findall(r'(?:src|href)="(/_next/[^"?]+)', html)
            assert assets
            for asset in assets:
                assert request(base, asset)
            options = json.loads(request(base, "/api/options"))
            assert options["options"] and options["constraints"] and options["steps"]
            templates = json.loads(request(base, "/api/templates/"))
            assert len(templates) >= 4
            config = next(t["config"] for t in templates if t["id"] == "wolf-pipeline")
            config["project_name"] = "packaged-smoke"
            validation = json.loads(request(base, "/api/validate", config))
            assert not validation["has_blockers"], validation
            assert json.loads(request(base, "/api/scaffold/preview", config))["files"]
            archive = zipfile.ZipFile(io.BytesIO(request(base, "/api/scaffold/generate", config)))
            assert archive.namelist() and archive.testzip() is None
            saved = json.loads(request(base, "/api/templates/", {"name": "Smoke saved", "config": config}))
            template_id = saved["id"]
            assert (data_dir / "templates" / f"{template_id}.json").is_file()
            readme = next(archive.read(n) for n in archive.namelist() if n.endswith("/README.md")).decode()
            assert readme.startswith("> **AI note:**"), "Jinja2 templates missing from bundle"
            desktop = next(t["config"] for t in templates if t["id"] == "wolf-desktop")
            assert not json.loads(request(base, "/api/validate", desktop))["has_blockers"]
            assert json.loads(request(base, "/api/settings/runtime"))["mode"] == "desktop"
            request(base, "/api/settings", {"theme": "light"}, method="PUT")
            forge = json.loads(request(base, "/api/config"))
            forge["steps"][0]["label"] = "Smoke intent"
            request(base, "/api/config", {"steps": forge["steps"]}, method="PUT")
            assert (data_dir / "forge-config" / "steps.json").is_file()
        finally:
            stop(process)
        process, base = launch(executable, frontend, data_dir)
        try:
            saved = json.loads(request(base, f"/api/templates/{template_id}"))
            assert saved["name"] == "Smoke saved"
            assert json.loads(request(base, "/api/settings"))["theme"] == "light"
            assert json.loads(request(base, "/api/options"))["steps"][0]["label"] == "Smoke intent"
            request(base, f"/api/templates/{template_id}", method="DELETE")
            assert not (data_dir / "templates" / f"{template_id}.json").exists()
        finally:
            stop(process)
    print("PASS: bundled frontend/assets, options, validation, ZIP generation, template/config/settings persistence, and parent-exit cleanup")


if __name__ == "__main__":
    main()
