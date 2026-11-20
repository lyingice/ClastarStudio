#!/usr/bin/env python3
"""Build a local-only Create asset pack for the Create extension.

Usage:
    python tools/build_create_pack.py "D:/path/to/create-1.21.1-6.0.10.jar"

The output is written to local/create-pack.zip and is intentionally ignored by
git. The public plugin only auto-loads it when the file exists locally; the
GitHub build has no local assets.
"""
from pathlib import Path
import datetime
import json
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'local' / 'create-pack.zip'


def main():
    if len(sys.argv) < 2:
        print('Usage: python tools/build_create_pack.py <create.jar>')
        return 1
    jar = Path(sys.argv[1])
    if not jar.exists():
        print('Jar not found:', jar)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    source_bytes = jar.stat().st_size
    with zipfile.ZipFile(jar, 'r') as zin, zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zout:
        for info in zin.infolist():
            if info.is_dir() or not info.filename.startswith('assets/create/'):
                continue
            data = zin.read(info.filename)
            zout.writestr(info.filename, data)
            count += 1
        zout.writestr('pack-info.json', json.dumps({
            'format': 'clastar-create-assets@1',
            'source': jar.name,
            'sourceBytes': source_bytes,
            'builtAt': datetime.datetime.now().isoformat(timespec='seconds'),
            'files': count,
        }, ensure_ascii=False, indent=2))
    print('Created %s (%d assets, %.1f MB)' % (OUT, count, OUT.stat().st_size / 1024 / 1024))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
