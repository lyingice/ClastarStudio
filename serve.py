#!/usr/bin/env python3
"""Local development server for the Clastar Studio shell.

Serves the static app and exposes an optional same-origin proxy at
``POST /api/llm`` so the browser can reach LLM providers without CORS.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_ALLOWED_HOSTS = {
    'api.openai.com',
    'api.anthropic.com',
    'generativelanguage.googleapis.com',
    'api.deepseek.com',
    'api.moonshot.cn',
    'api.siliconflow.cn',
    'open.bigmodel.cn',
    'dashscope.aliyuncs.com',
    'localhost',
    '127.0.0.1',
    '::1',
}
LOOPBACK_HOSTS = {'localhost', '127.0.0.1', '::1'}
HOP_BY_HOP_HEADERS = {
    'host', 'connection', 'content-length', 'transfer-encoding',
    'keep-alive', 'te', 'trailer', 'upgrade',
}
MAX_BODY_BYTES = 8 * 1024 * 1024
UPSTREAM_TIMEOUT = 180
RATE_LIMIT = 120
RATE_WINDOW = 60.0

_rate_lock = threading.Lock()
_rate_hits = {}


def _is_loopback(host):
    """Return True when host only accepts local connections."""
    return (host or '').strip().lower().strip('[]') in LOOPBACK_HOSTS


def _lan_proxy_enabled():
    return os.environ.get('CLASTAR_LLM_PROXY_ALLOW_LAN', '').strip() == '1'


def _allowed_hosts():
    """Default allow-list plus hosts from CLASTAR_LLM_ALLOW_HOSTS."""
    hosts = set(DEFAULT_ALLOWED_HOSTS)
    extra = os.environ.get('CLASTAR_LLM_ALLOW_HOSTS', '')
    for item in extra.split(','):
        item = item.strip().lower()
        if item:
            hosts.add(item)
    return hosts


def _rate_allowed(ip):
    """Sliding-window limit: at most 120 proxy requests per minute per IP."""
    now = time.monotonic()
    with _rate_lock:
        hits = _rate_hits.get(ip)
        if hits is None:
            hits = _rate_hits[ip] = []
        cutoff = now - RATE_WINDOW
        while hits and hits[0] < cutoff:
            hits.pop(0)
        if len(hits) >= RATE_LIMIT:
            return False
        hits.append(now)
        if len(_rate_hits) > 4096:
            stale = [key for key, value in _rate_hits.items()
                     if not value or value[-1] < cutoff]
            for key in stale:
                del _rate_hits[key]
        return True


def _short_reason(exc):
    """Short, URL-free reason for an upstream failure."""
    reason = getattr(exc, 'reason', exc)
    text = str(reason).replace('\r', ' ').replace('\n', ' ').strip()
    return (text or exc.__class__.__name__)[:200]


def _clean_forward_headers(raw):
    """Return client headers minus hop-by-hop entries, or None if invalid."""
    if not isinstance(raw, dict):
        return None
    clean = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not isinstance(value, str):
            return None
        lower = key.lower()
        if lower in HOP_BY_HOP_HEADERS or lower.startswith('proxy-'):
            continue
        if '\r' in key or '\n' in key or '\r' in value or '\n' in value:
            return None
        try:
            key.encode('latin-1')
            value.encode('latin-1')
        except UnicodeEncodeError:
            return None
        clean[key] = value
    return clean


class Handler(SimpleHTTPRequestHandler):
    bound_host = os.environ.get('HOST', '127.0.0.1')
    _response_started = False

    def log_request(self, code='-', size='-'):
        # Log method/path/status only; drop the query string and body.
        path = self.path.split('?', 1)[0]
        self.log_message('"%s %s" %s', self.command, path, code)

    def send_response(self, code, message=None):
        self._response_started = True
        super().send_response(code, message)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if self.command != 'HEAD':
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _origin_ok(self):
        """Same-origin check for browser requests; missing Origin is allowed."""
        origin = self.headers.get('Origin')
        if not origin:
            return True
        host = self.headers.get('Host')
        if not host:
            return False
        return origin.rstrip('/').lower() == ('http://' + host).lower()

    def _discard_request_body(self, length, cap=32 * 1024 * 1024):
        """Drain a rejected request body so the 413 reaches the client."""
        remaining = min(length, cap)
        while remaining > 0:
            chunk = self.rfile.read(min(65536, remaining))
            if not chunk:
                break
            remaining -= len(chunk)

    def _relay_upstream(self, status, headers, stream):
        """Stream an upstream response to the client without buffering it."""
        self.close_connection = True
        self.send_response(status or 502)
        content_type = headers.get('Content-Type') if headers else None
        self.send_header('Content-Type', content_type or 'application/json')
        encoding = headers.get('Content-Encoding') if headers else None
        if encoding:
            self.send_header('Content-Encoding', encoding)
        self.end_headers()
        while True:
            chunk = stream.read(8192)
            if not chunk:
                break
            self.wfile.write(chunk)
            self.wfile.flush()

    def do_GET(self):
        if urllib.parse.urlsplit(self.path).path == '/api/llm/health':
            loopback = _is_loopback(self.bound_host)
            lan_enabled = _lan_proxy_enabled()
            self._send_json(200, {
                'ok': True,
                'proxy': loopback or lan_enabled,
                'loopback': loopback,
                'allowHosts': sorted(_allowed_hosts()),
                'lanEnabled': lan_enabled,
            })
            return
        super().do_GET()

    def do_OPTIONS(self):
        if urllib.parse.urlsplit(self.path).path != '/api/llm':
            self._send_json(404, {'error': 'not found'})
            return
        self.send_response(204)
        self.send_header('Allow', 'POST, OPTIONS')
        origin = self.headers.get('Origin')
        if origin:
            self.send_header('Access-Control-Allow-Origin', origin)
        self.end_headers()

    def do_POST(self):
        self._response_started = False
        try:
            if urllib.parse.urlsplit(self.path).path != '/api/llm':
                self._send_json(404, {'error': 'not found'})
                return
            self._handle_llm_proxy()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            if not self._response_started:
                try:
                    self._send_json(500, {'error': 'internal error'})
                except Exception:
                    pass

    def _handle_llm_proxy(self):
        client_ip = self.client_address[0] if self.client_address else '?'
        if not _rate_allowed(client_ip):
            self._send_json(429, {'error': 'rate limit exceeded'})
            return

        if not _is_loopback(self.bound_host) and not _lan_proxy_enabled():
            self._send_json(403, {
                'error': 'proxy disabled on non-loopback bind; '
                         'set CLASTAR_LLM_PROXY_ALLOW_LAN=1 to enable',
            })
            return
        if not self._origin_ok():
            self._send_json(403, {'error': 'origin mismatch'})
            return

        try:
            length = int(self.headers.get('Content-Length') or 0)
        except (TypeError, ValueError):
            self._send_json(400, {'error': 'invalid content-length'})
            return
        if length < 0:
            self._send_json(400, {'error': 'invalid content-length'})
            return
        if length > MAX_BODY_BYTES:
            self._send_json(413, {'error': 'request body too large'})
            self._discard_request_body(length)
            return

        raw = self.rfile.read(length) if length else b''
        try:
            payload = json.loads(raw.decode('utf-8')) if raw else None
        except (UnicodeDecodeError, ValueError):
            self._send_json(400, {'error': 'invalid json'})
            return
        if not isinstance(payload, dict):
            self._send_json(400, {'error': 'invalid request'})
            return

        target = payload.get('url')
        if not isinstance(target, str) or not target:
            self._send_json(400, {'error': 'invalid url'})
            return
        parsed = urllib.parse.urlsplit(target)
        hostname = (parsed.hostname or '').lower()
        loopback_target = hostname in LOOPBACK_HOSTS
        if (not hostname or parsed.scheme not in ('https', 'http')
                or (parsed.scheme == 'http' and not loopback_target)):
            self._send_json(403, {'error': 'host not allowed'})
            return
        if hostname not in _allowed_hosts():
            self._send_json(403, {'error': 'host not allowed'})
            return

        headers = _clean_forward_headers(payload.get('headers') or {})
        if headers is None:
            self._send_json(400, {'error': 'invalid headers'})
            return
        if not any(key.lower() == 'content-type' for key in headers):
            headers['Content-Type'] = 'application/json'

        body = payload.get('body')
        if body is None:
            body_bytes = b''
        elif isinstance(body, str):
            body_bytes = body.encode('utf-8')
        else:
            try:
                body_bytes = json.dumps(body, ensure_ascii=False).encode('utf-8')
            except (TypeError, ValueError):
                self._send_json(400, {'error': 'invalid body'})
                return
        if len(body_bytes) > MAX_BODY_BYTES:
            self._send_json(413, {'error': 'request body too large'})
            return

        request = urllib.request.Request(
            target, data=body_bytes, headers=headers, method='POST')
        try:
            response = urllib.request.urlopen(request, timeout=UPSTREAM_TIMEOUT)
        except urllib.error.HTTPError as err:
            try:
                self._relay_upstream(err.code, err.headers, err)
            finally:
                err.close()
            return
        except Exception as exc:
            self._send_json(502, {
                'error': 'upstream unreachable: ' + _short_reason(exc),
            })
            return

        try:
            with response:
                status = getattr(response, 'status', None) or response.getcode()
                self._relay_upstream(status, response.headers, response)
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == '__main__':
    root = os.path.dirname(os.path.abspath(__file__))
    port = int(os.environ.get('PORT', '8766'))
    host = os.environ.get('HOST', '127.0.0.1')
    Handler.bound_host = host
    server = ThreadingHTTPServer((host, port), partial(Handler, directory=root))
    print(f'Clastar Studio: http://{host}:{port}/')
    server.serve_forever()
