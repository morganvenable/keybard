"""Loopback-only static site and narrowly scoped host API."""
import hmac
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs


class LocalServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def make_server(state, assets, dispatch, port=0):
    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *args): pass

        def origin_ok(self):
            allowed = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
            return self.headers.get('Host') in allowed and self.headers.get('Origin', 'http://' + self.headers.get('Host', '')) in {'http://' + h for h in allowed}

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
            if not self.origin_ok(): return self.reply({'error': 'Local origin required'}, 403)
            path = urlsplit(self.path)
            if path.path == '/api/host/bootstrap': return self.reply(dict(token=state.token, apiVersion=1))
            if path.path == '/api/host/state':
                try: revision = int(parse_qs(path.query).get('layout', ['-1'])[0])
                except ValueError: return self.reply({'error': 'Invalid layout revision'}, 400)
                return self.reply(state.snapshot(revision))
            if path.path in ('/', '/index.html'):
                body = (assets / 'index.html').read_text().replace('<html lang="en">', '<html lang="en" data-keybard-host="true">').encode()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers(); self.wfile.write(body); return
            if path.path.startswith('/api/'): return self.reply({'error': 'Unknown API'}, 404)
            super().do_GET()

        def do_POST(self):
            if not self.origin_ok() or not hmac.compare_digest(self.headers.get('X-Keybard-Token', ''), state.token):
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
