"""One HID owner; read the board profile before publishing live layer state."""
from threading import Event, Lock
import time
from PySide6.QtCore import QThread, Signal
from .protocol import SvalReader, ProtocolError, Cancelled, candidates, hid_backend, DEFAULT_LAYER_STATE_FLAG, UnsupportedCommand


class DeviceWorker(QThread):
    pressed = Signal(object)
    state = Signal(object)
    profile = Signal(object)
    status = Signal(str)

    def __init__(self, selected, expected_uid=None, parent=None):
        super().__init__(parent)
        self.selected = selected
        self.expected_uid = expected_uid  # Pinned after first successful handshake.
        self.stop_event = Event()
        self.reload_event = Event()
        self.press_lock = Lock()
        self.press_enabled = False
        self.press_generation = 0

    def set_press_tracking(self, enabled):
        with self.press_lock:
            self.press_enabled = enabled
            self.press_generation += 1
            return self.press_generation

    def stop(self):
        self.stop_event.set()

    def reload(self):
        self.reload_event.set()

    def run(self):
        try:
            hid = hid_backend()
        except ImportError as exc:
            self.status.emit(f"Stopped · HID runtime unavailable: {exc}")
            return
        retry = .5
        while not self.stop_event.is_set():
            device = None
            try:
                self.status.emit("Connecting…")
                serial = self.selected.get("serial_number")
                devices = candidates(hid)
                matches = [d for d in devices if (d.get("serial_number") == serial if serial
                           else d["path"] == self.selected["path"])]
                if len(matches) != 1:
                    raise ProtocolError("Selected Svalboard is unavailable or ambiguous")
                device = hid.device()
                device.open_path(matches[0]["path"])
                reader = SvalReader(device, cancelled=self.stop_event.is_set)
                unavailable_generation = None
                version, uid = reader.info()
                if self.expected_uid is not None and uid != self.expected_uid:
                    self.status.emit("Stopped · reconnected board definition UID changed; select it again")
                    return
                self.expected_uid = uid
                self.reload_event.set()
                retry = .5
                while not self.stop_event.is_set():
                    if self.reload_event.is_set():
                        self.reload_event.clear()
                        profile = reader.read_profile(uid, self.status.emit)
                        reader.checkpoint()
                        self.profile.emit(profile)
                        mode = "automatic defaults" if reader.feature_flags & DEFAULT_LAYER_STATE_FLAG else "manual default (older firmware)"
                        self.status.emit(f"Connected · Sval v{version} · layout read from board; {mode}")
                    cycle_start = time.monotonic()
                    self.state.emit(reader.layer_snapshot())
                    with self.press_lock:
                        enabled, generation = self.press_enabled, self.press_generation
                    if enabled and generation != unavailable_generation:
                        try:
                            positions = reader.pressed_keys()
                        except UnsupportedCommand:
                            # Keep layer tracking available on firmware without matrix reads.
                            self.pressed.emit((generation, None, time.monotonic()))
                            unavailable_generation = generation
                        else:
                            self.pressed.emit((generation, positions, time.monotonic()))
                    self.stop_event.wait(max(0, .008 - (time.monotonic() - cycle_start)))
            except Cancelled:
                return
            except (OSError, ValueError, ProtocolError) as exc:
                self.status.emit(f"Disconnected · {exc} · retrying")
            finally:
                if device is not None:
                    try:
                        device.close()
                    except OSError:
                        pass
            if not self.selected.get("serial_number"):
                self.status.emit("Disconnected · no stable serial; rescan and select the device")
                return
            if self.stop_event.wait(retry):
                return
            retry = min(5, retry * 2)
