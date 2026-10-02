"""Bundled desktop server: API and exported frontend share one loopback port."""

import argparse
import json
import os
import socket
import threading
import sys
from pathlib import Path

os.environ["SCAFFOLD_DESKTOP"] = "1"

import uvicorn  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from app.main import app  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--frontend", type=Path, required=True)
    args = parser.parse_args()
    app.mount("/", StaticFiles(directory=args.frontend, html=True), name="desktop")
    # Reserve the port until uvicorn takes over; no probe/start race.
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.bind(("127.0.0.1", 0))
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", log_level="warning"))

    def watch_parent():
        # Electron owns stdin. EOF also stops the server after an Electron crash.
        sys.stdin.buffer.read()
        server.should_exit = True

    threading.Thread(target=watch_parent, daemon=True).start()
    print(json.dumps({"port": listener.getsockname()[1]}), flush=True)
    try:
        server.run(sockets=[listener])
    finally:
        listener.close()


if __name__ == "__main__":
    main()
