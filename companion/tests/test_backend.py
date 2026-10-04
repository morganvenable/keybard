import struct
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from context_companion.model import Config, Rule, Foreground, BrowserContext
from context_companion.engine import ContextEngine
from context_companion.device import HidDevice, SimulatedDevice


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.now = 10.
        self.device = SimulatedDevice()
        self.config = Config(None, [Rule('Onshape', origin='https://cad.onshape.com', layer=3)])
        self.engine = ContextEngine(self.config, self.device, clock=lambda: self.now)
        self.engine.pause(False)
        self.fg = Foreground('chrome.exe', '', 50)
        self.browser = BrowserContext('https://cad.onshape.com', '', True, 10, 'chrome.exe', 50)

    def test_app_selects_layer_and_exit_removes_host_contribution(self):
        self.engine.tick(self.fg, self.browser)
        self.assertEqual(self.engine.status['context'], 'Onshape')
        self.assertEqual(self.device.active_layer, 3)
        self.engine.tick(Foreground('notepad.exe', '', 60), self.browser)
        self.assertIsNone(self.device.active_layer)

    def test_plain_application_rule_does_not_need_browser(self):
        self.config.rules.append(Rule('Editor', exe='editor.exe', layer=2))
        self.engine.tick(Foreground('EDITOR.EXE', '', 4))
        self.assertEqual(self.device.active_layer, 2)

    def test_origin_requires_fresh_foreground_window_and_exe(self):
        for changed in [dict(received_at=0), dict(received_at=11), dict(focused=False),
                        dict(window_handle=51), dict(browser='msedge.exe'),
                        dict(origin='https://cad.onshape.com.evil.example')]:
            with self.subTest(changed=changed):
                browser = BrowserContext(**{**self.browser.__dict__, **changed})
                self.engine.tick(self.fg, browser)
                self.assertEqual(self.engine.status['context'], 'Default')

    def test_bridge_dict_and_first_matching_rule(self):
        self.config.rules.append(Rule('Second', layer=4))
        self.engine.tick(self.fg, dict(origin=self.browser.origin, browser_exe='chrome.exe',
                                    focused=True, observed_at=10, window_handle=50))
        self.assertEqual(self.device.active_layer, 3)

    def test_layer_zero_renews_and_pause_clears(self):
        self.config.default_layer = 0
        self.engine.tick(Foreground('notepad.exe'))
        self.now += 1.1
        self.engine.tick(Foreground('notepad.exe'))
        self.assertEqual(self.device.events[-1][0], 'renew')
        self.engine.pause(True)
        self.assertIsNone(self.device.active_layer)
        self.assertIsNone(self.engine.status['applied_layer'])

    def test_pin_and_use_default(self):
        self.engine.pin('Onshape')
        self.engine.tick(Foreground('notepad.exe', '', 60))
        self.assertEqual(self.device.active_layer, 3)
        self.engine.typing(True)
        self.engine.tick(Foreground('notepad.exe', '', 60))
        self.assertIsNone(self.device.active_layer)
        self.engine.tick(Foreground('another.exe', '', 61))
        self.assertIsNone(self.device.active_layer)
        self.engine.pin('Onshape')
        self.engine.tick(Foreground('another.exe', '', 61))
        self.assertEqual(self.device.active_layer, 3)

    def test_device_layer_count_is_validated_before_write(self):
        self.config.rules[0].layer = 17
        self.engine.tick(self.fg, self.browser)
        self.assertEqual(self.engine.status['state'], 'Error')
        self.assertIsNone(self.device.active_layer)

    def test_failure_does_not_claim_success_and_requires_enable(self):
        with patch.object(self.device, 'replace_layer', side_effect=OSError('Unplugged')):
            self.engine.tick(self.fg, self.browser)
        self.assertEqual(self.engine.status['state'], 'Error')
        self.assertTrue(self.engine.paused)
        self.engine.pause(False)
        self.engine.tick(self.fg, self.browser)
        self.assertEqual(self.engine.status['state'], 'Following')


class TransportTests(unittest.TestCase):
    def device(self):
        d = HidDevice.__new__(HidDevice)
        d.layer_count, d.transaction, d._next_transaction = 16, 0, 1
        return d

    def test_set_layer_wire_format_and_ack(self):
        d = self.device()
        calls = []
        def command(cmd, payload=b''):
            calls.append((cmd, payload))
            return bytes([0xdf, cmd, 0])
        d._command = command
        d.replace_layer(3)
        self.assertEqual(calls, [(0x26, struct.pack('<HB', 2, 3))])
        self.assertEqual(d.transaction, 2)
        d.replace_layer(None)
        self.assertEqual(calls[-1], (0x29, b''))
        self.assertEqual(d.transaction, 0)

    def test_failed_set_does_not_update_acknowledged_transaction(self):
        d = self.device()
        d._command = lambda cmd, payload=b'': bytes([0xdf, cmd, 1])
        with self.assertRaises(RuntimeError):
            d.replace_layer(2)
        self.assertEqual(d.transaction, 0)

    def test_invalid_layer_is_rejected_without_usb_write(self):
        d = self.device()
        with patch.object(d, '_command') as command:
            for value in [16, -1, True, 1.5]:
                with self.assertRaises(ValueError):
                    d.replace_layer(value)
            command.assert_not_called()

    def test_expired_or_replaced_lease_is_not_reported_renewed(self):
        d = self.device()
        d.transaction = 7
        d._command = lambda cmd, payload=b'': bytes([0xdf, cmd, 0, 1, 16, 255, 0, 0, 0, 0])
        with self.assertRaisesRegex(RuntimeError, 'expired'):
            d.renew()


class ConfigTests(unittest.TestCase):
    def test_unsupported_browser_origins_are_rejected(self):
        for origin in ['https://example.com', 'http://cad.onshape.com', 'https://cad.onshape.com/path']:
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                Config(None, [Rule('Browser', origin=origin)]).validate()

    def test_roundtrip_and_invalid_save_preserves_file(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'config.json'
            config = Config(None, [Rule('Onshape', layer=3)])
            config.save(path)
            self.assertEqual(Config.load(path).rules[0].layer, 3)
            original = path.read_bytes()
            config.rules[0].layer = 32
            with self.assertRaises(ValueError):
                config.save(path)
            self.assertEqual(path.read_bytes(), original)

    def test_tap_dance_draft_is_rejected_not_silently_reinterpreted(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'old.json'
            path.write_text('{"schema_version":1,"defaults":[],"rules":[]}')
            with self.assertRaisesRegex(ValueError, 'layer configuration'):
                Config.load(path)


if __name__ == '__main__':
    unittest.main()
