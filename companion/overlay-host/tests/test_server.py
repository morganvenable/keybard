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
