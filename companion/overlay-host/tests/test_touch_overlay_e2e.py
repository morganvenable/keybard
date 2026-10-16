"""End to end (demo): recorded touchpad reports through the real Host into its overlay page.

Starts the Host as `--demo-touch --replay-ptp fixtures/ptp-pinch.jsonl` does,
with the built Keybard in its web view, and reads back what the overlay drew:
a dot per finger on its own pad, and the spread. Needs the web build
(companion/overlay-host/web, or KEYBARD_HOST_WEB); skipped without it.
KEYBARD_HOST_SHOT=<png> also saves the overlay as drawn at the widest point.
"""
import json
import os
from pathlib import Path
import tempfile
import time
import unittest

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
HERE = Path(__file__).resolve().parent
WEB = Path(os.environ.get('KEYBARD_HOST_WEB', HERE.parent / 'web'))

try:
    from PySide6.QtCore import QEventLoop, QTimer
    from PySide6.QtWidgets import QApplication
    HAVE_QT = True
except ImportError:
    HAVE_QT = False

PROBE = """(() => {
  const layer = document.querySelector('[data-touch-layer]');
  if (!layer) return null;
  const pads = {}; for (const p of document.querySelectorAll('[data-touch-pad]')) pads[p.dataset.touchPad] = ['cx','cy','w','h'].map(k => +p.dataset[k]);
  const contacts = [...document.querySelectorAll('[data-touch-contact]')].map(e => ({hand: e.dataset.hand, x: +e.dataset.x, y: +e.dataset.y}));
  return JSON.stringify({pads, contacts, spread: layer.dataset.touchSpread});
})()"""


@unittest.skipUnless(HAVE_QT and (WEB / 'index.html').exists(), 'needs PySide6 and the Keybard web build')
class TouchOverlayEndToEnd(unittest.TestCase):
    def test_a_replayed_pinch_draws_a_finger_on_each_pad_and_the_spread(self):
        from keybard_host.__main__ import Host
        from keybard_host.state import HostState
        app = QApplication.instance() or QApplication([])
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        state = HostState(Path(tmp.name) / 'prefs.json')
        host = Host(app, WEB, state, 0)
        host.auto_connect = False
        host.scan_timer.stop()
        self.addCleanup(host.shutdown)
        host.start_demo_touch()
        host.enable_touch('replay', replay=HERE / 'fixtures' / 'ptp-pinch.jsonl')

        def run(ms):
            loop = QEventLoop(); QTimer.singleShot(ms, loop.quit); loop.exec()

        def probe():
            out = []
            loop = QEventLoop()
            host.surface.page().runJavaScript(PROBE, 0, lambda v: (out.append(v), loop.quit()))
            QTimer.singleShot(2000, loop.quit); loop.exec()
            return json.loads(out[0]) if out and out[0] else None

        seen, widest, shot = [], None, os.environ.get('KEYBARD_HOST_SHOT')
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline and len(seen) < 40:
            run(30)
            p = probe()
            if not p or len(p['contacts']) != 2: continue
            seen.append(p)
            if widest is None or float(p['spread']) > float(widest['spread']):
                widest = p
                if shot and float(p['spread']) > 70: host.surface.grab().save(shot)
        self.assertGreaterEqual(len(seen), 10, 'the overlay never drew two fingers')
        for p in seen:
            (lcx, lcy, lw, lh), (rcx, rcy, rw, rh) = p['pads']['left'], p['pads']['right']
            left, right = p['contacts']
            self.assertEqual((left['hand'], right['hand']), ('left', 'right'))
            self.assertLessEqual(abs(left['x'] - lcx), lw / 2 + 1); self.assertLessEqual(abs(left['y'] - lcy), lh / 2 + 1)
            self.assertLessEqual(abs(right['x'] - rcx), rw / 2 + 1); self.assertLessEqual(abs(right['y'] - rcy), rh / 2 + 1)
        spreads = sorted(float(p['spread']) for p in seen)
        self.assertGreater(spreads[-1] - spreads[0], 20, 'the spread should change as the pinch opens and closes')


if __name__ == '__main__':
    unittest.main()
