import os
import sys
import socket
import argparse
import uvicorn
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def is_port_available(host: str, port: int) -> bool:
    """Check if the given host and port are available for binding."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((host, port))
            return True
    except Exception:
        return False


def find_available_port(host: str, preferred_ports: list) -> int:
    """Find the first available port from the preferred list, defaulting to 8000."""
    for port in preferred_ports:
        if is_port_available(host, port):
            return port
    return 8000


def main():
    parser = argparse.ArgumentParser(description="Start Senturian to NX_VMS Backend Service")
    parser.add_argument("--host", default="0.0.0.0", help="Host address to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=None, help="Port to listen on (default: 8000 from PORT env)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload on code change")

    args = parser.parse_args()

    host = args.host
    target_port = args.port

    if target_port is None:
        env_port = os.getenv("PORT")
        if env_port:
            target_port = int(env_port)
        else:
            target_port = find_available_port(host, [8000, 8080, 8888, 80])

    os.environ["PORT"] = str(target_port)

    uvicorn.run(
        "app.main:app",
        host=host,
        port=target_port,
        reload=args.reload
    )


if __name__ == "__main__":
    main()
