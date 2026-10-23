#!/usr/bin/env python3
"""Local dev server for webapp/ with no-store caching and correct WASM MIME.

    python scripts/serve_webapp.py [port]      # default port 8123

Serving with this script (instead of `python -m http.server`) makes sure
phones always receive fresh CSS/JS while iterating on the demo.
"""

import http.server
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "webapp"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


Handler.extensions_map.update(
    {
        ".wasm": "application/wasm",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
    }
)


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"serving {SITE} at http://0.0.0.0:{port}/ (Cache-Control: no-store)")
    server.serve_forever()


if __name__ == "__main__":
    main()
