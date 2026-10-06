"""Loopback-only static site and narrowly scoped host API."""
import hmac
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs


class LocalServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


# Hosted Keybard sites that may use the host API from the browser. They still
# need the per-session token for every write, and only the local copy is served.
REMOTE_ORIGINS = frozenset({'https://keybard.svalboard.com'})


def make_server(state, assets, dispatch, port=0, remote_origins=REMOTE_ORIGINS):
    remote_origins = frozenset(remote_origins)

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *args): pass

        def local_host(self):
            # Rejects DNS-rebinding requests addressed to another host name.
            return self.headers.get('Host') in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}

        def origin_ok(self):
            return self.local_host() and self.headers.get('Origin', 'http://' + self.headers.get('Host', '')) in {f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'}

        def remote_origin(self):
            origin = self.headers.get('Origin')
            return origin if self.local_host() and origin in remote_origins else None

        def api_ok(self):
            return self.origin_ok() or self.remote_origin() is not None

        def end_headers(self):
            origin = self.remote_origin()
            if origin and urlsplit(self.path).path.startswith('/api/host/'):
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')
            super().end_headers()

        def do_OPTIONS(self):
            if not self.remote_origin() or not urlsplit(self.path).path.startswith('/api/host/'):
                return self.reply({'error': 'Local origin required'}, 403)
            self.send_response(204)
            self.send_header('Access-Control-Allow-Methods', 'GET, POST')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Keybard-Token')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.send_header('Access-Control-Max-Age', '600')
            self.send_header('Content-Length', '0')
            self.end_headers()

        def reply(self, value, status=200):
            body = json.dumps(value).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urlsplit(self.path)
            if not (self.api_ok() if path.path.startswith('/api/host/') else self.origin_ok()):
                return self.reply({'error': 'Local origin required'}, 403)
            if path.path == '/api/host/bootstrap': return self.reply(dict(token=state.token, apiVersion=1))
            if path.path == '/api/host/state':
                try: revision = int(parse_qs(path.query).get('layout', ['-1'])[0])
                except ValueError: return self.reply({'error': 'Invalid layout revision'}, 400)
                return self.reply(state.snapshot(revision))
            if path.path in ('/', '/index.html'):
                body = (assets / 'index.html').read_text(encoding='utf-8').replace('<html lang="en">', '<html lang="en" data-keybard-host="true">').encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers(); self.wfile.write(body); return
            if path.path.startswith('/api/'): return self.reply({'error': 'Unknown API'}, 404)
            super().do_GET()

        def do_POST(self):
            if not self.api_ok() or not hmac.compare_digest(self.headers.get('X-Keybard-Token', ''), state.token):
                return self.reply({'error': 'Local host authorization required'}, 403)
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 16384: raise ValueError('Invalid request size')
                value = json.loads(self.rfile.read(length))
                if not isinstance(value, dict): raise ValueError('Expected an object')
                if self.path == '/api/host/config':
                    revision = state.configure(value['config'], value['revision'])
                    dispatch({'op': 'configure'})
                    return self.reply({'revision': revision})
                if self.path != '/api/host/command': return self.reply({'error': 'Unknown API'}, 404)
                op = value.get('op')
                if op not in ('show', 'arrange', 'place', 'connect', 'disconnect', 'reload', 'scan', 'practice'):
                    raise ValueError('Unknown command')
                if op in ('show', 'arrange') and type(value.get('value')) is not bool: raise ValueError('Expected boolean')
                if op == 'practice':
                    hidden = value.get('hidden'); target = value.get('target')
                    if not isinstance(hidden, list) or len(hidden) > 60 or any(type(x) is not int or not 0 <= x < 60 for x in hidden): raise ValueError('Invalid hidden keys')
                    if target is not None and (type(target) is not int or not 0 <= target < 60): raise ValueError('Invalid target')
                if op == 'connect' and not isinstance(value.get('id'), str): raise ValueError('Expected device ID')
                dispatch(value)
                return self.reply({'accepted': True}, 202)
            except RuntimeError as e: return self.reply({'error': str(e)}, 409)
            except (ValueError, KeyError, TypeError) as e: return self.reply({'error': str(e)}, 400)
            except OSError: return self.reply({'error': 'Could not save local preferences'}, 500)
    return LocalServer(('127.0.0.1', port), partial(Handler, directory=str(assets)))
