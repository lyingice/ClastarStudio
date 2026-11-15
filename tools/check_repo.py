from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
errors = []
required = [
    "index.html",
    "manifest.json",
    "sw.js",
    "serve.py",
    "README.md",
    "LICENSE",
    "src/shell/core.js",
    "src/shell/editors.js",
    "src/shell/plugins.js",
    "src/shell/assets.js",
    "styles/assets.css",
    "src/embedded/anim.js",
    "plugin.json",
    "plugins/catalog.json",
    "plugins/create-texture/manifest.json",
    "plugins/create-texture/plugin.html",
    "styles/shell.css",
    "icon-192.png",
    "icon-512.png",
]
for rel in required:
    if not (ROOT / rel).is_file():
        errors.append(f"missing required file: {rel}")

try:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("start_url") != "./":
        errors.append("manifest.json: start_url should be './'")
    for icon in manifest.get("icons", []):
        src = icon.get("src", "").lstrip("./")
        if src and not (ROOT / src).is_file():
            errors.append(f"manifest icon missing: {src}")
except Exception as exc:
    errors.append(f"manifest.json is invalid: {exc}")

html = (ROOT / "index.html").read_text(encoding="utf-8")
for ref in re.findall(r'(?:src|href)="([^"]+)"', html):
    if ref.startswith(("#", "http://", "https://", "//", "data:", "mailto:", "javascript:")):
        continue
    clean = ref.split("?", 1)[0].split("#", 1)[0]
    if clean and not (ROOT / clean).is_file():
        errors.append(f"index.html references missing local asset: {ref}")

readme = (ROOT / "README.md").read_text(encoding="utf-8")
core = (ROOT / "src/shell/core.js").read_text(encoding="utf-8")
version_match = re.search(r"APP_VERSION\s*=\s*'([^']+)'", core)
if not version_match:
    errors.append("src/shell/core.js: APP_VERSION is missing")
else:
    version = version_match.group(1)
    if version not in readme:
        errors.append(f"README.md does not mention current version {version}")
if "MIT License" not in readme:
    errors.append("README.md does not link the MIT license")

try:
    plugin_manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
    for key in ("id", "name", "version", "entry"):
        if not plugin_manifest.get(key):
            errors.append(f"plugin.json: missing {key}")
    entry = plugin_manifest.get("entry", "")
    if entry and not (ROOT / entry).is_file():
        errors.append(f"plugin.json: entry not found: {entry}")
except Exception as exc:
    errors.append(f"plugin.json is invalid: {exc}")

if errors:
    print("Repository checks failed:")
    for item in errors:
        print(f" - {item}")
    sys.exit(1)

print(f"Repository checks passed: {len(html)} bytes of index.html, "
      f"{len(manifest.get('icons', []))} manifest icons.")
