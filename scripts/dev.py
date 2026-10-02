"""Dev launcher: reads .env ports, auto-finds free ports, starts backend + frontend."""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env():
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())


def find_free_port(start: int, max_attempts: int = 10) -> int:
    import socket

    for offset in range(max_attempts):
        port = start + offset
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port found in range {start}-{start + max_attempts - 1}")


def main():
    python = ROOT / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if not python.exists():
        raise SystemExit("Create .venv and install backend requirements first (Windows: setup.bat).")
    load_env()

    backend_preferred = int(os.environ.get("BACKEND_PORT", "8000"))
    frontend_preferred = int(os.environ.get("FRONTEND_PORT", "3000"))

    backend_port = find_free_port(backend_preferred)
    frontend_port = find_free_port(frontend_preferred)

    if backend_port != backend_preferred:
        print(f"[port] Backend port {backend_preferred} in use, using {backend_port}")
    if frontend_port != frontend_preferred:
        print(f"[port] Frontend port {frontend_preferred} in use, using {frontend_port}")

    print(f"[dev] Backend  → http://localhost:{backend_port}")
    print(f"[dev] Frontend → http://localhost:{frontend_port}")
    print()

    env = os.environ.copy()
    env["BACKEND_PORT"] = str(backend_port)
    env["FRONTEND_PORT"] = str(frontend_port)
    # Frontend needs to know where to proxy API calls
    env["BACKEND_URL"] = f"http://localhost:{backend_port}"

    backend_cmd = [
        str(python), "-m", "uvicorn", "app.main:app",
        "--reload", "--port", str(backend_port),
    ]
    frontend_cmd = ["npm", "run", "dev", "--", "--port", str(frontend_port)]

    procs = []
    try:
        procs.append(subprocess.Popen(
            backend_cmd,
            cwd=str(ROOT / "backend"),
            env=env,
        ))
        procs.append(subprocess.Popen(
            frontend_cmd,
            cwd=str(ROOT / "frontend"),
            env=env,
            shell=sys.platform == "win32",
        ))

        # Wait for either to exit
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        print("\n[dev] Shutting down...")
    finally:
        for p in procs:
            try:
                p.terminate()
                p.wait(timeout=5)
            except Exception:
                p.kill()


if __name__ == "__main__":
    main()
