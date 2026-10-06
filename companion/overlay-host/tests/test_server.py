import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from keybard_host.state import HostState, DEFAULTS
from keybard_host.server import make_server, is_paranoid_page
from keybard_host.browser import CONTAINMENT_FLAGS, contained_command

class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); root = Path(self.temp.name)
        (root / 'index.html').write_text('<html lang="en"><body>Keybard</body></html>')
        self.state = HostState(root / 'prefs.json'); self.commands = []
        self.server = make_server(self.state, root, self.commands.append)
        self.thread = threading.Thread(target=self.server.serve_forever); self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'
    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.temp.cleanup()
    def post(self, value, headers=None, path='/api/host/command'):
        return urlopen(Request(self.base + path, data=json.dumps(value).encode(), headers=headers or {'X-Keybard-Token': self.state.token, 'Content-Type': 'application/json'}))
    def test_local_assets_and_authorized_commands(self):
        with urlopen(self.base) as r: self.assertIn(b'data-keybard-host="true"', r.read())
        with self.post({'op': 'show', 'value': False}) as r: self.assertEqual(r.status, 202)
        self.assertEqual(self.commands, [{'op': 'show', 'value': False}])
    def test_foreign_origin_missing_token_and_write_commands_rejected(self):
        for value, headers, expected in [({'op': 'show', 'value': True}, {'X-Keybard-Token': self.state.token, 'Origin': 'https://evil.example'}, 403), ({'op': 'show', 'value': True}, {'Content-Type': 'application/json'}, 403), ({'op': 'flash'}, None, 400), ({'op': 'practice', 'hidden': [99], 'target': None}, None, 400)]:
            with self.assertRaises(HTTPError) as error: self.post(value, headers)
            self.assertEqual(error.exception.code, expected)
        self.assertEqual(self.commands, [])
    def test_configuration_revision_conflict(self):
        with self.post({'config': DEFAULTS, 'revision': 0}, path='/api/host/config') as r:
            self.assertEqual(json.load(r)['revision'], 1)
        with self.assertRaises(HTTPError) as error: self.post({'config': DEFAULTS, 'revision': 0}, path='/api/host/config')
        self.assertEqual(error.exception.code, 409)


class RemoteOriginTests(ServerTests):
    PROD = 'https://keybard.svalboard.com'

    def get(self, path, headers):
        return urlopen(Request(self.base + path, headers=headers))

    def test_hosted_keybard_reads_state_and_posts_with_token(self):
        with self.get('/api/host/bootstrap', {'Origin': self.PROD}) as r:
            self.assertEqual(r.headers['Access-Control-Allow-Origin'], self.PROD)
            self.assertEqual(json.loads(r.read())['token'], self.state.token)
        with self.get('/api/host/state?layout=-1', {'Origin': self.PROD}) as r:
            self.assertEqual(r.headers['Access-Control-Allow-Origin'], self.PROD)
        with self.post({'op': 'show', 'value': True}, {'X-Keybard-Token': self.state.token, 'Content-Type': 'application/json', 'Origin': self.PROD}) as r:
            self.assertEqual(r.status, 202); self.assertEqual(r.headers['Access-Control-Allow-Origin'], self.PROD)
        self.assertEqual(self.commands, [{'op': 'show', 'value': True}])

    def test_preflight_allows_token_header_for_hosted_keybard_only(self):
        with urlopen(Request(self.base + '/api/host/command', method='OPTIONS', headers={'Origin': self.PROD, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Private-Network': 'true'})) as r:
            self.assertEqual(r.status, 204)
            self.assertEqual(r.headers['Access-Control-Allow-Origin'], self.PROD)
            self.assertIn('X-Keybard-Token', r.headers['Access-Control-Allow-Headers'])
            self.assertEqual(r.headers['Access-Control-Allow-Private-Network'], 'true')
        with self.assertRaises(HTTPError) as error:
            urlopen(Request(self.base + '/api/host/command', method='OPTIONS', headers={'Origin': 'https://evil.example', 'Access-Control-Request-Method': 'POST'}))
        self.assertEqual(error.exception.code, 403)

    def test_hosted_keybard_still_needs_token_and_cannot_load_local_assets(self):
        with self.assertRaises(HTTPError) as error:
            self.post({'op': 'show', 'value': True}, {'Content-Type': 'application/json', 'Origin': self.PROD})
        self.assertEqual(error.exception.code, 403)
        with self.assertRaises(HTTPError) as error: self.get('/', {'Origin': self.PROD})
        self.assertEqual(error.exception.code, 403)

    def test_untrusted_origins_and_rebinding_rejected(self):
        for headers in [{'Origin': 'https://evil.example'}, {'Origin': self.PROD, 'Host': 'evil.example:5178'}]:
            with self.assertRaises(HTTPError) as error: self.get('/api/host/bootstrap', headers)
            self.assertEqual(error.exception.code, 403)
            self.assertIsNone(error.exception.headers['Access-Control-Allow-Origin'])

class Utf8IndexTests(unittest.TestCase):
    def test_non_ascii_index_is_served_as_utf8(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); (root / 'index.html').write_text('<html lang="en"><body>Svalboard → Keybard é</body></html>', encoding='utf-8')
            server = make_server(HostState(root / 'prefs.json'), root, lambda c: None)
            thread = threading.Thread(target=server.serve_forever); thread.start()
            try:
                with urlopen(f'http://127.0.0.1:{server.server_port}/') as r: body = r.read().decode('utf-8')
                self.assertIn('→ Keybard é', body); self.assertIn('data-keybard-host="true"', body)
            finally:
                server.shutdown(); server.server_close(); thread.join()

class HardeningTests(ServerTests):
    def test_pages_and_api_refuse_framing(self):
        for path in ('/', '/api/host/bootstrap'):
            with urlopen(self.base + path) as r:
                self.assertEqual(r.headers['X-Frame-Options'], 'DENY')
                self.assertIn("frame-ancestors 'none'", r.headers['Content-Security-Policy'])
    def test_bootstrap_reports_mode(self):
        with urlopen(self.base + '/api/host/bootstrap') as r: self.assertIs(json.load(r)['paranoid'], False)
        root = Path(self.temp.name); paranoid = make_server(self.state, root, lambda c: None, 0, set(), True)
        thread = threading.Thread(target=paranoid.serve_forever); thread.start()
        try:
            with urlopen(f'http://127.0.0.1:{paranoid.server_port}/api/host/bootstrap') as r: self.assertIs(json.load(r)['paranoid'], True)
        finally: paranoid.shutdown(); paranoid.server_close(); thread.join()
    def test_paranoid_mode_only_serves_a_paranoid_page(self):
        root = Path(self.temp.name)
        self.assertFalse(is_paranoid_page(root / 'index.html'))
        (root / 'p.html').write_text("<meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'\">", encoding='utf-8')
        self.assertTrue(is_paranoid_page(root / 'p.html'))
    def test_contained_browser_blocks_non_loopback_traffic(self):
        command = contained_command('chrome.exe', 'C:/profile dir', 'http://127.0.0.1:5178/')
        self.assertIn('--proxy-server=http://127.0.0.1:9', command)
        self.assertIn('--force-webrtc-ip-handling-policy=disable_non_proxied_udp', command)
        self.assertIn('--user-data-dir=C:/profile dir', command)
        # An explicit bypass list would drop Chromium's implicit loopback bypass and break the host.
        self.assertFalse(any(f.startswith('--proxy-bypass-list') for f in CONTAINMENT_FLAGS))
