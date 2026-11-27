"""Site rules on Linux: the host name in the browser's address bar, through AT-SPI (the Linux
accessibility bus that screen readers use), as Windows reads it through UI Automation. No
browser extension is involved. A port of Keybard Overlay's Rust reader (platform/atspi.rs).

* The browser window in front is the AT-SPI frame named as that window is titled, else the frame
  with the ACTIVE state (foreground.py says which window is in front and its title; only the
  title's hash reaches this module).
* Its address bar: Firefox's has the ID `urlbar-input`; Chromium-based browsers' (Chrome,
  Chromium, Brave, Edge) is the entry of class `OmniboxViewViews`, else the first entry outside
  the page. The search walks the window's own controls only, never the web page.
* The found node is kept per window and found again when it fails.

Browsers only build their accessibility tree while accessibility is on. Accessibility turns it on
(`org.a11y.Status.IsEnabled`) only while a board has a website rule, and back off when none has
one or the Host quits. Firefox notices at once; Chromium-based browsers only when they start.

D-Bus is spoken through jeepney (pure Python, MIT). Without it, or without an accessibility bus,
every browser counts as its program.

Privacy: only the host name ("cad.onshape.com") leaves this module, never the address or a title,
and nothing here logs or keeps them.
"""
import hashlib
import os
import time
from collections import OrderedDict
from pathlib import Path

CALL_TIMEOUT = 0.25  # the longest one call to a browser may take: a hung browser can't hold the reader long
KEPT = 32            # windows whose address bar node is kept
SEARCH_NODES = 1200  # the most nodes looked at to find an address bar (Chromium's controls are about 270)
SEARCH_DEPTH = 20

ACCESSIBLE = 'org.a11y.atspi.Accessible'
TEXT = 'org.a11y.atspi.Text'
REGISTRY = 'org.a11y.atspi.Registry'
ROOT = '/org/a11y/atspi/accessible/root'
NULL = '/org/a11y/atspi/null'
PROPERTIES = 'org.freedesktop.DBus.Properties'

# AT-SPI roles (AtspiRole) and states (AtspiStateType).
ROLE_COMBO_BOX, ROLE_MENU, ROLE_MENU_BAR, ROLE_POPUP_MENU = 11, 33, 34, 41
ROLE_ENTRY, ROLE_DOCUMENT_FRAME, ROLE_DOCUMENT_WEB = 79, 82, 95
STATE_ACTIVE, STATE_DEFUNCT, STATE_FOCUSED = 1, 6, 12
SKIPPED = frozenset((ROLE_DOCUMENT_WEB, ROLE_DOCUMENT_FRAME, ROLE_MENU, ROLE_MENU_BAR, ROLE_POPUP_MENU))  # pages, menus

KEEP = 'keep'  # address_bar.KEEP: the address bar has the keyboard


class BusError(Exception):
    """A D-Bus call failed, timed out, or the bus isn't there."""


def title_hash(title):
    """A window title as only its hash, to compare a frame's name with the window in front."""
    return hashlib.blake2s((title or '').encode('utf-8', 'replace'), digest_size=8).digest()


def has_state(states, state):
    word = state // 32
    return word < len(states) and bool(states[word] & (1 << (state % 32)))


def address_bar_score(role, attributes):
    """2 for a sure address bar (Firefox's `urlbar-input`, Chromium's omnibox), 1 for any entry
    (a fallback), 0 for none."""
    attributes = attributes or {}
    if attributes.get('id') == 'urlbar-input' or attributes.get('class') == 'OmniboxViewViews': return 2
    return 1 if role == ROLE_ENTRY else 0


# ---------------------------------------------------------------- D-Bus through jeepney

def _jeepney():
    try:
        import jeepney
        from jeepney.io.blocking import open_dbus_connection
        from jeepney.wrappers import DBusErrorResponse
    except ImportError: return None
    return jeepney, open_dbus_connection, DBusErrorResponse


class JeepneyBus:
    """One private connection to a bus, with a time limit on every call."""

    def __init__(self, address, timeout=CALL_TIMEOUT):
        parts = _jeepney()
        if parts is None: raise BusError('jeepney is not installed')
        self.jeepney, opener, self.Error = parts
        self.timeout = timeout
        try: self.conn = opener(address, auth_timeout=max(timeout, 0.5))
        except Exception as e: raise BusError(str(e)) from e  # noqa: BLE001 - socket, auth or address errors
        self.unique_name = self.conn.unique_name

    def call(self, dest, path, interface, method, signature=None, body=()):
        j = self.jeepney
        msg = j.new_method_call(j.DBusAddress(path, bus_name=dest, interface=interface), method, signature, body)
        try: reply = self.conn.send_and_get_reply(msg, timeout=self.timeout)
        except Exception as e: raise BusError(str(e)) from e  # noqa: BLE001 - TimeoutError, OSError
        if reply.header.message_type == j.MessageType.error: raise BusError(str(self.Error(reply)))
        return reply.body

    def get(self, dest, path, interface, name):
        (_, value), = self.call(dest, path, PROPERTIES, 'Get', 'ss', (interface, name))
        return value

    def set(self, dest, path, interface, name, signature, value):
        self.call(dest, path, PROPERTIES, 'Set', 'ssv', (interface, name, (signature, value)))

    def close(self):
        try: self.conn.close()
        except Exception: pass  # noqa: BLE001


def session_address(environ=None):
    environ = os.environ if environ is None else environ
    address = environ.get('DBUS_SESSION_BUS_ADDRESS')
    if address: return address
    path = Path(environ.get('XDG_RUNTIME_DIR') or f'/run/user/{os.getuid()}') / 'bus'
    return f'unix:path={path}' if path.exists() else None


def session_bus(timeout=CALL_TIMEOUT):
    address = session_address()
    if not address: raise BusError('no session bus')
    return JeepneyBus(address, timeout)


def atspi_address(session=None, environ=None):
    """The accessibility bus's address: AT_SPI_BUS_ADDRESS, else asked of org.a11y.Bus on the
    session bus. Raises BusError when there is none."""
    environ = os.environ if environ is None else environ
    if environ.get('AT_SPI_BUS_ADDRESS'): return environ['AT_SPI_BUS_ADDRESS']
    own = session is None
    session = session or session_bus()
    try: address, = session.call('org.a11y.Bus', '/org/a11y/bus', 'org.a11y.Bus', 'GetAddress')
    finally:
        if own: session.close()
    if not address: raise BusError('no accessibility bus')
    return address


def connect_atspi():
    return JeepneyBus(atspi_address())


# ---------------------------------------------------------------- the reader

class AtspiAddressBar:
    """An address_bar reader: host(window, browser, title) on the TimedReader's thread."""

    def __init__(self, connect=connect_atspi, sleep=time.sleep):
        self.connect, self.sleep = connect, sleep
        self.bus = None
        self.found = OrderedDict()  # window -> (frame, entry)
        self.problem = None  # why the last read found nothing: 'no-bus', 'not-found', or None

    def _bus(self):
        if self.bus is None:
            try: self.bus = self.connect()
            except BusError: return None
        return self.bus

    def _call(self, node, method, signature=None, body=()):
        return self.bus.call(node[0], node[1], ACCESSIBLE, method, signature, body)

    def children(self, node):
        """A node's children, without the null references Chromium gives for children it hasn't
        made yet (asking for each by index sometimes makes them)."""
        try: children, = self._call(node, 'GetChildren')
        except BusError: return []
        out = []
        for index, child in enumerate(children):
            child = tuple(child)
            if child[1] == NULL:
                try: child = tuple(self._call(node, 'GetChildAtIndex', 'i', (index,))[0])
                except BusError: continue
            if child[1] != NULL: out.append(child)
        return out

    def states(self, node):
        return self._call(node, 'GetState')[0]

    def role(self, node):
        return self._call(node, 'GetRole')[0]

    def attributes(self, node):
        try: return dict(self._call(node, 'GetAttributes')[0])
        except BusError: return {}

    def name_hash(self, node):
        try: name = self.bus.get(node[0], node[1], ACCESSIBLE, 'Name')
        except BusError: return None
        return title_hash(name) if name else None

    def alive(self, node):
        try: states = self.states(node)
        except BusError: return None
        return None if has_state(states, STATE_DEFUNCT) else states

    def search(self, frame):
        """The address bar in a window's controls, by a breadth-first walk that skips web pages and
        menus (the toolbar comes before the page, so the walk is short)."""
        for _ in range(4):  # a tree just woken up (see wake) may take a moment to fill in
            if self.children(frame): break
            self.sleep(0.04)
        queue, fallback, seen = [(frame, 0)], None, 0
        while queue:
            node, depth = queue.pop(0)
            seen += 1
            if seen > SEARCH_NODES: break
            try: role = self.role(node)
            except BusError: continue
            if role in SKIPPED: continue
            if role in (ROLE_ENTRY, ROLE_COMBO_BOX):
                score = address_bar_score(role, self.attributes(node))
                if score == 2: return node
                if score == 1 and fallback is None: fallback = node
            if depth < SEARCH_DEPTH: queue.extend((child, depth + 1) for child in self.children(node))
        return fallback

    def wake(self, app):
        """Chromium builds its tree only once something asks for an object's attributes (it takes
        that as a screen reader at work). Asked of the browser's app alone, never of every app:
        other Chromium-based apps (Electron) would build theirs for nothing."""
        self.attributes(app)

    def find(self, title):
        """(frame, address bar) of the browser window, among every app on the bus: the frame named
        as the window in front is titled, else the frame with the ACTIVE state. (Chromium reports
        ACTIVE only once its tree is awake, so the title comes first.)"""
        own, active = self.bus.unique_name, None
        for app in self.children((REGISTRY, ROOT)):
            if app[0] == own: continue
            for frame in self.children(app):
                if title is not None and self.name_hash(frame) == title:
                    self.wake(app)
                    entry = self.search(frame)
                    if entry is not None: return frame, entry
                if active is None:
                    try:
                        if has_state(self.states(frame), STATE_ACTIVE): active = (app, frame)
                    except BusError: pass
        if active is None: return None
        app, frame = active
        self.wake(app)
        entry = self.search(frame)
        return (frame, entry) if entry is not None else None

    def keep(self, window, found):
        if window not in self.found and len(self.found) >= KEPT: self.found.popitem(last=False)
        self.found[window] = found

    def locate(self, window, title):
        """The address bar for this window: the one kept for it while its frame is still there and
        still the window (its name is the title, or it is active), else found again."""
        kept = self.found.get(window)
        states = self.alive(kept[0]) if kept else None
        if states is not None and (has_state(states, STATE_ACTIVE) or (title is not None and self.name_hash(kept[0]) == title)):
            return kept
        found = self.find(title)
        if found is not None:
            self.keep(window, found)
            return found
        # Nothing matches (the browser hasn't caught up with the title yet): the one kept for this
        # window, while it is still there.
        return kept if states is not None else None

    def read(self, entry):
        states = self.states(entry)
        if has_state(states, STATE_DEFUNCT): raise BusError('gone')
        if has_state(states, STATE_FOCUSED): return KEEP
        count = self.bus.get(entry[0], entry[1], TEXT, 'CharacterCount')
        text, = self.bus.call(entry[0], entry[1], TEXT, 'GetText', 'ii', (0, max(int(count), 0)))
        from .address_bar import host_of_address
        return host_of_address(text)

    def host(self, window, browser, title=None):
        """The host name in the address bar of the browser window in front, KEEP while the person
        types in it, or None (no accessibility bus, not found, not a web page, or a failed call).
        `title` is the window title's title_hash, None where it isn't known."""
        if not window: return None
        for attempt in range(2):
            if self._bus() is None:
                self.problem = 'no-bus'
                return None
            found = self.locate(window, title)
            if found is None:
                # The bus may have gone (a new login, the bus restarted): connect again next time.
                if not self.children((REGISTRY, ROOT)):
                    self.bus.close(); self.bus = None
                    self.problem = 'no-bus'
                else: self.problem = 'not-found'
                return None
            try:
                host = self.read(found[1])
                self.problem = None
                return host
            except BusError:
                self.forget(window)  # the browser rebuilt its toolbar: find the address bar again, once
        self.problem = 'not-found'
        return None

    def forget(self, window):
        self.found.pop(window, None)

    def close(self):
        if self.bus is not None: self.bus.close(); self.bus = None


# ---------------------------------------------------------------- is it there at all

def status(source_knows_windows=True, connect=connect_atspi):
    """'ready' when the accessibility bus answers, else 'off' (with the reason) for the panel and
    the log: ('ready'|'off', reason or None)."""
    if not source_knows_windows: return 'off', 'this desktop does not say which window is in front'
    if _jeepney() is None: return 'off', 'the jeepney Python module is missing'
    try: bus = connect()
    except BusError: return 'off', 'no AT-SPI accessibility bus (install and start at-spi2-core)'
    try: bus.close()
    except Exception: pass  # noqa: BLE001
    return 'ready', None


# ---------------------------------------------------------------- turning accessibility on

def marker_path(environ=None):
    environ = os.environ if environ is None else environ
    state = environ.get('XDG_STATE_HOME') or (str(Path(environ['HOME']) / '.local' / 'state') if environ.get('HOME') else None)
    return Path(state) / 'keybard-overlay' / 'accessibility-turned-on' if state else None


class Accessibility:
    """Turns the desktop's accessibility on (`org.a11y.Status.IsEnabled`) while website rules need
    it, and back off afterwards. It never touches a setting it didn't change: when accessibility is
    already on (a screen reader, or the person's choice), it leaves it alone.

    On GNOME-style desktops the bus keeps this in the `org.gnome.desktop.interface
    toolkit-accessibility` setting, which outlives the session; a marker file records that the Host
    turned it on, so a crashed or killed Host puts it back the next time it starts (the same file
    as Keybard Overlay's Rust app). `ScreenReaderEnabled` is never touched: on GNOME it starts the
    Orca screen reader."""

    def __init__(self, session=session_bus, marker=None):
        self.session, self.ours = session, False
        self.marker = marker_path() if marker is None else marker
        if self.marker and self.marker.exists():
            if self._enabled() is True: self._set(False)
            self._unmark()

    def _status(self, work):
        try: bus = self.session()
        except BusError: return None
        try: return work(bus)
        except (BusError, ValueError, TypeError): return None
        finally: bus.close()

    def _enabled(self):
        value = self._status(lambda b: b.get('org.a11y.Bus', '/org/a11y/bus', 'org.a11y.Status', 'IsEnabled'))
        return None if value is None else bool(value)

    def _set(self, on):
        return self._status(lambda b: b.set('org.a11y.Bus', '/org/a11y/bus', 'org.a11y.Status', 'IsEnabled', 'b', on) or True) is True

    def _unmark(self):
        try: self.marker.unlink()
        except (OSError, AttributeError): pass

    def want(self, on):
        """Returns True when this call turned accessibility on."""
        if on and not self.ours:
            if self._enabled() is not False: return False  # already on (not ours), or no accessibility bus
            if self.marker:
                try:
                    self.marker.parent.mkdir(parents=True, exist_ok=True)
                    self.marker.write_text('Keybard Overlay turned accessibility on for website rules\n')
                except OSError: pass
            self.ours = self._set(True)
            if not self.ours: self._unmark()
            return self.ours
        if not on and self.ours:
            self._set(False)
            self.ours = False
            self._unmark()
        return False


# ---------------------------------------------------------------- a tester's check

def probe(wait=5.0, reads=3, out=print, sleep=time.sleep, reader=None, access=None):
    """`--probe-sites`: turns accessibility on (if it is off), waits while the tester brings a
    browser to the front, reads its address bar a few times, and prints only the host name and how
    long each read took, never the address or a title. Returns 0 when a host was read."""
    from . import foreground
    from .address_bar import is_browser
    src = foreground.source()
    state, reason = status(not isinstance(src, foreground._Nothing))
    out(f'AT-SPI: {state}' + (f' ({reason})' if reason else ''))
    if state != 'ready': return 1
    access = access or Accessibility()
    if access.want(True): out('Accessibility turned on for this check; restart Chrome-based browsers already open, then run it again.')
    bar, found = reader or AtspiAddressBar(), False
    try:
        out(f'Bring a browser window to the front within {wait:.0f} seconds...')
        sleep(wait)
        for _ in range(reads):
            window, app, title = foreground.foreground_window(src)
            key = foreground.app_key(app[0]) if app else None
            if not window or not is_browser(key):
                out(f'In front: {key or "no window known"} (not a browser)')
            else:
                start = time.monotonic()
                host = bar.host(window, key, title_hash(title) if title is not None else None)
                ms = (time.monotonic() - start) * 1000
                shown = 'address bar has the keyboard (keeps the last site)' if host == KEEP else host or f'none ({bar.problem or "not a web page"})'
                out(f'{key}: {shown} · {ms:.0f} ms')
                found = found or bool(host)
            sleep(1.0)
    finally:
        bar.close()
        access.want(False)
    return 0 if found else 1
