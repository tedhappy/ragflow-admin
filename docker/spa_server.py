#!/usr/bin/env python3
"""
SPA (Single Page Application) Server with API Proxy.
Serves static files and proxies /api/* requests to backend.
"""
import http.server
import socketserver
import os
import sys
import urllib.request
import urllib.error

BACKEND_PORT = int(os.environ.get('BACKEND_PORT', 8080))
FRONTEND_PORT = int(os.environ.get('FRONTEND_PORT', 8000))
BACKEND_URL = f'http://127.0.0.1:{BACKEND_PORT}'


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    """Handler for SPA with API proxy support."""

    def log_message(self, format, *args):
        """Custom log format."""
        sys.stderr.write(f"[frontend] {self.address_string()} - {format % args}\n")

    def do_request(self, method):
        if self.path.startswith('/api/'):
            self.proxy_to_backend(method)
        elif method == 'GET':
            path = self.translate_path(self.path)
            if not os.path.exists(path) or os.path.isdir(path):
                self.path = '/index.html'
            super().do_GET()

    def proxy_to_backend(self, method):
        url = BACKEND_URL + self.path
        headers = {k: v for k, v in self.headers.items()}
        body = None
        if method in ('POST', 'PUT', 'PATCH'):
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else None
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=60) as resp:
                self.send_response(resp.status)
                for k, v in resp.getheaders():
                    if k.lower() not in ('transfer-encoding', 'connection'):
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(resp.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(e.read())
        except urllib.error.URLError as e:
            sys.stderr.write(f"[frontend] Proxy error to {url}: {e}\n")
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"code": -1, "message": "Backend unavailable"}')
        except Exception as e:
            sys.stderr.write(f"[frontend] Unexpected proxy error to {url}: {e}\n")
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"code": -1, "message": "Backend error"}')

    def do_GET(self):
        self.do_request('GET')

    def do_POST(self):
        self.do_request('POST')

    def do_PUT(self):
        self.do_request('PUT')

    def do_DELETE(self):
        self.do_request('DELETE')


class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """Multi-threaded HTTP server to handle concurrent requests."""
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    os.chdir(os.environ.get('WEBROOT', '/ragflow-admin/web/dist'))
    with ThreadedHTTPServer(('', FRONTEND_PORT), SPAHandler) as httpd:
        print(f"[frontend] Serving on http://0.0.0.0:{FRONTEND_PORT} (multi-threaded)")
        httpd.serve_forever()
