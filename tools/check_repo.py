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
    "src/embedded/anim.js",
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
if "0.12.0" not in readme:
    errors.append("README.md does not mention 0.12.0")
if "MIT License" not in readme:
    errors.append("README.md does not link the MIT license")

if errors:
    print("Repository checks failed:")
    for item in errors:
        print(f" - {item}")
    sys.exit(1)

print(f"Repository checks passed: {len(html)} bytes of index.html, "
      f"{len(manifest.get('icons', []))} manifest icons.")
