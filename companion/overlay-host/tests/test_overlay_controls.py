"""Native window input boundaries and overlay control actions."""
import os
import unittest
os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
try:
    from PySide6.QtCore import Qt, QPoint, QPointF
    from PySide6.QtGui import QMouseEvent
    from PySide6.QtWidgets import QApplication
    from keybard_host.__main__ import Surface, OverlayControls
    AVAILABLE = True
except ImportError:
    AVAILABLE = False

@unittest.skipUnless(AVAILABLE, 'Requires the native Qt WebEngine runtime')
class OverlayControlsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def setUp(self):
        self.surface = Surface(5178)
        self.calls = []
        self.controls = OverlayControls(self.surface, lambda: self.calls.append('hide'), lambda: self.calls.append('open'), lambda value: self.calls.append(value))

    def tearDown(self):
        self.controls.close(); self.surface.close()
        self.controls.deleteLater(); self.surface.deleteLater()
        self.app.processEvents()

    def test_click_through_is_default_and_handle_stays_interactive(self):
        import tempfile
        from pathlib import Path
        from keybard_host.state import HostState
        with tempfile.TemporaryDirectory() as folder:
            self.assertFalse(HostState(Path(folder) / 'preferences.json').arrange)
        self.assertFalse(self.surface.arranging)
        self.surface.set_arrange(False)
        self.assertFalse(self.surface.arranging)
        self.assertTrue(self.surface.windowFlags() & Qt.WindowTransparentForInput)
        self.assertFalse(self.controls.windowFlags() & Qt.WindowTransparentForInput)
        self.assertFalse(self.controls.handle.testAttribute(Qt.WA_TransparentForMouseEvents))

    def test_drag_by_keys_takes_input_only_on_the_keys(self):
        self.surface.set_arrange(True)
        # Until the overlay reports keys, nothing is visible, so nothing takes a click.
        self.assertTrue(self.surface.windowFlags() & Qt.WindowTransparentForInput)
        # The page answers in JSON.
        self.surface.apply_key_rects('[[10, 20, 37, 37], [50, 20.4, 37, 37]]')
        self.assertFalse(self.surface.windowFlags() & Qt.WindowTransparentForInput)
        mask = self.surface.mask()
        self.assertTrue(mask.contains(QPoint(20, 30)))
        self.assertTrue(mask.contains(QPoint(85, 55)))
        self.assertFalse(mask.contains(QPoint(5, 5)))
        self.assertFalse(mask.contains(QPoint(20, 80)))
        self.assertFalse(mask.contains(QPoint(150, 30)))
        # The keys disappear (overlay hidden or board lost): clicks pass through again.
        self.surface.apply_key_rects([])
        self.assertTrue(self.surface.windowFlags() & Qt.WindowTransparentForInput)
        self.assertTrue(self.surface.mask().isEmpty())
        self.surface.apply_key_rects([[10, 20, 37, 37]])
        self.surface.set_arrange(False)
        self.assertTrue(self.surface.windowFlags() & Qt.WindowTransparentForInput)
        self.assertTrue(self.surface.mask().isEmpty())
        # Late answers from the page don't turn input back on.
        self.surface.apply_key_rects([[10, 20, 37, 37]])
        self.assertTrue(self.surface.windowFlags() & Qt.WindowTransparentForInput)

    def test_control_menu_has_working_hide_open_and_drag_by_keys(self):
        actions = self.controls.more.menu().actions()
        actions[0].trigger(); actions[1].trigger(); actions[2].trigger()
        self.assertEqual(self.calls, ['hide', 'open', True])

    def test_handle_drags_surface_even_in_click_through(self):
        self.surface.set_arrange(False)
        self.surface.move(100, 100)
        before = self.surface.pos()
        handle = self.controls.handle
        handle.mousePressEvent(QMouseEvent(QMouseEvent.MouseButtonPress, QPointF(4,4), QPointF(200,200), Qt.LeftButton, Qt.LeftButton, Qt.NoModifier))
        handle.mouseMoveEvent(QMouseEvent(QMouseEvent.MouseMove, QPointF(24,14), QPointF(220,210), Qt.NoButton, Qt.LeftButton, Qt.NoModifier))
        self.assertEqual(self.surface.pos(), before + QPoint(20,10))
        handle.mouseReleaseEvent(QMouseEvent(QMouseEvent.MouseButtonRelease, QPointF(24,14), QPointF(220,210), Qt.LeftButton, Qt.NoButton, Qt.NoModifier))
        self.assertIsNone(handle.offset)

    def test_layer_changes_publish_immediately_without_an_http_poll(self):
        from types import SimpleNamespace
        from unittest.mock import Mock, patch
        from keybard_host.__main__ import Host
        state = {'layoutRevision': 1, 'active': 0}
        page = SimpleNamespace(runJavaScript=Mock())
        host = SimpleNamespace(state=SimpleNamespace(snapshot=lambda revision: dict(state)),
            surface=SimpleNamespace(page=lambda: page), published_layout=-1, published_state=None, last_publish=0)
        with patch('keybard_host.__main__.time.monotonic', return_value=10):
            Host.publish_state(host)
            Host.publish_state(host)
            self.assertEqual(page.runJavaScript.call_count, 1)
            state['active'] = 4
            Host.publish_state(host)
            self.assertEqual(page.runJavaScript.call_count, 2)
            self.assertIn('"active":4', page.runJavaScript.call_args.args[0])
        with patch('keybard_host.__main__.time.monotonic', return_value=10.3):
            Host.publish_state(host)
            self.assertIn('keybard-host-heartbeat', page.runJavaScript.call_args.args[0])

    def test_resize_handle_scales_from_the_drag_and_saves_on_release(self):
        calls = []
        self.controls.close()
        self.controls = OverlayControls(self.surface, lambda: None, lambda: None, lambda value: None, lambda: 100, lambda scale, final: calls.append((scale, final)))
        self.surface.setFixedSize(1000, 300)
        handle = self.controls.resizer
        press = lambda kind, x, y, button, buttons: QMouseEvent(kind, QPointF(4,4), QPointF(x,y), button, buttons, Qt.NoModifier)
        handle.mousePressEvent(press(QMouseEvent.MouseButtonPress, 500, 500, Qt.LeftButton, Qt.LeftButton))
        # 200 px right on a 1000 px overlay: 20% bigger.
        handle.mouseMoveEvent(press(QMouseEvent.MouseMove, 700, 500, Qt.NoButton, Qt.LeftButton))
        # Up grows it too: 150 px on a 300 px overlay, capped at the largest size.
        handle.mouseMoveEvent(press(QMouseEvent.MouseMove, 500, 350, Qt.NoButton, Qt.LeftButton))
        # Down and left shrinks it, no smaller than the smallest size.
        handle.mouseMoveEvent(press(QMouseEvent.MouseMove, 0, 500, Qt.NoButton, Qt.LeftButton))
        handle.mouseReleaseEvent(press(QMouseEvent.MouseButtonRelease, 0, 500, Qt.LeftButton, Qt.NoButton))
        self.assertEqual(calls, [(120, False), (150, False), (50, False), (50, True)])
        self.assertIsNone(handle.start)
