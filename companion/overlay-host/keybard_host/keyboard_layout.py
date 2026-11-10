"""Which keyboard layout the computer is using, for Keybard's Key legends: Automatic. Reads only.

Windows: the layout of the window in front (GetKeyboardLayout on its thread), so a switch made in any app
counts. Linux on X11: the active xkb group's layout. macOS and Wayland don't tell other apps the layout:
those report unavailable, and Keybard keeps the layout chosen in Settings.

A reading is a dict for the state snapshot's osLayout:
  available: bool; layoutId: Keybard's layout id, or None when Keybard has no legends for it;
  name: the computer's own name for the layout; id: Windows' keyboard layout ID or the xkb layout.
"""
import ctypes
import os
import re
import subprocess
import sys

# Windows keyboard layout IDs (KLID) of layouts whose Keybard legends were checked against the
# Windows layout tables, base, Shift and AltGr level (src/lib/autoLegends.ts AUTO_LAYOUT_IDS).
WINDOWS_LAYOUTS = {
    '00000409': 'us', '00020409': 'us_intl', '00000809': 'uk', '00000407': 'german', '0000040C': 'french',
    '0000040A': 'spanish', '00000410': 'italian', '00000416': 'br', '00010416': 'br', '00000406': 'danish',
    '00000807': 'swiss', '00000419': 'russian',
}
# xkb layouts with no variant (or nodeadkeys, which types the same characters).
XKB_LAYOUTS = {'us': 'us', 'gb': 'uk', 'de': 'german', 'fr': 'french', 'es': 'spanish', 'it': 'italian',
               'br': 'br', 'dk': 'danish', 'ch': 'swiss', 'ru': 'russian'}
XKB_SAME_VARIANTS = ('', 'nodeadkeys')
# xkb layouts Keybard has no legends for, by the name xkb gives them. us(intl) is not Windows'
# US-International: its AltGr level differs (AltGr+' types ', AltGr+f types ë), so it isn't mapped.
XKB_NAMES = {'us(intl)': 'English (US, intl., with dead keys)', 'us(altgr-intl)': 'English (US, intl., with AltGr dead keys)'}

UNAVAILABLE = dict(available=False, layoutId=None, name=None, id=None)


def klid_for_hkl(hkl, layout_ids=None):
    """The keyboard layout ID (KLID, 8 hex digits) of an input locale handle.

    The high word is the keyboard: a KLID's low word, or 0xFnnn for a layout variant whose KLID is
    the one with that "Layout Id" in the registry (layout_ids: {'0001': '00020409', ...}).
    An IME (0xEnnn) is named by the whole handle, as its registry key is."""
    hkl &= 0xFFFFFFFF
    device = hkl >> 16
    if device & 0xF000 == 0xF000:
        found = (layout_ids or {}).get(f'{device & 0x0FFF:04x}')
        return found.upper() if found else f'{hkl:08X}'  # unknown variant: matches no layout
    if device & 0xF000 == 0xE000: return f'{hkl:08X}'
    return f'0000{device:04X}'


def windows_reading(klid, name):
    return dict(available=True, layoutId=WINDOWS_LAYOUTS.get(klid), name=name, id=klid)


def xkb_reading(query, group):
    """From `setxkbmap -query` output and the active group, the reading for that group's layout."""
    fields = dict(re.findall(r'^(\w+):[ \t]*(.*)$', query or '', re.M))
    layouts = [x.strip() for x in fields.get('layout', '').split(',')]
    variants = [x.strip() for x in fields.get('variant', '').split(',')]
    if not layouts or not layouts[0] or not 0 <= group < len(layouts): return UNAVAILABLE
    layout = layouts[group]
    variant = variants[group] if group < len(variants) else ''
    known = XKB_LAYOUTS.get(layout) if variant in XKB_SAME_VARIANTS else None
    xkb = f'{layout}({variant})' if variant else layout
    return dict(available=True, layoutId=known, name=XKB_NAMES.get(xkb, xkb), id=xkb)


def query_from_rules_names(raw):
    """setxkbmap -query's text from the root window's _XKB_RULES_NAMES (rules, model, layout, variant, options)."""
    parts = (raw or b'').split(b'\0') + [b''] * 5
    rules, model, layout, variant, options = (x.decode('utf-8', 'replace') for x in parts[:5])
    return f'rules: {rules}\nmodel: {model}\nlayout: {layout}\nvariant: {variant}\noptions: {options}\n'



class _WindowsSource:
    def __init__(self, user32=None, registry=None):
        from ctypes import wintypes
        self.user = user32 or ctypes.WinDLL('user32', use_last_error=True)
        self.user.GetForegroundWindow.restype = wintypes.HWND
        self.user.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.c_void_p]
        self.user.GetWindowThreadProcessId.restype = wintypes.DWORD
        self.user.GetKeyboardLayout.argtypes = [wintypes.DWORD]
        self.user.GetKeyboardLayout.restype = ctypes.c_void_p
        self.registry = registry if registry is not None else _windows_registry()
        self.names = {}

    def read(self):
        window = self.user.GetForegroundWindow()
        if not window: return None  # nothing in front (a desktop switch): keep the last reading
        thread = self.user.GetWindowThreadProcessId(window, None)
        hkl = self.user.GetKeyboardLayout(thread) or 0
        if not hkl: return None
        klid = klid_for_hkl(hkl, self.registry['ids']())
        if klid not in self.names: self.names[klid] = self.registry['name'](klid)
        return windows_reading(klid, self.names[klid])


def _windows_registry():
    """The registry's keyboard layouts: variant ids to KLIDs, and each KLID's name. Read once, when first needed."""
    import winreg
    root = r'SYSTEM\CurrentControlSet\Control\Keyboard Layouts'
    cache = {}

    def ids():
        if 'ids' not in cache:
            found = {}
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, root) as layouts:
                    for i in range(winreg.QueryInfoKey(layouts)[0]):
                        klid = winreg.EnumKey(layouts, i)
                        try:
                            with winreg.OpenKey(layouts, klid) as key:
                                found[str(winreg.QueryValueEx(key, 'Layout Id')[0]).lower()] = klid
                        except OSError: pass
            except OSError: pass
            cache['ids'] = found
        return cache['ids']

    def name(klid):
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, rf'{root}\{klid}') as key:
                return str(winreg.QueryValueEx(key, 'Layout Text')[0])
        except OSError: return None
    return dict(ids=ids, name=name)


class _X11Source:
    def __init__(self, run=None):
        class XkbState(ctypes.Structure):
            _fields_ = [('group', ctypes.c_ubyte), ('locked_group', ctypes.c_ubyte),
                        ('base_group', ctypes.c_ushort), ('latched_group', ctypes.c_ushort),
                        ('mods', ctypes.c_ubyte), ('base_mods', ctypes.c_ubyte),
                        ('latched_mods', ctypes.c_ubyte), ('locked_mods', ctypes.c_ubyte),
                        ('compat_state', ctypes.c_ubyte), ('grab_mods', ctypes.c_ubyte),
                        ('compat_grab_mods', ctypes.c_ubyte), ('lookup_mods', ctypes.c_ubyte),
                        ('compat_lookup_mods', ctypes.c_ubyte), ('ptr_buttons', ctypes.c_ushort)]
        self.State = XkbState
        self.x11 = ctypes.CDLL('libX11.so.6')
        self.x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
        self.x11.XOpenDisplay.restype = ctypes.c_void_p
        self.x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
        self.x11.XkbGetState.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.POINTER(XkbState)]
        self.x11.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
        self.x11.XInternAtom.restype = ctypes.c_ulong
        self.x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
        self.x11.XDefaultRootWindow.restype = ctypes.c_ulong
        self.x11.XGetWindowProperty.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_long, ctypes.c_long, ctypes.c_int, ctypes.c_ulong,
                                                ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_ulong),
                                                ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.c_void_p)]
        self.x11.XFree.argtypes = [ctypes.c_void_p]
        self.display = self.x11.XOpenDisplay(None)
        if not self.display: raise OSError('No X display')
        self.atom = self.x11.XInternAtom(self.display, b'_XKB_RULES_NAMES', 1)
        self.run = run or (lambda: subprocess.run(['setxkbmap', '-query'], capture_output=True, text=True, timeout=2).stdout)
        self.group, self.query, self.reading, self.rules_names = None, None, None, None

    def names(self):
        """The root window's _XKB_RULES_NAMES, which a layout list change (setxkbmap, the desktop's settings)
        rewrites: one cheap X request, no process. None where the server doesn't have it."""
        if not self.atom: return None
        kind, fmt, count, after, data = ctypes.c_ulong(), ctypes.c_int(), ctypes.c_ulong(), ctypes.c_ulong(), ctypes.c_void_p()
        if self.x11.XGetWindowProperty(self.display, self.x11.XDefaultRootWindow(self.display), self.atom, 0, 1024, 0, 0,
                                       ctypes.byref(kind), ctypes.byref(fmt), ctypes.byref(count), ctypes.byref(after), ctypes.byref(data)) != 0:
            return None
        try: return ctypes.string_at(data.value, count.value) if data.value and fmt.value == 8 else None
        finally:
            if data.value: self.x11.XFree(data)

    def read(self):
        state = self.State()
        if self.x11.XkbGetState(self.display, 0x100, ctypes.byref(state)) != 0: return None
        # Read again when the group or the layout list changes. The list comes from _XKB_RULES_NAMES;
        # without it, from setxkbmap, asked only when the group changes (and once at start).
        names = self.names()
        if state.group != self.group or names != self.rules_names or self.query is None:
            if names is not None: self.query = query_from_rules_names(names)
            else:
                try: self.query = self.run()
                except (OSError, subprocess.SubprocessError): self.query = ''
            self.group, self.rules_names = state.group, names
            self.reading = xkb_reading(self.query, state.group)
        return self.reading

    def close(self):
        if self.display: self.x11.XCloseDisplay(self.display); self.display = None


class LayoutReader:
    """Reads the computer's keyboard layout. read() is cheap; call it as often as the caller likes (the
    Overlay does, at most 4 times a second while someone is looking). None from read() means keep the last."""

    def __init__(self, platform=None, environ=None, source=None):
        platform = sys.platform if platform is None else platform
        environ = os.environ if environ is None else environ
        self.source, self.fixed = source, None
        if source is not None: return
        try:
            if platform == 'win32': self.source = _WindowsSource()
            elif platform == 'darwin' or environ.get('WAYLAND_DISPLAY') or not environ.get('DISPLAY'): self.fixed = UNAVAILABLE
            else: self.source = _X11Source()
        except (OSError, AttributeError, ImportError):
            self.fixed = UNAVAILABLE

    def read(self):
        if self.fixed is not None: return dict(self.fixed)
        try: return self.source.read()
        except (OSError, ValueError): return None

    def close(self):
        close = getattr(self.source, 'close', None)
        if close: close()


class ForegroundHook:
    """Windows: calls back when another window comes to the front, so a switch of apps (each with its own
    layout) is read at once instead of at the next timer tick. Elsewhere it does nothing."""
    EVENT_SYSTEM_FOREGROUND = 3

    def __init__(self, callback):
        self.handle, self.proc = None, None
        if sys.platform != 'win32': return
        try:
            from ctypes import wintypes
            user = ctypes.WinDLL('user32', use_last_error=True)
            Proc = ctypes.WINFUNCTYPE(None, wintypes.HANDLE, wintypes.DWORD, wintypes.HWND, wintypes.LONG, wintypes.LONG, wintypes.DWORD, wintypes.DWORD)
            user.SetWinEventHook.restype = wintypes.HANDLE
            user.SetWinEventHook.argtypes = [wintypes.DWORD, wintypes.DWORD, wintypes.HMODULE, Proc, wintypes.DWORD, wintypes.DWORD, wintypes.DWORD]
            user.UnhookWinEvent.argtypes = [wintypes.HANDLE]
            self.user = user
            self.proc = Proc(lambda *args: callback())
            # WINEVENT_OUTOFCONTEXT (0): delivered on this thread's message loop (Qt's), not in the other app.
            self.handle = user.SetWinEventHook(self.EVENT_SYSTEM_FOREGROUND, self.EVENT_SYSTEM_FOREGROUND, None, self.proc, 0, 0, 0)
        except (OSError, AttributeError):
            self.handle = None

    def close(self):
        if self.handle: self.user.UnhookWinEvent(self.handle); self.handle = None
