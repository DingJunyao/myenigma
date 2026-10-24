#!/usr/bin/env python3
"""Vendor Pyodide and the myenigma wheel into webapp/.

When these files are present, the web demo loads everything from its own
origin - no CDN and no PyPI access at runtime.  GitHub Pages deployment runs
this script; for local testing run it once before opening the demo.

    uv build --wheel          # or let the script do it
    python scripts/vendor_webapp.py
"""

import argparse
import ipaddress
import json
import shutil
import socket
import subprocess
import tarfile
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "webapp"
PYODIDE_VERSION = "314.0.1"
PYODIDE_URL = (
    "https://github.com/pyodide/pyodide/releases/download/"
    f"{PYODIDE_VERSION}/pyodide-core-{PYODIDE_VERSION}.tar.bz2"
)
# github.com serves the release page; objects.githubusercontent.com is where
# the actual asset download redirects to.
ALLOWED_DOWNLOAD_HOSTS = {"github.com", "objects.githubusercontent.com"}


def validate_url(url: str) -> str:
    """Allow only https, only the pinned hosts, only public resolved IPs."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise SystemExit(f"refusing non-https URL: {url}")
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_DOWNLOAD_HOSTS:
        raise SystemExit(f"refusing untrusted download host: {host!r}")
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except OSError as exc:
        raise SystemExit(f"cannot resolve {host}: {exc}")
    for info in infos:
        addr = ipaddress.ip_address(info[4][0])
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_reserved
            or addr.is_link_local
            or addr.is_multicast
        ):
            raise SystemExit(f"refusing non-public address for {host}: {addr}")
    return url


class _CheckedRedirect(urllib.request.HTTPRedirectHandler):
    """Re-validate every redirect hop against the same URL policy."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_download_opener = urllib.request.build_opener(_CheckedRedirect)


def safe_dest(dest_dir: Path, filename: str) -> Path:
    """A path inside dest_dir: directory components in filename are stripped
    and the result is verified to stay within dest_dir."""
    base = dest_dir.resolve()
    dest = (base / Path(filename).name).resolve()
    if dest != base and base not in dest.parents:
        raise SystemExit(f"refusing path outside {base}: {filename!r}")
    return dest


def download(url: str, dest_dir: Path, filename: str) -> Path:
    # Only the pinned release URL is ever fetched; validate_url re-checks the
    # scheme, the host allowlist and that every resolved IP is public.
    if url != PYODIDE_URL:
        raise SystemExit(f"refusing non-pinned download URL: {url}")
    validate_url(url)
    dest = safe_dest(dest_dir, filename)
    print(f"downloading {url}")
    with _download_opener.open(url, timeout=120) as response:
        dest.write_bytes(response.read())
    return dest


def vendor_pyodide() -> None:
    dest = SITE / "pyodide"
    if (dest / "pyodide.mjs").exists():
        print("Pyodide already vendored, skipping download.")
        return
    dest.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        archive = download(PYODIDE_URL, Path(tmp), "pyodide-core.tar.bz2")
        extract = (Path(tmp) / "extract").resolve()
        extract.mkdir()
        with tarfile.open(archive, "r:bz2") as tar:
            if hasattr(tarfile, "data_filter"):
                tar.extractall(extract, filter="data")
            else:
                # Python without the tarfile data filter: check every member
                # stays inside the extraction directory before extracting.
                for member in tar.getmembers():
                    target = (extract / member.name).resolve()
                    if target != extract and extract not in target.parents:
                        raise SystemExit(f"refusing unsafe tar member: {member.name}")
                tar.extractall(extract)
        found = list(extract.rglob("pyodide.mjs"))
        if not found:
            raise SystemExit("pyodide.mjs not found in the downloaded archive")
        source = found[0].parent.resolve()
        target_root = dest.resolve()
        for item in sorted(p.resolve() for p in source.iterdir()):
            if item != source and source not in item.parents:
                raise SystemExit(f"refusing path outside {source}: {item}")
            target = target_root / item.name
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
