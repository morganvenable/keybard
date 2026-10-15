"""The colored overlay's settings and the layer colors Keybard sends for it."""
import copy
import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from keybard_host.server import make_server
from keybard_host.state import COLORED_LOOKS, DEFAULTS, HostState, validate_config, validate_layer_colors

UID = str(0x1122334455667788)


class ColoredConfigTests(unittest.TestCase):
    def test_defaults_keep_the_see_through_overlay(self):
        self.assertEqual((DEFAULTS['style'], DEFAULTS['colorBy'], DEFAULTS['coloredOpacity'], DEFAULTS['coloredLook']),
                         ('see-through', 'source', 100, 'flat'))

    def test_accepts_each_style_coloring_look_and_opacity(self):
        for fields in (dict(style='colored'), dict(colorBy='active'), dict(coloredOpacity=0), dict(coloredOpacity=55),
                       *(dict(coloredLook=look) for look in COLORED_LOOKS.values())):
            with self.subTest(fields):
                self.assertEqual({k: validate_config(fields)[k] for k in fields}, fields)

    def test_rejects_unknown_values(self):
        for fields in (dict(style='neon'), dict(colorBy='layer'), dict(coloredOpacity=101), dict(coloredOpacity=-1),
                       dict(coloredOpacity=50.5), dict(coloredOpacity=True), dict(coloredLook='3d')):
            with self.subTest(fields), self.assertRaises(ValueError): validate_config(fields)

    def test_preferences_saved_before_the_colored_style_load_with_its_defaults(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'prefs.json'
            path.write_text('{"version": 1, "config": {"scale": 80}}')
            config = HostState(path).config
            self.assertEqual((config['scale'], config['style'], config['coloredLook']), (80, 'see-through', 'flat'))


class LayerColorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'prefs.json'
        self.state = HostState(self.path)

    def tearDown(self): self.temp.cleanup()

    def board(self, uid=UID):
        return dict(uid=uid, keymap=[[4]], keylayout={}, cosmetic=dict(layer={'0': 'Layer 0'}))

    def test_validates_names_and_hex_colors(self):
        self.assertEqual(validate_layer_colors({'0': 'green', '1': '#450770', '31': 'light-grey'}), {'0': 'green', '1': '#450770', '31': 'light-grey'})
        for value in ([], {'32': 'green'}, {'-1': 'green'}, {'x': 'green'}, {'0': 'chartreuse'}, {'0': 'url(x)'}, {'0': 5},
                      {str(i): 'green' for i in range(33)}):
            with self.subTest(value), self.assertRaises(ValueError): validate_layer_colors(value)

    def test_colors_for_the_connected_board_reach_the_overlay_with_a_new_layout(self):
        self.state.board = self.board(); before = self.state.layout_revision
        self.assertTrue(self.state.set_layer_colors(UID, {'0': 'green', '1': 'blue'}))
        self.assertEqual(self.state.layout_revision, before + 1)
        snapshot = self.state.snapshot()
        self.assertEqual(snapshot['board']['cosmetic'], {'layer': {'0': 'Layer 0'}, 'layer_colors': {'0': 'green', '1': 'blue'}})
        self.assertFalse(self.state.set_layer_colors(UID, {'0': 'green', '1': 'blue'}))  # unchanged: no new layout
        self.assertEqual(self.state.layout_revision, before + 1)

    def test_colors_for_another_board_are_kept_for_it(self):
        self.state.board = self.board(); before = self.state.layout_revision
        self.state.set_layer_colors('42', {'0': 'red'})
        self.assertEqual(self.state.layout_revision, before)
        self.assertNotIn('layer_colors', self.state.board['cosmetic'])
        self.assertEqual(self.state.with_layer_colors(self.board('42'))['cosmetic']['layer_colors'], {'0': 'red'})

    def test_colors_survive_a_restart_and_only_the_latest_boards_are_kept(self):
        for i in range(20): self.state.set_layer_colors(str(i), {'0': 'blue'})
        reopened = HostState(self.path)
        self.assertEqual(sorted(reopened.layer_colors, key=int), [str(i) for i in range(4, 20)])
        self.assertEqual(reopened.with_layer_colors(self.board('19'))['cosmetic']['layer_colors'], {'0': 'blue'})

    def test_damaged_saved_colors_are_ignored(self):
        self.path.write_text(json.dumps(dict(version=1, config={}, layerColors={UID: {'0': 'javascript:x'}, 'bad': {'0': 'red'}, '7': {'0': 'red'}})))
        self.assertEqual(HostState(self.path).layer_colors, {'7': {'0': 'red'}})

    def test_bad_uid_is_refused(self):
        for uid in (None, 5, '', '0x12', str(2**64), '1' * 21):
            with self.subTest(uid), self.assertRaises(ValueError): self.state.set_layer_colors(uid, {'0': 'green'})


class LayerColorCommandTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); root = Path(self.temp.name)
        (root / 'index.html').write_text('<html lang="en"><body>Keybard</body></html>')
        self.state = HostState(root / 'prefs.json'); self.commands = []
        self.server = make_server(self.state, root, self.commands.append)
        self.thread = threading.Thread(target=self.server.serve_forever); self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.temp.cleanup()

    def post(self, value, token=None):
        return urlopen(Request(self.base + '/api/host/command', data=json.dumps(value).encode(),
                               headers={'X-Keybard-Token': token or self.state.token, 'Content-Type': 'application/json'}))

    def test_keybard_sends_layer_colors_with_its_token(self):
        with self.post({'op': 'layerColors', 'uid': UID, 'colors': {'0': 'green', '2': '#123456'}}) as r: self.assertEqual(r.status, 202)
        self.assertEqual(self.state.layer_colors, {UID: {'0': 'green', '2': '#123456'}})
        self.assertEqual(self.commands, [{'op': 'layerColors'}])

    def test_invalid_or_unauthorized_layer_colors_are_refused(self):
        for value, token, code in (({'op': 'layerColors', 'uid': UID, 'colors': {'0': 'nope'}}, None, 400),
                                   ({'op': 'layerColors', 'uid': 'x', 'colors': {}}, None, 400),
                                   ({'op': 'layerColors', 'uid': UID, 'colors': {}, 'write': True}, None, 400),
                                   ({'op': 'layerColors', 'uid': UID, 'colors': {'0': 'green'}}, 'wrong', 403)):
            with self.subTest(value), self.assertRaises(HTTPError) as error: self.post(value, token)
            self.assertEqual(error.exception.code, code)
        self.assertEqual(self.state.layer_colors, {}); self.assertEqual(self.commands, [])

    def test_colored_style_round_trips_through_the_config_api(self):
        config = dict(copy.deepcopy(DEFAULTS), style='colored', colorBy='active', coloredOpacity=70, coloredLook='raised')
        with urlopen(Request(self.base + '/api/host/config', data=json.dumps({'config': config, 'revision': 0}).encode(),
                             headers={'X-Keybard-Token': self.state.token, 'Content-Type': 'application/json'})) as r:
            self.assertEqual(r.status, 200)
        self.assertEqual(self.state.snapshot()['config'], config)


if __name__ == '__main__':
    unittest.main()
