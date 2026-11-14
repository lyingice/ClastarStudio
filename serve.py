#!/usr/bin/env python3
"""Local development server for the Clastar Studio shell.

The app is still the original single-file shell. Keeping this server minimal
preserves the baseline behaviour while the file split is prepared.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import os


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    root = os.path.dirname(os.path.abspath(__file__))
    port = int(os.environ.get('PORT', '8766'))
    host = os.environ.get('HOST', '127.0.0.1')
    server = ThreadingHTTPServer((host, port), partial(Handler, directory=root))
    print(f'Clastar Studio: http://{host}:{port}/')
    server.serve_forever()
