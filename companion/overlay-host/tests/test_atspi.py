"""Linux website rules through AT-SPI (keybard_host/atspi.py), on a fake accessibility bus shaped
like Firefox's and Chrome's trees: the walk to the address bar, KEEP while it has the keyboard, no
address bar, no bus, the kept node and finding it again; turning accessibility on and off; the
Linux window sources' titles; and what the panel and the log are told."""
import contextlib
import io
import tempfile
import types
import unittest
from pathlib import Path

from keybard_host import atspi, foreground
from keybard_host.address_bar import KEEP, is_browser
from keybard_host.atspi import (ACCESSIBLE, ROLE_COMBO_BOX, ROLE_DOCUMENT_WEB, ROLE_ENTRY, STATE_ACTIVE, STATE_DEFUNCT,
                                STATE_FOCUSED, Accessibility, AtspiAddressBar, BusError, address_bar_score, has_state,
                                title_hash)
from keybard_host.site_rules import PENDING, SiteWatcher

ROLE_FRAME, ROLE_PANEL, ROLE_TOOL_BAR, ROLE_PUSH_BUTTON, ROLE_APPLICATION = 23, 39, 62, 43, 75


def bits(*states):
    words = [0, 0]
    for s in states: words[s // 32] |= 1 << (s % 32)
    return words


class Node:
    def __init__(self, role, name='', states=(), attrs=None, text=None, children=()):
        self.role, self.name, self.states, self.attrs, self.text = role, name, set(states), attrs or {}, text
        self.children = list(children)


class FakeBus:
    """An accessibility bus: apps under the registry root, each a tree of Nodes. Counts calls."""
    unique_name = ':1.99'

    def __init__(self, apps):
        self.nodes, self.calls, self.closed, self.hang, self.visited = {}, [], False, set(), set()
        root = Node(ROLE_APPLICATION)
        self.nodes[(atspi.REGISTRY, atspi.ROOT)] = root
        root.refs = [self._add(bus_name, app, atspi.ROOT) for bus_name, app in apps]

    def _add(self, bus_name, node, path):
        if node is None: return (bus_name, atspi.NULL)
        ref = (bus_name, path)
        self.nodes[ref] = node
        node.refs = [self._add(bus_name, c, f'{path}/{i}') for i, c in enumerate(node.children)]
        return ref

    def node(self, dest, path):
        if (dest, path) in self.hang: raise BusError('timed out')
        try: return self.nodes[(dest, path)]
        except KeyError: raise BusError('org.freedesktop.DBus.Error.UnknownObject') from None

    def call(self, dest, path, interface, method, signature=None, body=()):
        self.calls.append(method); self.visited.add((dest, path))
        n = self.node(dest, path)
        if method == 'GetChildren': return ([r for r in getattr(n, 'refs', [])],)
        if method == 'GetChildAtIndex':
            ref = n.refs[body[0]]
            return (getattr(n, 'made', {}).get(body[0], ref),)
        if method == 'GetRole': return (n.role,)
        if method == 'GetState': return (bits(*n.states),)
        if method == 'GetAttributes':
            n.woken = True
            return (dict(n.attrs),)
        if method == 'GetText':
            start, end = body
            return ((n.text or '')[start:end],)
        raise BusError(f'no method {method}')

    def get(self, dest, path, interface, name):
        n = self.node(dest, path)
        if interface == ACCESSIBLE and name == 'Name': return n.name
        if interface == atspi.TEXT and name == 'CharacterCount':
            if n.text is None: raise BusError('no Text interface')
            return len(n.text)
        raise BusError(f'no property {name}')

    def close(self): self.closed = True


def firefox(address='https://cad.onshape.com/documents/1', title='Part Studio — Mozilla Firefox', active=True, focused=False,
            page_entry=True):
    """Firefox's shape: frame > panels > toolbar > combo box (urlbar) > entry id=urlbar-input; the
    page is a document web with entries of its own, which must never be picked."""
    urlbar = Node(ROLE_ENTRY, 'Search or enter address', states=[STATE_FOCUSED] if focused else [],
                  attrs={'id': 'urlbar-input', 'tag': 'input'}, text=address)
    search = Node(ROLE_ENTRY, 'Search', attrs={'id': 'searchbar'}, text='')
    page = Node(ROLE_DOCUMENT_WEB, 'Page', children=[Node(ROLE_ENTRY, 'login', text='https://evil.example/')] if page_entry else [])
    frame = Node(ROLE_FRAME, title, states=[STATE_ACTIVE] if active else [], children=[
        Node(ROLE_PANEL, children=[page]),  # the page comes first in the tree: skipped, never searched
        Node(ROLE_PANEL, children=[Node(ROLE_TOOL_BAR, 'Navigation', children=[
            Node(ROLE_PUSH_BUTTON, 'Back'), Node(ROLE_COMBO_BOX, attrs={'id': 'urlbar'}, children=[urlbar]), search])]),
    ])
    return Node(ROLE_APPLICATION, 'Firefox', children=[frame])


def chrome(address='mail.google.com/mail/u/0/', title='Inbox - Gmail - Google Chrome', active=True, focused=False, null_child=False):
    """Chromium's shape: frame > views > toolbar > entry of class OmniboxViewViews (it shows no scheme)."""
    omnibox = Node(ROLE_ENTRY, 'Address and search bar', states=[STATE_FOCUSED] if focused else [],
                   attrs={'class': 'OmniboxViewViews', 'toolkit': 'Chromium'}, text=address)
    toolbar = Node(ROLE_TOOL_BAR, children=[Node(ROLE_PUSH_BUTTON, 'Reload'), omnibox])
    frame = Node(ROLE_FRAME, title, states=[STATE_ACTIVE] if active else [], children=[
        Node(ROLE_PANEL, children=[None if null_child else toolbar, Node(ROLE_DOCUMENT_WEB, 'Gmail')])])
    app = Node(ROLE_APPLICATION, 'Google Chrome', children=[frame])
    app.frame, app.toolbar = frame, toolbar
    return app


def reader_for(bus):
    return AtspiAddressBar(connect=lambda: bus, sleep=lambda s: None)


class ShapeTests(unittest.TestCase):
    def test_state_bits(self):
        self.assertTrue(has_state(bits(STATE_ACTIVE), STATE_ACTIVE))
        self.assertFalse(has_state(bits(), STATE_ACTIVE))
        self.assertTrue(has_state([0, 1 << 1], 33))
        self.assertFalse(has_state([], STATE_FOCUSED))

    def test_address_bars_by_id_and_class(self):
        self.assertEqual(address_bar_score(ROLE_COMBO_BOX, {'id': 'urlbar-input'}), 2)
        self.assertEqual(address_bar_score(ROLE_ENTRY, {'class': 'OmniboxViewViews'}), 2)
        self.assertEqual(address_bar_score(ROLE_ENTRY, {'id': 'searchbar'}), 1)
        self.assertEqual(address_bar_score(ROLE_COMBO_BOX, {}), 0)


class ReaderTests(unittest.TestCase):
    def test_firefox_by_its_title(self):
        bus = FakeBus([(':1.5', firefox(active=False))])
        bar = reader_for(bus)
        self.assertEqual(bar.host(0x3a00007, 'firefox', title_hash('Part Studio — Mozilla Firefox')), 'cad.onshape.com')
        self.assertIsNone(bar.problem)

    def test_the_page_is_never_searched(self):
        bus = FakeBus([(':1.5', firefox())])
        self.assertEqual(reader_for(bus).host(1, 'firefox', title_hash('x')), 'cad.onshape.com')
        inside = [ref for ref, n in bus.nodes.items() if n.name == 'login']
        self.assertTrue(inside)
        self.assertFalse(bus.visited & set(inside), 'nothing inside the web page is looked at')

    def test_chrome_by_the_active_frame_and_woken(self):
        app = chrome()
        bus = FakeBus([(':1.7', Node(ROLE_APPLICATION, 'Electron app', children=[Node(ROLE_FRAME, 'Other')])), (':1.8', app)])
        bar = reader_for(bus)
        self.assertEqual(bar.host(5, 'google-chrome', title_hash('a title the frame does not have')), 'mail.google.com')
        self.assertTrue(getattr(app, 'woken', False), "Chromium's tree is woken by asking its app for attributes")
        self.assertFalse(getattr(bus.nodes[(':1.7', '/org/a11y/atspi/accessible/root')], 'woken', False), 'never another app')

    def test_chrome_null_children_are_asked_for_by_index(self):
        app = chrome(null_child=True)
        bus = FakeBus([(':1.8', app)])
        panel = app.frame.children[0]
        panel.made = {0: bus._add(':1.8', app.toolbar, '/made/toolbar')}
        self.assertEqual(reader_for(bus).host(5, 'chromium', title_hash('Inbox - Gmail - Google Chrome')), 'mail.google.com')

    def test_focus_in_the_address_bar_is_keep(self):
        bus = FakeBus([(':1.5', firefox(focused=True))])
        self.assertEqual(reader_for(bus).host(1, 'firefox', title_hash('Part Studio — Mozilla Firefox')), KEEP)
        self.assertEqual(KEEP, 'keep')

    def test_no_address_bar_is_no_host(self):
        bus = FakeBus([(':1.5', Node(ROLE_APPLICATION, 'gedit', children=[Node(ROLE_FRAME, 'notes.txt', states=[STATE_ACTIVE])]))])
        bar = reader_for(bus)
        self.assertIsNone(bar.host(1, 'firefox', title_hash('notes.txt')))
        self.assertEqual(bar.problem, 'not-found')

    def test_no_window_in_front_reads_nothing(self):
        bus = FakeBus([(':1.5', firefox())])
        self.assertIsNone(reader_for(bus).host(0, 'firefox', None))
        self.assertEqual(bus.calls, [])

    def test_atspi_missing_is_no_host(self):
        def missing(): raise BusError('no accessibility bus')
        bar = AtspiAddressBar(connect=missing)
        self.assertIsNone(bar.host(1, 'firefox', title_hash('x')))
        self.assertEqual(bar.problem, 'no-bus')

    def test_search_text_and_browser_pages_are_no_host(self):
        for text in ('svalboard layers', 'about:preferences', 'chrome://settings'):
            bus = FakeBus([(':1.5', firefox(address=text))])
            self.assertIsNone(reader_for(bus).host(1, 'firefox', None), text)

    def test_the_node_is_kept_and_found_again_when_it_goes(self):
        app = firefox()
        bus = FakeBus([(':1.5', app)])
        bar = reader_for(bus)
        bar.host(1, 'firefox', None)
        bus.calls.clear()
        self.assertEqual(bar.host(1, 'firefox', None), 'cad.onshape.com')
        self.assertNotIn('GetChildren', bus.calls, 'the kept node is read without a walk')
        # The browser rebuilds its toolbar: the old entry is defunct, a new one is in the tree.
        urlbar = next(n for n in bus.nodes.values() if n.attrs.get('id') == 'urlbar-input')
        urlbar.states.add(STATE_DEFUNCT)
        fresh = Node(ROLE_ENTRY, attrs={'id': 'urlbar-input'}, text='https://docs.svalboard.com/')
        toolbar = next(n for n in bus.nodes.values() if n.role == ROLE_TOOL_BAR)
        toolbar.refs = [bus._add(':1.5', fresh, '/new/urlbar')]
        self.assertEqual(bar.host(1, 'firefox', None), 'docs.svalboard.com')

    def test_a_hung_browser_is_no_host_never_an_error(self):
        bus = FakeBus([(':1.5', firefox())])
        bus.hang.add((':1.5', '/org/a11y/atspi/accessible/root'))
        self.assertIsNone(reader_for(bus).host(1, 'firefox', None))

    def test_a_bus_that_went_away_is_connected_again(self):
        buses = [FakeBus([]), FakeBus([(':1.5', firefox())])]
        bar = AtspiAddressBar(connect=lambda: buses.pop(0), sleep=lambda s: None)
        self.assertIsNone(bar.host(1, 'firefox', None))
        self.assertEqual(bar.problem, 'no-bus')
        self.assertEqual(bar.host(1, 'firefox', None), 'cad.onshape.com')

    def test_only_the_host_leaves_the_reader(self):
        bus = FakeBus([(':1.5', firefox(address='https://user:secret@cad.onshape.com:8443/documents/private?token=1'))])
        self.assertEqual(reader_for(bus).host(1, 'firefox', None), 'cad.onshape.com')


class StatusTests(unittest.TestCase):
    def test_ready_or_off_with_the_reason(self):
        ok = types.SimpleNamespace(close=lambda: None)
        has = unittest.mock.patch.object(atspi, '_jeepney', return_value=object())
        with has:
            self.assertEqual(atspi.status(True, connect=lambda: ok), ('ready', None))
            def missing(): raise BusError('none')
            self.assertEqual(atspi.status(True, connect=missing)[0], 'off')
            self.assertIn('at-spi2-core', atspi.status(True, connect=missing)[1])
            self.assertEqual(atspi.status(False, connect=lambda: ok)[0], 'off')  # GNOME on Wayland
        with unittest.mock.patch.object(atspi, '_jeepney', return_value=None):
            self.assertIn('jeepney', atspi.status(True, connect=lambda: ok)[1])

    def test_the_bus_address(self):
        self.assertEqual(atspi.atspi_address(environ={'AT_SPI_BUS_ADDRESS': 'unix:path=/x'}), 'unix:path=/x')
        session = types.SimpleNamespace(call=lambda *a: ('unix:abstract=/tmp/dbus-1',))
        self.assertEqual(atspi.atspi_address(session=session, environ={}), 'unix:abstract=/tmp/dbus-1')
        with self.assertRaises(BusError): atspi.atspi_address(session=types.SimpleNamespace(call=lambda *a: ('',)), environ={})

    def test_jeepney_missing_is_a_bus_error(self):
        with unittest.mock.patch.object(atspi, '_jeepney', return_value=None), self.assertRaises(BusError):
            atspi.JeepneyBus('unix:path=/nowhere')


class FakeSession:
    """The session bus's org.a11y.Status, IsEnabled only."""
    def __init__(self, enabled=False, there=True):
        self.enabled, self.there, self.sets = enabled, there, []

    def __call__(self):
        if not self.there: raise BusError('no session bus')
        return self

    def get(self, dest, path, interface, name):
        assert (interface, name) == ('org.a11y.Status', 'IsEnabled')
        return self.enabled

    def set(self, dest, path, interface, name, signature, value):
        assert (interface, name, signature) == ('org.a11y.Status', 'IsEnabled', 'b'), 'never ScreenReaderEnabled'
        self.sets.append(value); self.enabled = value

    def close(self): pass


class AccessibilityTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory(); self.addCleanup(self.dir.cleanup)
        self.marker = Path(self.dir.name) / 'keybard-overlay' / 'accessibility-turned-on'

    def test_on_while_wanted_then_off(self):
        session = FakeSession()
        a = Accessibility(session=session, marker=self.marker)
        self.assertTrue(a.want(True))
        self.assertTrue(session.enabled); self.assertTrue(self.marker.exists())
        self.assertFalse(a.want(True)); self.assertEqual(session.sets, [True])
        a.want(False)
        self.assertFalse(session.enabled); self.assertFalse(self.marker.exists())

    def test_already_on_is_left_alone(self):
        session = FakeSession(enabled=True)
        a = Accessibility(session=session, marker=self.marker)
        self.assertFalse(a.want(True)); a.want(False)
        self.assertEqual(session.sets, []); self.assertTrue(session.enabled)

    def test_a_crash_is_put_right_at_the_next_start(self):
        session = FakeSession()
        Accessibility(session=session, marker=self.marker).want(True)   # then killed: never turned off
        self.assertTrue(session.enabled)
        Accessibility(session=session, marker=self.marker)
        self.assertFalse(session.enabled); self.assertFalse(self.marker.exists())

    def test_no_session_bus_does_nothing(self):
        a = Accessibility(session=FakeSession(there=False), marker=self.marker)
        self.assertFalse(a.want(True)); a.want(False)
        self.assertFalse(self.marker.exists())

    def test_the_marker_is_keybard_overlays(self):
        self.assertEqual(atspi.marker_path({'XDG_STATE_HOME': '/s'}), Path('/s/keybard-overlay/accessibility-turned-on'))
        self.assertEqual(atspi.marker_path({'HOME': '/h'}), Path('/h/.local/state/keybard-overlay/accessibility-turned-on'))
        self.assertIsNone(atspi.marker_path({}))


class LinuxWatcherTests(unittest.TestCase):
    def test_linux_browsers_only_on_linux(self):
        for key in ('firefox', 'google-chrome', 'chromium', 'brave-browser', 'microsoft-edge', 'org.mozilla.firefox'):
            self.assertTrue(is_browser(key, 'linux'), key)
            self.assertFalse(is_browser(key, 'darwin'), key)
        self.assertFalse(is_browser('org.gnome.nautilus', 'linux'))
        self.assertTrue(is_browser('chrome.exe', 'win32'))

    def test_a_linux_browser_is_read_with_the_titles_hash(self):
        jobs = []
        reader = types.SimpleNamespace(request=lambda *job: jobs.append(job) or True, forget=lambda w: None, close=lambda: None)
        watcher = SiteWatcher(lambda done: reader, platform='linux')
        self.assertIs(watcher.host_for(0x3a00007, 'firefox', 'Secret — Mozilla Firefox'), PENDING)
        self.assertEqual(jobs[0][1:], (0x3a00007, 'firefox', title_hash('Secret — Mozilla Firefox')))
        self.assertNotIn('Secret', repr(jobs))

    def test_wanted_is_told_on_changes_and_at_close(self):
        heard = []
        reader = types.SimpleNamespace(request=lambda *a: True, forget=lambda w: None, close=lambda: None)
        watcher = SiteWatcher(lambda done: reader, wanted_hook=heard.append, platform='linux')
        watcher.set_wanted(True); watcher.set_wanted(True); watcher.set_wanted(False); watcher.set_wanted(True)
        watcher.close()
        self.assertEqual(heard, [True, False, True, False])


class LinuxWindowTests(unittest.TestCase):
    def test_sway_hyprland_and_kde_give_the_window_and_its_title(self):
        import json
        tree = {'id': 1, 'nodes': [{'id': 4, 'pid': 10, 'app_id': 'foot', 'name': 'term', 'focused': False},
                                   {'id': 7, 'pid': 11, 'app_id': None, 'window_properties': {'class': 'Google-chrome'},
                                    'name': 'Page - Google Chrome', 'focused': True}]}
        self.assertEqual(foreground._Sway(run=lambda c: json.dumps(tree)).foreground_window(),
                         (7, ('Google-chrome', 'Google-chrome'), 'Page - Google Chrome'))
        active = {'address': '0x55d0a1b2c3d0', 'class': 'firefox', 'initialTitle': 'Mozilla Firefox', 'title': 'Page — Mozilla Firefox'}
        self.assertEqual(foreground._Hyprland(run=lambda c: json.dumps(active)).foreground_window(),
                         (0x55d0a1b2c3d0, ('firefox', 'Mozilla Firefox'), 'Page — Mozilla Firefox'))
        self.assertEqual(foreground._Hyprland(run=lambda c: '{}').foreground_window(), (None, None, None))
        kde = foreground._Kde(run=lambda c: 'firefox\nPage — Mozilla Firefox\n')
        window, app, title = kde.foreground_window()
        self.assertEqual((app, title), (('firefox', 'firefox'), 'Page — Mozilla Firefox'))
        self.assertEqual(window, foreground.program_window('firefox'))
        self.assertNotEqual(window, 0)
        self.assertEqual(foreground._Kde(run=lambda c: '').foreground_window(), (None, None, None))

    def test_the_panel_is_told_whether_websites_work(self):
        src = types.SimpleNamespace(foreground=lambda: None, running=lambda: [])
        self.assertEqual(foreground.apps_snapshot(src, 'linux', sites=lambda s: ('ready', None))['sites'], 'ready')
        self.assertEqual(foreground.apps_snapshot(src, 'linux', sites=lambda s: ('off', 'why'))['sites'], 'off')
        self.assertNotIn('sites', foreground.apps_snapshot(src, 'win32', sites=lambda s: ('ready', None)))

    def test_gnome_on_wayland_is_off(self):
        seen = []
        state = foreground.linux_sites(foreground._Nothing(), check=lambda knows: seen.append(knows) or ('off', 'x'), clock=lambda: 1e9)
        self.assertEqual(state[0], 'off'); self.assertEqual(seen, [False])


class LinuxLogTests(unittest.TestCase):
    def test_the_log_says_why_no_address_was_read(self):
        from keybard_host import __main__ as host_main
        from keybard_host.foreground import app_id
        onshape = app_id('site:onshape.com')
        worker = types.SimpleNamespace(app_rules=True, sites=[('onshape.com', onshape)], sent=[])
        worker.set_foreground = worker.sent.append
        watcher = types.SimpleNamespace(host_for=lambda *a: None, set_wanted=lambda on: None, problem=lambda: 'not-found')
        host = types.SimpleNamespace(boards={'a': types.SimpleNamespace(worker=worker)}, site_watcher=watcher,
                                     foreground_id=None, log_app_rules=True, logged_app=None)
        out = io.StringIO()
        with unittest.mock.patch.object(host_main, 'foreground_window', lambda: (7, ('Google-chrome', 'Google-chrome'), 'Secret')), \
                unittest.mock.patch.object(host_main.sys, 'platform', 'linux'), \
                unittest.mock.patch.object(host_main, 'is_browser', lambda key: True), contextlib.redirect_stdout(out):
            host_main.Host.poll_foreground(host)
        self.assertIn('no address read (no address bar on the accessibility bus', out.getvalue())
        self.assertIn('restart', out.getvalue())
        self.assertNotIn('Secret', out.getvalue())
        self.assertEqual(worker.sent, [app_id('Google-chrome')])

    def test_the_line_when_website_rules_start(self):
        from keybard_host import __main__ as host_main
        with unittest.mock.patch.object(foreground, 'linux_sites', lambda: ('off', 'no AT-SPI accessibility bus')):
            self.assertIn('off on this desktop: no AT-SPI', host_main.linux_sites_line())
        with unittest.mock.patch.object(foreground, 'linux_sites', lambda: ('ready', None)):
            self.assertIn('through AT-SPI', host_main.linux_sites_line())
            self.assertIn('restart Chrome-based browsers', host_main.linux_sites_line(turned_on=True))


class ProbeTests(unittest.TestCase):
    def test_the_probe_prints_the_host_only_and_turns_accessibility_back_off(self):
        lines, session = [], FakeSession()
        src = types.SimpleNamespace(foreground_window=lambda: (7, ('firefox', 'firefox'), 'Secret — Mozilla Firefox'))
        bus = FakeBus([(':1.5', firefox(title='Secret — Mozilla Firefox',
                                         address='https://cad.onshape.com/documents/private'))])
        with unittest.mock.patch.object(foreground, 'source', lambda: src),                 unittest.mock.patch.object(atspi, 'status', lambda knows: ('ready', None)),                 unittest.mock.patch('keybard_host.address_bar.sys.platform', 'linux'):
            code = atspi.probe(wait=0, reads=1, out=lines.append, sleep=lambda s: None, reader=reader_for(bus),
                               access=Accessibility(session=session, marker=False))
        text = ' | '.join(lines)
        self.assertEqual(code, 0)
        self.assertIn('firefox: cad.onshape.com', text)
        self.assertNotIn('Secret', text); self.assertNotIn('private', text)
        self.assertFalse(session.enabled)

    def test_the_probe_says_why_when_atspi_is_off(self):
        lines = []
        with unittest.mock.patch.object(atspi, 'status', lambda knows: ('off', 'no AT-SPI accessibility bus')):
            self.assertEqual(atspi.probe(out=lines.append, sleep=lambda s: None), 1)
        self.assertEqual(lines, ['AT-SPI: off (no AT-SPI accessibility bus)'])


import unittest.mock  # noqa: E402

if __name__ == '__main__':
    unittest.main()
