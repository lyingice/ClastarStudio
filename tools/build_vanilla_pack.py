#!/usr/bin/env python3
"""Extract vanilla Minecraft textures into a local-only asset library pack.

Usage:
    python tools/build_vanilla_pack.py "D:/path/to/1.21.1.jar" 1.21.1

Output:
    local/vanilla/catalog.json
    local/vanilla/textures/<category>/...

The local/ directory is ignored by git. Nothing is uploaded.
"""
from pathlib import Path
import datetime
import json
import shutil
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'local' / 'vanilla'
TEX = OUT / 'textures'


def png_size(data):
    if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n':
        return 0, 0
    width, height = struct.unpack('>II', data[16:24])
    return width, height


def main():
    if len(sys.argv) < 2:
        print('Usage: python tools/build_vanilla_pack.py <client.jar> [version]')
        return 1
    jar = Path(sys.argv[1])
    version = sys.argv[2] if len(sys.argv) > 2 else '1.21.1'
    if not jar.exists():
        print('Jar not found:', jar)
        return 1
    if TEX.exists():
        shutil.rmtree(TEX)
    TEX.mkdir(parents=True, exist_ok=True)
    items = []
    with zipfile.ZipFile(jar, 'r') as z:
        names = set(z.namelist())
        for info in z.infolist():
            name = info.filename
            if info.is_dir() or not name.startswith('assets/minecraft/textures/') or not name.endswith('.png'):
                continue
            rel = name[len('assets/minecraft/textures/'):]
            data = z.read(name)
            w, h = png_size(data)
            target = TEX / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            meta_name = name + '.mcmeta'
            mcmeta = None
            if meta_name in names:
                try:
                    mcmeta = json.loads(z.read(meta_name).decode('utf-8-sig'))
                except Exception:
                    mcmeta = None
                meta_target = TEX / (rel + '.mcmeta')
                meta_target.write_bytes(z.read(meta_name))
            category = rel.split('/')[0] if '/' in rel else 'other'
            base = rel.split('/')[-1][:-4]
            items.append({
                'name': base,
                'path': name,
                'url': 'local/vanilla/textures/' + rel.replace('\\', '/'),
                'category': category,
                'width': w,
                'height': h,
                'mcmeta': mcmeta,
                'source': 'Minecraft ' + version + ' · 本地内容包',
            })
    items.sort(key=lambda x: x['path'].lower())
    catalog = {
        'format': 'clastar-vanilla-assets@1',
        'version': version,
        'source': jar.name,
        'builtAt': datetime.datetime.now().isoformat(timespec='seconds'),
        'count': len(items),
        'items': items,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Created %s (%d textures, %.1f MB catalog)' % (OUT, len(items), (OUT / 'catalog.json').stat().st_size / 1024 / 1024))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
