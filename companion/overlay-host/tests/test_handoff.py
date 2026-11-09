import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from keybard_host.build import build_label
from keybard_host.handoff import hand_off, same_build, ask_to_quit, fetch_bootstrap
from keybard_host.state import HostState
from keybard_host.server import make_server

MINE = {'version': 'altgr-rc4', 'keybardCommit': 'bbbbbbb', 'testBuild': True}
URL = 'http://127.0.0.1:5178/'


def old(version='altgr-rc3', commit='aaaaaaa'):
    return {'token': 't', 'version': version, 'keybardCommit': commit, 'testBuild': True}


class Compare(unittest.TestCase):
    def test_same_build_needs_every_field_equal(self):
        self.assertTrue(same_build(MINE, dict(MINE)))
        for change in ({'version': 'x'}, {'keybardCommit': 'c'}, {'testBuild': False}):
            self.assertFalse(same_build(MINE, {**MINE, **change}))

    def test_label_names_the_build(self):
        self.assertEqual(build_label(MINE), 'Keybard Overlay altgr-rc4 · Keybard bbbbbbb · test build')
        self.assertEqual(build_label({'version': 'v4.3.6', 'keybardCommit': None, 'testBuild': False}), 'Keybard Overlay v4.3.6')


class HandOff(unittest.TestCase):
    def run_hand_off(self, running, accepts=True, release_after=0, wait=1.0):
        asked = []; tries = []
        def ask(url, token): asked.append(token); return accepts
        def try_lock(): tries.append(1); return len(tries) > release_after
        outcome = hand_off(URL, MINE, try_lock, fetch=lambda url: running, ask=ask, wait=wait, sleep=lambda s: None)
        return outcome, asked, tries

    def test_same_build_opens_the_running_controls_and_does_not_ask(self):
        outcome, asked, _ = self.run_hand_off({**old(), 'version': 'altgr-rc4', 'keybardCommit': 'bbbbbbb'})
        self.assertEqual(outcome.action, 'open'); self.assertEqual(asked, [])

    def test_different_build_that_cooperates_is_replaced(self):
        outcome, asked, tries = self.run_hand_off(old(), release_after=3)
        self.assertEqual(outcome.action, 'start'); self.assertEqual(asked, ['t']); self.assertEqual(len(tries), 4)

    def test_silent_old_build_gets_a_clear_message(self):
        outcome, _, _ = self.run_hand_off(old(), accepts=False)
        self.assertEqual(outcome.action, 'refuse')
        self.assertEqual(outcome.message, 'Another Keybard Overlay (Keybard Overlay altgr-rc3 · Keybard aaaaaaa · test build) is running. Quit it from its tray icon, then start this one again.')

    def test_build_with_no_version_is_called_older_and_still_asked(self):
        outcome, asked, _ = self.run_hand_off({'token': 't'}, accepts=False)
        self.assertEqual(asked, ['t']); self.assertIn('(an older build)', outcome.message)

    def test_unreachable_host_refuses(self):
        outcome, asked, _ = self.run_hand_off(None)
        self.assertEqual(outcome.action, 'refuse'); self.assertEqual(asked, [])

    def test_agreed_to_quit_but_never_lets_go_refuses_after_waiting(self):
        outcome, _, _ = self.run_hand_off(old(), release_after=10 ** 9, wait=0.0)
        self.assertEqual(outcome.action, 'refuse')


class QuitEndpoint(unittest.TestCase):
    def serve(self, paranoid=False):
        self.temp = tempfile.TemporaryDirectory(); root = Path(self.temp.name)
        (root / 'index.html').write_text('<html lang="en"></html>')
        self.state = HostState(root / 'p.json'); self.commands = []
        self.server = make_server(self.state, root, self.commands.append, paranoid=paranoid, page=b'<html></html>' if paranoid else None)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f'http://127.0.0.1:{self.server.server_port}/'
        self.addCleanup(lambda: (self.server.shutdown(), self.server.server_close(), self.temp.cleanup()))

    def test_bootstrap_reports_the_build_and_quit_needs_the_token(self):
        self.serve()
        data = fetch_bootstrap(self.url)
        self.assertEqual(set(data) >= {'version', 'keybardCommit', 'testBuild', 'token'}, True)
        self.assertFalse(ask_to_quit(self.url, 'wrong')); self.assertEqual(self.commands, [])
        self.assertTrue(ask_to_quit(self.url, data['token'])); self.assertEqual(self.commands, [{'op': 'quit'}])

    def test_a_website_origin_cannot_quit_it(self):
        self.serve()
        request = Request(self.url + 'api/host/quit', data=b'{}', headers={'X-Keybard-Token': self.state.token, 'Origin': 'https://keybard.svalboard.com'})
        with self.assertRaises(HTTPError) as e: urlopen(request)
        self.assertEqual(e.exception.code, 403); self.assertEqual(self.commands, [])

    def test_a_paranoid_host_ignores_quit(self):
        self.serve(paranoid=True)
        self.assertFalse(ask_to_quit(self.url, self.state.token)); self.assertEqual(self.commands, [])


if __name__ == '__main__': unittest.main()
