#!/usr/bin/env python3
"""Prepare static distribution for desktop packaging.

Reads tools/static_manifest.json and copies listed files into desktop/dist/.
Run from desktop/: python prepare_dist.py
Called automatically by tauri.conf.json beforeBuildCommand / beforeDevCommand.
"""
from pathlib import Path
import json
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DIST = HERE / "dist"
MANIFEST = ROOT / "tools" / "static_manifest.json"


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    for rel in manifest["root_files"]:
        src = ROOT / rel
        dst = DIST / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    for d in manifest["directories"]:
        src = ROOT / d
        dst = DIST / d
        if src.is_dir():
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns("*.map", "__pycache__"))

    count = sum(1 for p in DIST.rglob("*") if p.is_file())
    print(f"Prepared {DIST} ({count} files)")


if __name__ == "__main__":
    main()
