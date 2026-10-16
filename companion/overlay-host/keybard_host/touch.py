"""Touch contacts on the native touchpad, for the overlay (demo).

Firmware with the native touchpad (SVAL_NATIVE_PTP) gives both Azoteq pads to
the computer as one Precision Touchpad, and the operating system does every
gesture itself. The board reports no contacts over the Sval protocol (0x2D
carries none), so the Host reads the touchpad's own input reports as Windows
receives them, through Raw Input (WM_INPUT with RIDEV_INPUTSINK). That is a
passive copy: nothing is sent to the board, the touchpad stays the computer's,
and pinch, scroll and the rest work exactly as without the Host.

Input report 1 (35 bytes, keyboards/svalboard/azoteq/ptp_descriptor.h):
  [0]      report ID 1
  [1+6i]   finger i: bit 0 confidence, bit 1 tip switch
  [2+6i]   contact ID
  [3+6i]   X, uint16 LE, 0..4571 across the whole surface
  [5+6i]   Y, uint16 LE, 0..1791
  [31]     scan time, uint16 LE, 100 us units
  [33]     contact count (in the first report of a frame; 0 in a continuation)
  [34]     buttons
The surface is the left pad (X 0..2047), a 10 mm gap, then the right pad
(X 2524..4571), 96 x 40 mm in all.
"""
import json
import struct
import sys
import threading
import time
from pathlib import Path

REPORT_ID = 1
REPORT_BYTES = 35
SLOTS = 5
PAD_X = 2048
PAD_STRIDE = 2524           # 2048 + the gap's 476 counts (10 mm)
SURFACE_X = 4572            # logical 0..4571
SURFACE_Y = 1792            # logical 0..1791
SURFACE_MM = (96.0, 40.0)   # physical extent, from the descriptor
STALE_S = 0.5               # contacts with no report this long are dropped

TOUCHPAD_USAGE_PAGE, TOUCHPAD_USAGE = 0x0D, 0x05


def decode(report):
    """One input report 1 as a dict, or None if it isn't one."""
    report = bytes(report)
    if len(report) < REPORT_BYTES or report[0] != REPORT_ID:
        return None
    slots = []
    for i in range(SLOTS):
        flags, cid, x, y = struct.unpack_from('<BBHH', report, 1 + 6 * i)
        slots.append(dict(confidence=bool(flags & 1), tip=bool(flags & 2), id=cid, x=x, y=y))
    scan, = struct.unpack_from('<H', report, 31)
    return dict(slots=slots, scan=scan, count=report[33], buttons=report[34] & 7)


def pad_of(x):
    """('left'|'right', u 0..1 across that pad) for a surface X, or (None, None) in the gap."""
    if x < PAD_X:
        return 'left', x / (PAD_X - 1)
    if x >= PAD_STRIDE:
        return 'right', min(1.0, (x - PAD_STRIDE) / (PAD_X - 1))
    return None, None


def surface_mm(x, y):
    return x * SURFACE_MM[0] / (SURFACE_X - 1), y * SURFACE_MM[1] / (SURFACE_Y - 1)


class ContactTracker:
    """Contacts down, from a stream of input reports (hybrid mode: a frame may span reports)."""

    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.contacts = {}   # id -> dict(x, y, confidence)
        self.remaining = 0   # slots still due in the current frame
        self.frame = {}
        self.last = 0.0
        self.buttons = 0
        self.frames = 0

    def feed(self, report):
        """Take one raw report. Returns True when a frame completed (the contacts changed)."""
        r = decode(report)
        if r is None:
            return False
        self.last = self.clock()
        if r['count']:
            self.remaining, self.frame = r['count'], {}
            self.buttons = r['buttons']
        elif not self.remaining:
            return False  # a continuation with no frame open
        take = min(SLOTS, self.remaining)
        for s in r['slots'][:take]:
            self.frame[s['id']] = s
        self.remaining -= take
        if self.remaining:
            return False
        # Windows' rule: a contact not in the frame, or with tip off, has lifted.
        self.contacts = {cid: dict(x=s['x'], y=s['y'], confidence=s['confidence'])
                         for cid, s in self.frame.items() if s['tip']}
        self.frames += 1
        return True

    def expire(self):
        """Drop contacts that stopped reporting (unplugged, suspended). True if it changed."""
        if self.contacts and self.clock() - self.last > STALE_S:
            self.contacts, self.remaining = {}, 0
            return True
        return False

    def snapshot(self):
        return overlay_detail(self.contacts, self.buttons)


def overlay_detail(contacts, buttons=0):
    """What the overlay draws: each contact on its pad, and the spread of the first two."""
    out = []
    for cid in sorted(contacts):
        c = contacts[cid]
        hand, u = pad_of(c['x'])
        if hand is None:
            continue
        out.append(dict(id=cid, hand=hand, u=round(u, 4), v=round(c['y'] / (SURFACE_Y - 1), 4), palm=not c['confidence']))
    spread = None
    down = [contacts[cid] for cid in sorted(contacts) if contacts[cid]['confidence']]
    if len(down) >= 2:
        (ax, ay), (bx, by) = surface_mm(down[0]['x'], down[0]['y']), surface_mm(down[1]['x'], down[1]['y'])
        spread = round(((ax - bx) ** 2 + (ay - by) ** 2) ** .5, 1)
    return dict(contacts=out, spread=spread, buttons=buttons)


# --- recording and replay -------------------------------------------------

def load_recording(path):
    """[(t seconds from the start, report bytes)] from a JSON-lines recording."""
    rows = []
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        row = json.loads(line)
        rows.append((float(row['t']), bytes.fromhex(row['hex'])))
    if rows:
        t0 = rows[0][0]
        rows = [(t - t0, r) for t, r in rows]
    return rows


class Recorder:
    def __init__(self, path):
        self.file = open(path, 'a', encoding='utf-8')
        self.t0 = time.monotonic()

    def write(self, report):
        self.file.write(json.dumps(dict(t=round(time.monotonic() - self.t0, 4), hex=bytes(report).hex())) + '\n')
        self.file.flush()

    def close(self):
        self.file.close()


# --- Windows Raw Input ----------------------------------------------------

def touchpad_paths(hid_module, serial):
    """hidapi paths of the touchpad collection (0x0D/0x05) of the board with this serial."""
    out = []
    for d in hid_module.enumerate():
        if d.get('serial_number') == serial and d.get('usage_page') == TOUCHPAD_USAGE_PAGE and d.get('usage') == TOUCHPAD_USAGE:
            p = d.get('path')
            out.append(p.decode() if isinstance(p, bytes) else p)
    return out


def same_device(raw_name, hid_path):
    """Raw Input's device name and hidapi's path name the same device interface."""
    norm = lambda s: s.lower().replace('\\\\?\\', '').replace('\\??\\', '').strip('\\')
    return norm(raw_name) == norm(hid_path)


def parse_rawinput(buf, pointer_size=8):
    """(hDevice, [reports]) from a RAWINPUT buffer of type RIM_TYPEHID, else None."""
    header = 8 + 2 * pointer_size
    if len(buf) < header + 8:
        return None
    dw_type, = struct.unpack_from('<I', buf, 0)
    if dw_type != 2:  # RIM_TYPEHID
        return None
    fmt = '<Q' if pointer_size == 8 else '<I'
    h_device, = struct.unpack_from(fmt, buf, 8)
    size, count = struct.unpack_from('<II', buf, header)
    data = bytes(buf[header + 8:header + 8 + size * count])
    return h_device, [data[i * size:(i + 1) * size] for i in range(count)]


class RawTouchpadReader:
    """Reads one touchpad's input reports through Windows Raw Input, on its own thread.

    Only the board whose hidapi path matches gets through; every other touchpad
    (a laptop's own) is ignored. on_report(bytes) runs on the reader thread.
    """

    def __init__(self, paths, on_report, on_status=lambda s: None):
        self.paths = list(paths)
        self.on_report, self.on_status = on_report, on_status
        self.thread = None
        self.thread_id = None
        self.names = {}
        self.reports = 0

    @staticmethod
    def supported():
        return sys.platform == 'win32'

    def start(self):
        self.thread = threading.Thread(target=self.run, name='touchpad-raw-input', daemon=True)
        self.thread.start()

    def stop(self):
        if self.thread_id is not None:
            import ctypes
            ctypes.windll.user32.PostThreadMessageW(self.thread_id, 0x0012, 0, 0)  # WM_QUIT
        if self.thread:
            self.thread.join(2)

    def run(self):
        import ctypes
        from ctypes import wintypes as w
        u32, k32 = ctypes.windll.user32, ctypes.windll.kernel32
        self.thread_id = k32.GetCurrentThreadId()
        HWND_MESSAGE = w.HWND(-3)
        u32.CreateWindowExW.restype = w.HWND
        u32.CreateWindowExW.argtypes = [w.DWORD, w.LPCWSTR, w.LPCWSTR, w.DWORD, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, w.HWND, w.HMENU, w.HINSTANCE, w.LPVOID]
        hwnd = u32.CreateWindowExW(0, 'STATIC', 'Keybard Host touchpad', 0, 0, 0, 0, 0, HWND_MESSAGE, None, None, None)
        if not hwnd:
            return self.on_status(f'Touchpad: no window ({ctypes.GetLastError()})')

        class RAWINPUTDEVICE(ctypes.Structure):
            _fields_ = [('usUsagePage', w.USHORT), ('usUsage', w.USHORT), ('dwFlags', w.DWORD), ('hwndTarget', w.HWND)]
        RIDEV_INPUTSINK, RIDEV_REMOVE = 0x100, 0x1
        dev = RAWINPUTDEVICE(TOUCHPAD_USAGE_PAGE, TOUCHPAD_USAGE, RIDEV_INPUTSINK, hwnd)
        u32.RegisterRawInputDevices.argtypes = [ctypes.c_void_p, w.UINT, w.UINT]
        if not u32.RegisterRawInputDevices(ctypes.byref(dev), 1, ctypes.sizeof(dev)):
            return self.on_status(f'Touchpad: Raw Input refused ({ctypes.GetLastError()})')
        self.on_status('Touchpad: listening')
        u32.GetRawInputData.argtypes = [w.HANDLE, w.UINT, ctypes.c_void_p, ctypes.POINTER(w.UINT), w.UINT]
        u32.GetRawInputData.restype = w.UINT
        u32.GetRawInputDeviceInfoW.argtypes = [w.HANDLE, w.UINT, ctypes.c_void_p, ctypes.POINTER(w.UINT)]
        u32.GetRawInputDeviceInfoW.restype = w.UINT
        u32.GetMessageW.argtypes = [ctypes.POINTER(w.MSG), w.HWND, w.UINT, w.UINT]
        u32.DispatchMessageW.argtypes = [ctypes.POINTER(w.MSG)]
        ptr = ctypes.sizeof(ctypes.c_void_p)
        header = 8 + 2 * ptr
        RID_INPUT, RIDI_DEVICENAME, WM_INPUT = 0x10000003, 0x20000007, 0x00FF

        def name_of(handle):
            if handle in self.names:
                return self.names[handle]
            n = w.UINT(0)
            u32.GetRawInputDeviceInfoW(handle, RIDI_DEVICENAME, None, ctypes.byref(n))
            buf = ctypes.create_unicode_buffer(n.value + 1)
            u32.GetRawInputDeviceInfoW(handle, RIDI_DEVICENAME, buf, ctypes.byref(n))
            self.names[handle] = buf.value
            return buf.value

        msg = w.MSG()
        while u32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            if msg.message == WM_INPUT:
                size = w.UINT(0)
                u32.GetRawInputData(msg.lParam, RID_INPUT, None, ctypes.byref(size), header)
                buf = ctypes.create_string_buffer(size.value)
                if u32.GetRawInputData(msg.lParam, RID_INPUT, buf, ctypes.byref(size), header) == size.value:
                    parsed = parse_rawinput(buf.raw, ptr)
                    if parsed:
                        handle, reports = parsed
                        name = name_of(handle)
                        if any(same_device(name, p) for p in self.paths):
                            for r in reports:
                                self.reports += 1
                                self.on_report(r)
            u32.DispatchMessageW(ctypes.byref(msg))  # DefWindowProc cleans up WM_INPUT
        dev.dwFlags, dev.hwndTarget = RIDEV_REMOVE, None
        u32.RegisterRawInputDevices(ctypes.byref(dev), 1, ctypes.sizeof(dev))
        u32.DestroyWindow(hwnd)
