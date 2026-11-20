#!/usr/bin/env python3
"""Build local-only asset packs from jars/ZIPs placed in local/inbox.

Usage:
    python tools/prepare_local_assets.py

The script looks for:
  - Create mod jar / resource pack with assets/create
  - Minecraft client jar / resource pack with assets/minecraft/textures

Outputs:
  local/create-pack.zip
  local/vanilla/catalog.json + textures

Nothing is uploaded to GitHub. local/ is ignored by git.
"""
from pathlib import Path
import json
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / 'local' / 'inbox'


def detect(path):
    try:
        with zipfile.ZipFile(path, 'r') as z:
            names = z.namelist()
    except Exception:
        return None
    if any(n.startswith('assets/create/') for n in names):
        return 'create'
    if any(n.startswith('assets/minecraft/textures/') for n in names):
        return 'vanilla'
    return None


def version_from_name(name):
    m = re.search(r'(1\.\d+(?:\.\d+)?)', name)
    return m.group(1) if m else 'local'


def main():
    INBOX.mkdir(parents=True, exist_ok=True)
    files = sorted(
        [p for p in INBOX.iterdir() if p.is_file() and p.suffix.lower() in ('.jar', '.zip')],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not files:
        print('没有找到待处理文件。')
        print('请把 Create jar / 原版客户端 jar / 资源包 ZIP 放到：')
        print('  ' + str(INBOX))
        print('然后重新双击“准备本地素材.bat”。')
        return 0

    picked = {}
    for path in files:
        kind = detect(path)
        if kind and kind not in picked:
            picked[kind] = path
        elif kind:
            print('跳过较旧/重复的 %s：%s' % (kind, path.name))
        else:
            print('无法识别（没有 assets/create 或 assets/minecraft/textures）：' + path.name)

    if not picked:
        print('没有识别出可用的 Create 或原版资源包。')
        return 1

    if 'create' in picked:
        src = picked['create']
        print('构建 Create 内容包：' + src.name)
        subprocess.run([sys.executable, str(ROOT / 'tools' / 'build_create_pack.py'), str(src)], cwd=str(ROOT), check=True)

    if 'vanilla' in picked:
        src = picked['vanilla']
        ver = version_from_name(src.name)
        print('构建原版纹理目录：%s（%s）' % (src.name, ver))
        subprocess.run([sys.executable, str(ROOT / 'tools' / 'build_vanilla_pack.py'), str(src), ver], cwd=str(ROOT), check=True)

    print('\n本地素材已准备好。请刷新/重新打开素材库与机械动力扩展。')
    print('local/ 不会上传到 GitHub。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
