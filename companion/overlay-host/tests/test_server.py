import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from keybard_host.state import HostState, DEFAULTS
from keybard_host.server import make_server

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
