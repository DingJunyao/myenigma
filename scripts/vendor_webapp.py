#!/usr/bin/env python3
"""Vendor Pyodide and the myenigma wheel into webapp/.

When these files are present, the web demo loads everything from its own
origin - no CDN and no PyPI access at runtime.  GitHub Pages deployment runs
this script; for local testing run it once before opening the demo.

    uv build --wheel          # or let the script do it
    python scripts/vendor_webapp.py
"""

import argparse
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "webapp"
PYODIDE_VERSION = "314.0.1"
PYODIDE_URL = (
    "https://github.com/pyodide/pyodide/releases/download/"
    f"{PYODIDE_VERSION}/pyodide-core-{PYODIDE_VERSION}.tar.bz2"
)


def download(url: str, dest: Path) -> None:
    print(f"downloading {url}")
    with urllib.request.urlopen(url) as response, open(dest, "wb") as out:
        shutil.copyfileobj(response, out)


def vendor_pyodide() -> None:
    dest = SITE / "pyodide"
    if (dest / "pyodide.mjs").exists():
        print("Pyodide already vendored, skipping download.")
        return
    dest.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / "pyodide-core.tar.bz2"
        download(PYODIDE_URL, archive)
        extract = Path(tmp) / "extract"
        extract.mkdir()
        with tarfile.open(archive, "r:bz2") as tar:
            kwargs = {"filter": "data"} if hasattr(tarfile, "data_filter") else {}
            tar.extractall(extract, **kwargs)
        found = list(extract.rglob("pyodide.mjs"))
        if not found:
            raise SystemExit("pyodide.mjs not found in the downloaded archive")
        source = found[0].parent
        for item in source.iterdir():
            target = dest / item.name
            if target.exists():
                continue
            if item.is_dir():
                shutil.copytree(item, target)
            else:
                shutil.copy2(item, target)
    print(f"Pyodide {PYODIDE_VERSION} vendored into {dest}")


def vendor_wheel(skip_build: bool) -> None:
    if not skip_build:
        try:
            subprocess.run(["uv", "build", "--wheel"], cwd=ROOT, check=True)
        except (OSError, subprocess.CalledProcessError) as exc:
            raise SystemExit(
                "`uv build --wheel` failed (it also fails when this script is run "
                "through `uv run`, because of the environment lock).\n"
                "Build the wheel first, then rerun with --skip-build:\n"
                "    uv build --wheel\n"
                "    python scripts/vendor_webapp.py --skip-build"
            ) from exc
    wheels = sorted((ROOT / "dist").glob("myenigma-*.whl"))
    if not wheels:
        raise SystemExit("No wheel in dist/. Run `uv build --wheel` first.")
    wheel = wheels[-1]
    out = SITE / "wheels"
    out.mkdir(exist_ok=True)
    shutil.copy2(wheel, out / wheel.name)
    (out / "index.json").write_text(json.dumps({"wheel": wheel.name}), encoding="utf-8")
    print(f"Wheel vendored into {out}: {wheel.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-build", action="store_true", help="use the existing dist/ wheel")
    args = parser.parse_args()
    vendor_pyodide()
    vendor_wheel(args.skip_build)


if __name__ == "__main__":
    main()
