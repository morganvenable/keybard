"""The Reload button beside collapse, and what keeps the overlay from vanishing for good."""
import os
import unittest
from types import SimpleNamespace
from unittest import mock
os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
try:
    from PySide6.QtCore import QPoint, QRect
    from PySide6.QtWidgets import QApplication
    from PySide6.QtWebEngineCore import QWebEnginePage
    from keybard_host.__main__ import Surface, OverlayControls, Host, LocalPage
    AVAILABLE = True
except ImportError:
    AVAILABLE = False
from keybard_host import log as log_module


@unittest.skipUnless(AVAILABLE, 'Requires the native Qt WebEngine runtime')
class ReloadButtonTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def setUp(self):
        self.surface = Surface(5178)
        self.reloads = []
        self.controls = OverlayControls(self.surface, lambda: None, reload=lambda: self.reloads.append(1))

    def tearDown(self):
        self.controls.close(); self.surface.close()
        self.controls.deleteLater(); self.surface.deleteLater()
        self.app.processEvents()

    def buttons(self):
        c = self.controls
        return [c.handle, c.resizer, c.refresher, c.collapser, c.more]

    def test_sits_beside_collapse_and_reloads_like_the_menu(self):
        layout = self.controls.layout()
        order = [layout.itemAt(i).widget() for i in range(layout.count())]
        self.assertEqual(order, self.buttons())
        button = self.controls.refresher
        self.assertEqual(button.toolTip(), 'Reload')
        self.assertEqual(button.accessibleName(), 'Reload board layout')
        self.assertFalse(button.icon().isNull())
        button.click()
        menu = next(a for a in self.controls.more.menu().actions() if a.text() == 'Reload board layout')
        menu.trigger()
        self.assertEqual(self.reloads, [1, 1])

    def test_matches_the_other_buttons(self):
        for button in self.buttons():
            self.assertEqual((button.width(), button.height()), (24, 24))
        self.assertEqual(self.controls.refresher.iconSize(), self.controls.collapser.iconSize())
        # One style sheet on the controls window styles every button, hover included.
        self.assertIn('QToolButton:hover', self.controls.styleSheet())
        self.assertEqual(self.controls.refresher.styleSheet(), '')

    def test_works_while_collapsed(self):
        self.surface.show(); self.controls.show()
        self.controls.set_collapsed(True)
        self.assertTrue(self.controls.refresher.isEnabled())
        self.controls.refresher.click()
        self.assertEqual(self.reloads, [1])

    def test_never_clipped_however_small_the_overlay(self):
        self.surface.show(); self.controls.show(); self.app.processEvents()
        inside = QRect(QPoint(0, 0), self.controls.size())
        for button in self.buttons():
            self.assertTrue(inside.contains(button.geometry()), button.accessibleName())
        # The smallest overlay, against the screen's left edge: the controls stay whole on screen.
        area = self.surface.screen().availableGeometry()
        self.surface.setFixedSize(100, 80); self.surface.move(area.left(), area.top() + 200); self.app.processEvents()
        self.controls.reposition(); self.app.processEvents()
        self.assertGreater(self.controls.width(), self.surface.width())
        self.assertTrue(area.contains(self.controls.geometry()))


@unittest.skipUnless(AVAILABLE, 'Requires the native Qt WebEngine runtime')
class RecoveryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def test_a_crashed_renderer_is_loaded_again_and_logged(self):
        surface = Surface(5178)
        try:
            Status = QWebEnginePage.RenderProcessTerminationStatus
            with mock.patch('keybard_host.__main__.log') as log, mock.patch('keybard_host.__main__.QTimer.singleShot') as later:
                surface.renderer_gone(Status.CrashedTerminationStatus, 3)
                self.assertIn('overlay renderer ended (CrashedTerminationStatus, exit code 3)', log.call_args[0][0])
                self.assertEqual(later.call_args[0], (0, surface.reload))
                # Quitting ends it normally: nothing to do.
                later.reset_mock(); log.reset_mock()
                surface.renderer_gone(Status.NormalTerminationStatus, 0)
                later.assert_not_called(); log.assert_not_called()
                # Dying again and again: wait before the next try.
                for _ in range(3): surface.renderer_gone(Status.KilledTerminationStatus, 1)
                self.assertEqual(later.call_args[0][0], 30000)
        finally:
            surface.close(); surface.deleteLater()

    def test_page_errors_are_logged_once(self):
        Level = QWebEnginePage.JavaScriptConsoleMessageLevel
        page = LocalPage()
        source = 'http://127.0.0.1:5178/assets/x.js'
        with mock.patch('keybard_host.__main__.log') as log:
            page.javaScriptConsoleMessage(Level.InfoMessageLevel, 'hello', 1, source)
            page.javaScriptConsoleMessage(Level.WarningMessageLevel, 'no update for 5000 ms', 9, source)
            page.javaScriptConsoleMessage(Level.WarningMessageLevel, 'no update for 5000 ms', 9, source)
            page.javaScriptConsoleMessage(Level.ErrorMessageLevel, 'boom', 2, source)
        self.assertEqual([c[0][0] for c in log.call_args_list], [
            'overlay page warning: no update for 5000 ms (/assets/x.js:9)', 'overlay page error: boom (/assets/x.js:2)'])
        page.deleteLater()


@unittest.skipUnless(AVAILABLE, 'Requires the native Qt WebEngine runtime')
class ResendTest(unittest.TestCase):
    def test_reload_sends_the_whole_layout_again(self):
        host = SimpleNamespace(boards={}, follow=lambda: None, publish_state=lambda: None, published_layout=7)
        Host.command(host, dict(op='reload'))
        self.assertEqual(host.published_layout, -1)

    def test_a_held_up_host_sends_the_whole_layout_again(self):
        host = SimpleNamespace(STALL=Host.STALL, published_layout=7)
        with mock.patch('keybard_host.__main__.log') as log:
            self.assertFalse(Host.note_stall(host, 100.0))
            self.assertFalse(Host.note_stall(host, 100.1))
            self.assertEqual(host.published_layout, 7)
            self.assertTrue(Host.note_stall(host, 104.0))
        self.assertEqual(host.published_layout, -1)
        self.assertIn('held up 3.9 s', log.call_args[0][0])


class LogFileTest(unittest.TestCase):
    def test_lines_go_to_the_file_and_it_stays_small(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'overlay.log'
            log_module.set_file(path)
            try:
                with mock.patch.object(log_module, 'LIMIT', 100), mock.patch('sys.stderr'):
                    for i in range(20): log_module.log(f'line {i}')
            finally:
                log_module.set_file(None)
            self.assertTrue(path.with_name('overlay.log.1').exists())
            self.assertIn('line 19', path.read_text(encoding='utf-8'))
            self.assertLess(path.stat().st_size, 200)


if __name__ == '__main__':
    unittest.main()
