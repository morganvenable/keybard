"""Key legends: Automatic. Which keyboard layout the computer uses, read with mocked system calls."""
import unittest
from unittest import mock

from keybard_host import keyboard_layout as kl
from keybard_host.keyboard_layout import LayoutReader, klid_for_hkl, xkb_reading


class FakeUser32:
    """GetForegroundWindow / GetWindowThreadProcessId / GetKeyboardLayout for one window and its thread."""
    def __init__(self, hkl, window=0x1234, thread=77):
        self.hkl, self.window, self.thread, self.asked = hkl, window, thread, []

    def GetForegroundWindow(self): return self.window

    def GetWindowThreadProcessId(self, window, _):
        self.asked.append(window)
        return self.thread

    def GetKeyboardLayout(self, thread): return self.hkl if thread == self.thread else 0x04090409


# The registry as on Windows: layout variants by "Layout Id", and names.
NAMES = {'00000409': 'US', '00020409': 'United States-International', '00010409': 'United States-Dvorak',
         '00000407': 'German', '0000040C': 'French', '00000809': 'United Kingdom', '00000411': 'Japanese',
         '00000807': 'Swiss German'}
REGISTRY = dict(ids=lambda: {'0001': '00020409', '0002': '00010409'}, name=lambda klid: NAMES.get(klid))


def windows(hkl):
    source = kl._WindowsSource.__new__(kl._WindowsSource)
    source.user, source.registry, source.names = FakeUser32(hkl), REGISTRY, {}
    return LayoutReader(source=source)


class WindowsReaderTests(unittest.TestCase):
    def test_language_and_keyboard_ids(self):
        cases = {
            0x04070407: ('german', '00000407'), 0x04090409: ('us', '00000409'),
            0xF0010409: ('us_intl', '00020409'),        # US-International: a layout variant, found by its Layout Id
            0x040C040C: ('french', '0000040C'), 0x08090809: ('uk', '00000809'),
            0x08070807: ('swiss', '00000807'),
            0x04070409: ('german', '00000407'),    # English (US) language with the German keyboard
            0x04090407: ('us', '00000409'),        # German language with the US keyboard
        }
        for hkl, (layout, klid) in cases.items():
            with self.subTest(hex(hkl)):
                reading = windows(hkl).read()
                self.assertEqual((reading['layoutId'], reading['id']), (layout, klid))
                self.assertTrue(reading['available'])

    def test_unknown_layouts_name_themselves_and_have_no_legends(self):
        japanese = windows(0x04110411).read()
        self.assertEqual(japanese, {'available': True, 'layoutId': None, 'name': 'Japanese', 'id': '00000411'})
        dvorak = windows(0xF0020409).read()
        self.assertEqual((dvorak['layoutId'], dvorak['id'], dvorak['name']), (None, '00010409', 'United States-Dvorak'))
        # An IME, and a variant missing from the registry, match no layout (never a guess at US).
        self.assertIsNone(windows(0xE0010411).read()['layoutId'])
        self.assertIsNone(windows(0xF0090409).read()['layoutId'])

    def test_reads_the_window_in_front(self):
        reader = windows(0x04070407)
        reader.read()
        self.assertEqual(reader.source.user.asked, [0x1234])

    def test_nothing_in_front_keeps_the_last_reading(self):
        reader = windows(0x04070407)
        reader.source.user.window = 0
        self.assertIsNone(reader.read())

    def test_names_are_looked_up_once_per_layout(self):
        calls = []
        reader = windows(0x04070407)
        reader.source.registry = dict(ids=lambda: {}, name=lambda klid: calls.append(klid) or 'German')
        for _ in range(5): reader.read()
        self.assertEqual(calls, ['00000407'])

    def test_klid_for_hkl(self):
        self.assertEqual(klid_for_hkl(0x04070407), '00000407')
        self.assertEqual(klid_for_hkl(-0x0FFEFBF7), 'F0010409')  # a signed handle; the variant isn't in the registry
        self.assertEqual(klid_for_hkl(0xF0010409, {'0001': '00020409'}), '00020409')


class OtherSystemsTests(unittest.TestCase):
    def test_macos_and_wayland_are_unavailable(self):
        for platform, env in (('darwin', {}), ('linux', {'WAYLAND_DISPLAY': 'wayland-0', 'DISPLAY': ':0'}), ('linux', {})):
            with self.subTest(platform=platform, env=env):
                self.assertEqual(LayoutReader(platform=platform, environ=env).read(), kl.UNAVAILABLE)

    def test_x11_reads_the_active_group(self):
        query = 'rules:      evdev\nmodel:      pc105\nlayout:     us,de,jp\nvariant:    ,nodeadkeys,\n'
        self.assertEqual(xkb_reading(query, 0)['layoutId'], 'us')
        self.assertEqual(xkb_reading(query, 1), {'available': True, 'layoutId': 'german', 'name': 'de(nodeadkeys)', 'id': 'de(nodeadkeys)'})
        self.assertIsNone(xkb_reading(query, 2)['layoutId'])
        self.assertIsNone(xkb_reading('layout: us\nvariant: dvorak\n', 0)['layoutId'])
        self.assertEqual(xkb_reading('layout: gb\n', 0)['layoutId'], 'uk')
        self.assertFalse(xkb_reading('', 0)['available'])
        self.assertFalse(xkb_reading('layout: us\n', 3)['available'])

    def test_x11_asks_setxkbmap_only_when_the_group_changes(self):
        source = kl._X11Source.__new__(kl._X11Source)
        groups = iter([0, 0, 0, 1])

        class State:
            group = 0

        def get_state(display, device, ref):
            ref.obj.group = next(groups)
            return 0
        source.State = State
        source.x11 = mock.Mock(XkbGetState=get_state)
        source.display = 1
        runs = []
        source.run = lambda: runs.append(1) or 'layout: us,de\nvariant: ,\n'
        source.names = lambda: None  # no _XKB_RULES_NAMES: setxkbmap
        source.group = source.query = source.reading = source.rules_names = None
        with mock.patch.object(kl.ctypes, 'byref', lambda obj: mock.Mock(obj=obj)):
            reader = LayoutReader(source=source)
            self.assertEqual([reader.read()['layoutId'] for _ in range(4)], ['us', 'us', 'us', 'german'])
        self.assertEqual(len(runs), 2)

    def test_x11_reads_a_new_layout_list_in_the_same_group(self):
        # us,de becomes us,fr while group 1 stays active: _XKB_RULES_NAMES changes, so it is read again.
        source = kl._X11Source.__new__(kl._X11Source)

        class State:
            group = 1
        source.State = State
        source.x11 = mock.Mock(XkbGetState=lambda display, device, ref: 0)
        source.display = 1
        source.run = mock.Mock(side_effect=AssertionError('setxkbmap is not needed'))
        names = iter([b'evdev\0pc105\0us,de\0,\0', b'evdev\0pc105\0us,de\0,\0', b'evdev\0pc105\0us,fr\0,\0'])
        source.names = lambda: next(names)
        source.group = source.query = source.reading = source.rules_names = None
        with mock.patch.object(kl.ctypes, 'byref', lambda obj: mock.Mock(obj=obj)):
            reader = LayoutReader(source=source)
            self.assertEqual([reader.read()['layoutId'] for _ in range(3)], ['german', 'german', 'french'])

    def test_x11_us_intl_is_named_but_not_mapped(self):
        # xkb's us(intl) differs from Windows' US-International at AltGr, so Keybard has no legends for it.
        reading = xkb_reading(kl.query_from_rules_names(b'evdev\0pc105\0us\0intl\0'), 0)
        self.assertEqual(reading, {'available': True, 'layoutId': None, 'name': 'English (US, intl., with dead keys)', 'id': 'us(intl)'})
        # An empty variant (as an X server writes it) is no variant.
        self.assertEqual(xkb_reading(kl.query_from_rules_names(b'evdev\0pc105\0us\0\0\0'), 0)['layoutId'], 'us')

    def test_a_failing_read_keeps_the_last(self):
        source = mock.Mock(read=mock.Mock(side_effect=OSError))
        self.assertIsNone(LayoutReader(source=source).read())


if __name__ == '__main__':
    unittest.main()
