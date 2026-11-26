"""Repository self-check: static manifest, SW assets, version consistency, plugin manifest.

Run: python tools/check_repo.py
Used by CI (.github/workflows/ci.yml) and local pre-commit checks.
"""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
errors = []

# ── 1. Shared static manifest ──────────────────────────────────────────
manifest_path = ROOT / "tools" / "static_manifest.json"
if not manifest_path.is_file():
    errors.append("missing tools/static_manifest.json")
    manifest = {}
else:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"static_manifest.json is invalid: {exc}")
        manifest = {}

for rel in manifest.get("root_files", []):
    if not (ROOT / rel).is_file():
        errors.append(f"manifest root_file missing: {rel}")
for d in manifest.get("directories", []):
    if not (ROOT / d).is_dir():
        errors.append(f"manifest directory missing: {d}")

# ── 2. Required core files ─────────────────────────────────────────────
required = [
    "index.html", "manifest.json", "sw.js", "serve.py",
    "README.md", "LICENSE",
    "src/shell/core.js", "src/shell/editors.js",
    "src/shell/plugins.js", "src/shell/assets.js",
    "styles/assets.css", "src/embedded/anim.js",
    "plugin.json", "plugins/catalog.json",
    "plugins/create-texture/manifest.json",
    "plugins/create-texture/plugin.html",
    "styles/shell.css", "icon-192.png", "icon-512.png",
]
for rel in required:
    if not (ROOT / rel).is_file():
        errors.append(f"missing required file: {rel}")

# ── 3. PWA manifest ────────────────────────────────────────────────────
try:
    pwa = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    if pwa.get("start_url") != "./":
        errors.append("manifest.json: start_url should be './'")
    for icon in pwa.get("icons", []):
        src = icon.get("src", "").lstrip("./")
        if src and not (ROOT / src).is_file():
            errors.append(f"manifest icon missing: {src}")
except Exception as exc:
    errors.append(f"manifest.json is invalid: {exc}")

# ── 4. index.html local references exist ───────────────────────────────
html = (ROOT / "index.html").read_text(encoding="utf-8")
html_refs = set()
for ref in re.findall(r'(?:src|href)="([^"]+)"', html):
    if ref.startswith(("#", "http://", "https://", "//", "data:", "mailto:", "javascript:")):
        continue
    clean = ref.split("?", 1)[0].split("#", 1)[0]
    if clean:
        html_refs.add(clean)
        if not (ROOT / clean).is_file():
            errors.append(f"index.html references missing local asset: {ref}")

# ── 5. sw.js ASSETS cross-check ────────────────────────────────────────
sw_text = (ROOT / "sw.js").read_text(encoding="utf-8")
sw_assets = re.findall(r"'(\./[^']+)'", sw_text.split("const ASSETS")[1].split("];")[0]) if "const ASSETS" in sw_text else []
sw_set = {a.lstrip("./") for a in sw_assets}

# Every index.html local ref must be in SW ASSETS
for ref in sorted(html_refs):
    if ref not in sw_set:
        errors.append(f"index.html asset not in sw.js ASSETS: {ref}")

# Every SW ASSETS entry must exist on disk
for a in sw_assets:
    rel = a.lstrip("./")
    if not (ROOT / rel).is_file():
        errors.append(f"sw.js ASSETS entry missing on disk: {a}")

# Cross-check with static_manifest.json sw_assets
manifest_sw = {a.lstrip("./") for a in manifest.get("sw_assets", [])}
if manifest_sw and sw_set != manifest_sw:
    only_sw = sw_set - manifest_sw
    only_manifest = manifest_sw - sw_set
    if only_sw:
        errors.append(f"sw.js ASSETS not in static_manifest: {sorted(only_sw)}")
    if only_manifest:
        errors.append(f"static_manifest sw_assets not in sw.js: {sorted(only_manifest)}")

# SW cache prefix
cache_match = re.search(r"const CACHE\s*=\s*'([^']+)'", sw_text)
if cache_match:
    prefix = manifest.get("sw_cache_prefix", "pixel-workshop-")
    if not cache_match.group(1).startswith(prefix):
        errors.append(f"sw.js CACHE '{cache_match.group(1)}' does not start with manifest prefix '{prefix}'")

# ── 6. Version consistency ─────────────────────────────────────────────
core = (ROOT / "src/shell/core.js").read_text(encoding="utf-8")
version_match = re.search(r"APP_VERSION\s*=\s*'([^']+)'", core)
if not version_match:
    errors.append("src/shell/core.js: APP_VERSION is missing")
else:
    version = version_match.group(1)
    vtag = f"v{version}"
    # README must mention current version
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    if version not in readme:
        errors.append(f"README.md does not mention current version {version}")
    if "MIT License" not in readme:
        errors.append("README.md does not link the MIT license")
    # CONTRIBUTING and issue templates must not reference a stale version
    for rel in ["CONTRIBUTING.md", ".github/ISSUE_TEMPLATE/bug_report.yml",
                ".github/ISSUE_TEMPLATE/config.yml"]:
        p = ROOT / rel
        if p.is_file():
            text = p.read_text(encoding="utf-8")
            stale = re.findall(r"v\d+\.\d+\.\d+", text)
            for s in stale:
                if s != vtag:
                    errors.append(f"{rel} references stale version {s} (current {vtag})")

# ── 7. Plugin manifest ─────────────────────────────────────────────────
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

# ── Result ──────────────────────────────────────────────────────────────
if errors:
    print("Repository checks failed:")
    for item in errors:
        print(f" - {item}")
    sys.exit(1)

print(f"Repository checks passed: {len(html)} bytes index.html, "
      f"{len(sw_assets)} SW assets, {len(html_refs)} HTML refs, "
      f"version {version_match.group(1) if version_match else '?'}.")
