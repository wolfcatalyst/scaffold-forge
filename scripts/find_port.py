"""Find an available port, starting from a preferred port.

Usage:
    python scripts/find_port.py 8000        # prints first available port >= 8000
    python scripts/find_port.py 8000 10     # tries up to 10 ports (8000-8009)
"""

import socket
import sys


def is_port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def find_free_port(start: int, max_attempts: int = 10) -> int:
    for offset in range(max_attempts):
        port = start + offset
        if is_port_free(port):
            return port
    raise RuntimeError(f"No free port found in range {start}-{start + max_attempts - 1}")


if __name__ == "__main__":
    start_port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    attempts = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    print(find_free_port(start_port, attempts))
