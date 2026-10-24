"""Stage minitool source into dist/ and build the uploadable zip.

The zip contains the dist directory CONTENTS with index.html at the zip root
(no wrapping folder), per the minitool zip artifact spec. Stdlib only.
"""
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
OUT = ROOT / "myenigma-minitool.zip"


def build():
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / "css", DIST / "css")
    shutil.copytree(ROOT / "js", DIST / "js")
    shutil.copy2(ROOT / "index.html", DIST / "index.html")

    files = sorted(p for p in DIST.rglob("*") if p.is_file())
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for f in files:
            zf.write(f, f.relative_to(DIST).as_posix())

    print("staged %d files into dist/" % len(files))
    print("zip: %s (%d bytes)" % (OUT.name, OUT.stat().st_size))
    with zipfile.ZipFile(OUT) as zf:
        names = zf.namelist()
    print("index.html at zip root:", "index.html" in names)
    print("entries:", len(names))
    for name in names:
        print("  ", name)


if __name__ == "__main__":
    build()
