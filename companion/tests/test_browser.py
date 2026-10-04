import io
import json
import tempfile
import unittest
from unittest.mock import patch

from context_companion.browser import BrowserBridge
from context_companion.model import Foreground


class FakeServer:
    def __init__(self, address, handler):
        self.handler = handler
        self.server_address = ('127.0.0.1', 19732)

    def serve_forever(self):
        pass

    def shutdown(self):
        pass

    def server_close(self):
        pass


class BrowserTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.fg = Foreground('chrome.exe', '', 123)
        self.bridge = BrowserBridge(lambda: self.fg, self.temp.name, clock=lambda: 10., wall_clock=lambda: 100.)
        self.payload = dict(browser='chrome.exe', origin='https://cad.onshape.com', focused=True,
                            sequence=1, session='a'*20, sent_at=100000)

    def test_valid_snapshot_is_defensive_copy_and_window_bound(self):
        self.bridge.receive(self.payload)
        value = self.bridge.snapshot()
        self.assertEqual(value.window_handle, 123)
        self.assertEqual(value.received_at, 10.)
        value.origin = 'changed'
        self.assertEqual(self.bridge.snapshot().origin, 'https://cad.onshape.com')

    def test_reject_bad_origin_timestamp_sequence_and_payload(self):
        for changes in [dict(origin='https://cad.onshape.com.evil.example'),
                        dict(origin='http://cad.onshape.com'), dict(origin='https://cad.onshape.com/document'),
                        dict(sent_at=96000), dict(sent_at=102000), dict(sent_at=float('nan')),
                        dict(sequence=True), dict(sequence=0), dict(focused='true'), dict(origin='')]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.bridge.receive({**self.payload, **changes})
        self.bridge.receive(self.payload)
        with self.assertRaises(ValueError):
            self.bridge.receive(self.payload)
        self.assertTrue(self.bridge.snapshot().focused)

    def test_other_browser_cannot_overwrite_active_context(self):
        self.bridge.receive(self.payload)
        self.bridge.receive({**self.payload, 'browser': 'msedge.exe', 'origin': '', 'focused': False})
        self.assertTrue(self.bridge.snapshot().focused)
        self.bridge.receive({**self.payload, 'sequence': 2, 'origin': '', 'focused': False})
        self.assertFalse(self.bridge.snapshot().focused)

    def test_no_foreground_does_not_activate(self):
        self.fg = Foreground()
        self.bridge.receive(self.payload)
        self.assertFalse(self.bridge.snapshot().focused)

    def test_token_persists(self):
        again = BrowserBridge(lambda: self.fg, self.temp.name)
        self.assertEqual(self.bridge.token, again.token)

    def handler(self, headers=None, body=None, path='/context'):
        with patch('context_companion.browser.ThreadingHTTPServer', FakeServer):
            self.bridge.start()
        self.addCleanup(self.bridge.stop)
        handler = self.bridge._server.handler.__new__(self.bridge._server.handler)
        encoded = json.dumps(body if body is not None else self.payload).encode()
        handler.headers = {'Host': '127.0.0.1:19732', 'Origin': 'chrome-extension://' + 'a'*32,
                           'Authorization': 'Bearer ' + self.bridge.token,
                           'Content-Type': 'application/json', 'Content-Length': str(len(encoded))}
        handler.headers.update(headers or {})
        handler.path = path
        handler.rfile = io.BytesIO(encoded)
        handler.wfile = io.BytesIO()
        handler.send_response = lambda status: setattr(handler, 'response_code', status)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        return handler

    def test_http_requires_token_extension_origin_and_loopback_host(self):
        for headers in [{'Authorization': 'Bearer wrong'}, {'Origin': 'https://cad.onshape.com'},
                        {'Host': 'attacker.example:19732'}, {'Origin': '', 'Authorization': ''}]:
            with self.subTest(headers=headers):
                handler = self.handler(headers)
                handler.do_POST()
                self.assertEqual(handler.response_code, 403)

    def test_http_accepted_and_body_limit(self):
        handler = self.handler()
        handler.do_POST()
        self.assertEqual(handler.response_code, 200)
        handler = self.handler({'Content-Length': '99999'})
        handler.do_POST()
        self.assertEqual(handler.response_code, 400)

    def test_originless_extension_health_still_requires_token(self):
        handler = self.handler({'Origin': ''}, path='/health')
        handler.do_GET()
        self.assertEqual(handler.response_code, 200)
        handler = self.handler({'Origin': '', 'Authorization': ''}, path='/health')
        handler.do_GET()
        self.assertEqual(handler.response_code, 403)

    def test_bind_failure_is_explicit(self):
        with patch('context_companion.browser.ThreadingHTTPServer.__init__', side_effect=OSError('port busy')):
            with self.assertRaises(OSError):
                self.bridge.start()
        self.assertFalse(self.bridge.running)
        self.assertIn('port busy', self.bridge.last_error)


if __name__ == '__main__':
    unittest.main()
