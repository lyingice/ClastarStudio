#!/usr/bin/env python3
"""Lightweight MCP stdio bridge for Clastar Studio (Pixel Workshop) assets.

Reads the synced asset index from ~/.clastar-studio/dsh-bridge/index.json
(or CLASTAR_DSH_BRIDGE_DIR) and exposes read/lookup/copy tools so coding
agents & DSH use artist-authored textures and Blockbench models verbatim
instead of hallucinating file paths or regenerating textures.
"""
import json
import os
import pathlib
import shutil
import sys

SERVER_INFO = {
    'name': 'clastar-studio-assets',
    'version': '0.1.0',
}
PROTOCOL_VERSION = '2024-11-05'


def bridge_dir():
    raw = os.environ.get('CLASTAR_DSH_BRIDGE_DIR', '').strip()
    if raw:
        return pathlib.Path(raw).expanduser().resolve()
    return (pathlib.Path.home() / '.clastar-studio' / 'dsh-bridge').resolve()


def load_index():
    root = bridge_dir()
    idx_file = root / 'index.json'
    if not idx_file.is_file():
        return None, root
    data = json.loads(idx_file.read_text(encoding='utf-8'))
    return data, root


def _safe_rel(rel):
    if not isinstance(rel, str):
        return None
    norm = rel.replace('\\', '/').strip()
    if not norm or norm.startswith('/') or ':' in norm or '\x00' in norm:
        return None
    parts = [p for p in norm.split('/') if p]
    if not parts or any(p in ('.', '..') for p in parts):
        return None
    return pathlib.PurePosixPath(*parts).as_posix()


def _resolve_entry(data, root, ref='', asset_id='', name=''):
    assets = data.get('assets') or []
    models = data.get('models') or []
    files_root = root / 'files'

    for a in assets:
        if (ref and a.get('ref') == ref) or (asset_id and a.get('id') == asset_id) or (name and a.get('name') == name):
            item = dict(a)
            item['resolvedFiles'] = [
                {
                    'relPath': p,
                    'absPath': str((files_root / _safe_rel(p)).resolve()) if _safe_rel(p) else None,
                    'exists': bool(_safe_rel(p) and (files_root / _safe_rel(p)).is_file()),
                }
                for p in (a.get('paths') or [])
            ]
            return 'asset', item

    for m in models:
        if (ref and m.get('ref') == ref) or (asset_id and m.get('id') == asset_id) or (name and m.get('name') == name):
            item = dict(m)
            item['resolvedParts'] = [
                {
                    'id': p.get('id'),
                    'ref': p.get('ref'),
                    'name': p.get('name'),
                    'role': p.get('role'),
                    'relPath': p.get('path'),
                    'absPath': str((files_root / _safe_rel(p.get('path', ''))).resolve()) if _safe_rel(p.get('path', '')) else None,
                    'exists': bool(_safe_rel(p.get('path', '')) and (files_root / _safe_rel(p.get('path', ''))).is_file()),
                }
                for p in (m.get('parts') or [])
            ]
            return 'model', item

        for p in (m.get('parts') or []):
            if (ref and p.get('ref') == ref) or (asset_id and p.get('id') == asset_id):
                rel = _safe_rel(p.get('path', ''))
                item = dict(p)
                item['absPath'] = str((files_root / rel).resolve()) if rel else None
                item['exists'] = bool(rel and (files_root / rel).is_file())
                return 'model_part', item

    return None, None


def _text_result(payload, is_error=False):
    text = json.dumps(payload, ensure_ascii=False, indent=2) if not isinstance(payload, str) else payload
    return {'content': [{'type': 'text', 'text': text}], 'isError': is_error}


def tool_list_studio_assets(args):
    data, root = load_index()
    if data is None:
        return _text_result({
            'ok': False,
            'error': '未找到 DSH 资产索引。请在像素工坊点击右侧「DSH 资产索引 -> 同步到 DSH 索引」。',
            'bridgeDir': str(root),
        }, is_error=True)

    query = str(args.get('query') or '').strip().lower()
    kind = str(args.get('kind') or '').strip().lower()
    workspace = str(args.get('workspace') or '').strip().lower()

    assets_out = []
    for a in (data.get('assets') or []):
        if kind and kind != 'model' and str(a.get('kind') or '').lower() != kind:
            continue
        if workspace and str(a.get('workspace') or '').lower() != workspace:
            continue
        if query:
            hay = ' '.join([
                str(a.get('name') or ''),
                str(a.get('ref') or ''),
                str(a.get('kind') or ''),
                ' '.join(a.get('paths') or []),
            ]).lower()
            if query not in hay:
                continue
        assets_out.append(a)

    models_out = []
    if not kind or kind == 'model':
        for m in (data.get('models') or []):
            if query:
                hay = ' '.join([
                    str(m.get('name') or ''),
                    str(m.get('ref') or ''),
                    str(m.get('format') or ''),
                ]).lower()
                if query not in hay:
                    continue
            models_out.append(m)

    return _text_result({
        'ok': True,
        'bridgeDir': str(root),
        'namespace': data.get('namespace'),
        'generatedAt': data.get('generatedAt'),
        'assets': assets_out,
        'models': models_out,
    })


def tool_get_asset_spec(args):
    data, root = load_index()
    if data is None:
        return _text_result({'ok': False, 'error': '未找到 DSH 资产索引', 'bridgeDir': str(root)}, is_error=True)

    entry_type, item = _resolve_entry(
        data,
        root,
        ref=str(args.get('ref') or '').strip(),
        asset_id=str(args.get('id') or '').strip(),
        name=str(args.get('name') or '').strip(),
    )
    if not item:
        return _text_result({'ok': False, 'error': '未匹配到指定资产或模型'}, is_error=True)

    if args.get('include_text'):
        targets = item.get('resolvedFiles') or item.get('resolvedParts') or (
            [{'relPath': item.get('path'), 'absPath': item.get('absPath')}] if item.get('absPath') else []
        )
        for rf in targets:
            ap = rf.get('absPath')
            if ap and ap.endswith(('.mcmeta', '.bbmodel', '.json')) and os.path.isfile(ap):
                try:
                    rf['text'] = pathlib.Path(ap).read_text(encoding='utf-8')
                except Exception:
                    pass

    return _text_result({'ok': True, 'type': entry_type, 'bridgeDir': str(root), 'item': item})


def tool_copy_asset_to_mod_dir(args):
    data, root = load_index()
    if data is None:
        return _text_result({'ok': False, 'error': '未找到 DSH 资产索引', 'bridgeDir': str(root)}, is_error=True)

    target_raw = str(args.get('target_dir') or '').strip()
    if not target_raw:
        return _text_result({'ok': False, 'error': '缺少 target_dir 参数'}, is_error=True)
    target_root = pathlib.Path(target_raw).expanduser().resolve()

    entry_type, item = _resolve_entry(
        data,
        root,
        ref=str(args.get('ref') or '').strip(),
        asset_id=str(args.get('id') or '').strip(),
        name=str(args.get('name') or '').strip(),
    )
    if not item:
        return _text_result({'ok': False, 'error': '未匹配到指定资产或模型'}, is_error=True)

    overwrite = bool(args.get('overwrite', True))
    candidates = []
    if entry_type == 'asset':
        candidates = item.get('resolvedFiles') or []
    elif entry_type == 'model':
        candidates = item.get('resolvedParts') or []
    elif item.get('relPath') or item.get('path'):
        candidates = [{'relPath': item.get('relPath') or item.get('path'), 'absPath': item.get('absPath')}]

    copied = []
    for c in candidates:
        rel = _safe_rel(c.get('relPath') or '')
        src = pathlib.Path(c['absPath']) if c.get('absPath') else None
        if not rel or not src or not src.is_file():
            continue
        dest = (target_root / rel).resolve()
        if target_root != dest and target_root not in dest.parents:
            return _text_result({'ok': False, 'error': f'非法目标路径: {rel}'}, is_error=True)
        if dest.exists() and not overwrite:
            copied.append({'relPath': rel, 'destPath': str(dest), 'skipped': True})
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        copied.append({'relPath': rel, 'destPath': str(dest), 'skipped': False})

    return _text_result({
        'ok': True,
        'ref': item.get('ref'),
        'targetDir': str(target_root),
        'copied': copied,
    })


TOOLS = [
    {
        'name': 'list_studio_assets',
        'description': 'List finalized Clastar Studio textures, blocks, animations, armor, and 3D models synced into DSH bridge index.',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'query': {'type': 'string', 'description': 'Optional keyword filter matching name, ref, or path'},
                'kind': {'type': 'string', 'description': 'Optional kind filter: block, item, anim, armor, equip, texture, model'},
                'workspace': {'type': 'string', 'description': 'Optional workspace name filter'},
            },
        },
    },
    {
        'name': 'get_asset_spec',
        'description': 'Resolve an exact asset ref (e.g. clastar:block:ns:slug), id, or name to absolute PNG/mcmeta/bbmodel paths and metadata.',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'ref': {'type': 'string'},
                'id': {'type': 'string'},
                'name': {'type': 'string'},
                'include_text': {'type': 'boolean', 'description': 'Inline .mcmeta/.bbmodel file contents'},
            },
        },
    },
    {
        'name': 'copy_asset_to_mod_dir',
        'description': 'Copy resolved asset files (.png, .png.mcmeta, .bbmodel) from the Clastar bridge store into a target mod or resourcepack directory.',
        'inputSchema': {
            'type': 'object',
            'required': ['target_dir'],
            'properties': {
                'ref': {'type': 'string'},
                'id': {'type': 'string'},
                'name': {'type': 'string'},
                'target_dir': {'type': 'string', 'description': 'Target mod resources or resourcepack root directory'},
                'overwrite': {'type': 'boolean', 'default': True},
            },
        },
    },
]


def handle_message(msg):
    method = msg.get('method')
    msg_id = msg.get('id')
    params = msg.get('params') or {}

    if method == 'notifications/initialized':
        return None

    if method == 'initialize':
        res = {
            'protocolVersion': PROTOCOL_VERSION,
            'capabilities': {'tools': {}, 'resources': {}},
            'serverInfo': SERVER_INFO,
        }
    elif method == 'ping':
        res = {}
    elif method == 'tools/list':
        res = {'tools': TOOLS}
    elif method == 'tools/call':
        name = params.get('name')
        args = params.get('arguments') or {}
        if name == 'list_studio_assets':
            res = tool_list_studio_assets(args)
        elif name == 'get_asset_spec':
            res = tool_get_asset_spec(args)
        elif name == 'copy_asset_to_mod_dir':
            res = tool_copy_asset_to_mod_dir(args)
        else:
            return {'jsonrpc': '2.0', 'id': msg_id, 'error': {'code': -32601, 'message': f'Unknown tool: {name}'}}
    elif method == 'resources/list':
        res = {
            'resources': [{
                'uri': 'clastar://index',
                'name': 'Clastar Studio Asset Index',
                'mimeType': 'application/json',
            }]
        }
    elif method == 'resources/read':
        uri = params.get('uri')
        if uri == 'clastar://index':
            data, _ = load_index()
            res = {
                'contents': [{
                    'uri': uri,
                    'mimeType': 'application/json',
                    'text': json.dumps(data or {}, ensure_ascii=False, indent=2),
                }]
            }
        else:
            return {'jsonrpc': '2.0', 'id': msg_id, 'error': {'code': -32002, 'message': f'Unknown resource: {uri}'}}
    else:
        if msg_id is None:
            return None
        return {'jsonrpc': '2.0', 'id': msg_id, 'error': {'code': -32601, 'message': f'Method not found: {method}'}}

    if msg_id is None:
        return None
    return {'jsonrpc': '2.0', 'id': msg_id, 'result': res}


def serve_stdio():
    stdin = sys.stdin.buffer
    stdout = sys.stdout.buffer
    while True:
        line = stdin.readline()
        if not line:
            break
        if line.lower().startswith(b'content-length:'):
            length = int(line.split(b':', 1)[1].strip())
            while True:
                hdr = stdin.readline()
                if not hdr or hdr in (b'\r\n', b'\n'):
                    break
            body = stdin.read(length)
            framed = True
        else:
            stripped = line.strip()
            if not stripped:
                continue
            body = stripped
            framed = False

        try:
            msg = json.loads(body.decode('utf-8'))
        except Exception:
            continue

        resp = handle_message(msg)
        if resp is None:
            continue
        encoded = json.dumps(resp, ensure_ascii=False).encode('utf-8')
        if framed:
            stdout.write(f'Content-Length: {len(encoded)}\r\n\r\n'.encode('ascii') + encoded)
        else:
            stdout.write(encoded + b'\n')
        stdout.flush()


if __name__ == '__main__':
    serve_stdio()
