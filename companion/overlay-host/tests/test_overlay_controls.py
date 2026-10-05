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

    def test_drag_is_default_and_handle_stays_interactive_in_click_through(self):
        self.assertTrue(self.surface.arranging)
        self.surface.set_arrange(False)
        self.assertTrue(self.surface.windowFlags() & Qt.WindowTransparentForInput)
        self.assertFalse(self.controls.windowFlags() & Qt.WindowTransparentForInput)
        self.assertFalse(self.controls.handle.testAttribute(Qt.WA_TransparentForMouseEvents))
        self.surface.set_arrange(True)
        self.assertFalse(self.surface.windowFlags() & Qt.WindowTransparentForInput)

    def test_control_menu_has_working_hide_open_and_click_through(self):
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
