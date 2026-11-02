"""One HID owner; read the board profile before publishing live layer state."""
from threading import Event, Lock
import time
from PySide6.QtCore import QThread, Signal
from .protocol import (SvalReader, ProtocolError, Cancelled, candidates, hid_backend, DEFAULT_LAYER_STATE_FLAG,
                       POINTING_MOTION_FLAG2, POINTING_MOTION_READERS_FLAG2, UnsupportedCommand)
from .schedule import PollScheduler


class DeviceWorker(QThread):
    pressed = Signal(object)
    state = Signal(object)
    profile = Signal(object)
    status = Signal(str)
    # Each hand's pointing motion (POINTING_MOTION, a read), only while the overlay draws pointing.
    pointing = Signal(object)

    def __init__(self, selected, expected_uid=None, parent=None):
        super().__init__(parent)
        self.selected = selected
        # The definition UID last seen. A different one after a reconnect is new firmware on
        # the same board (same serial): its layout is read again, as on every connect.
        self.expected_uid = expected_uid
        self.stop_event = Event()
        self.reload_event = Event()
        self.refresh_event = Event()
        # Wakes the read loop early: a new plan, a reload or refresh, or stop.
        self.wake_event = Event()
        self.press_lock = Lock()
        self.press_enabled = False
        self.press_watch = False
        self.press_layer = False
        self.press_generation = 0
        self.pointing_enabled = False
        self.pointing_watch = False
        # The read loop's clock and sleep; tests drive them with a fake clock.
        self.clock = time.monotonic
        self.wait_for_wake = self.wake_event.wait

    # About 60 reads a second; the firmware counts motion only while someone reads within 1.5 s.
    POINTING_INTERVAL = .016
    # Watching only (the overlay draws no pointing): enough to tell the board is in use. Only on
    # firmware that keeps the Overlay's own motion counts, so Keybard's are never taken.
    WATCH_INTERVAL = .25
    # How often to look again for a pointing module the board didn't know yet (one 0x18 read).
    SETTLE_INTERVAL = 1.0

    def set_pointing_tracking(self, enabled, watch=False):
        """enabled: read motion for the overlay to draw. watch: otherwise read it now and then,
        to see the board is in use (only where the board keeps per-reader counts)."""
        changed = (bool(enabled), bool(watch)) != (self.pointing_enabled, self.pointing_watch)
        self.pointing_enabled = bool(enabled)
        self.pointing_watch = bool(watch)
        if changed: self.wake_event.set()

    def set_press_tracking(self, enabled, watch=False, layer=False):
        """enabled: something shows this board's held keys; read the matrix fast. watch: they
        aren't shown, but which board is in use matters; sample the matrix slowly. layer: the
        overlay shows this board's layer; read it fast. Otherwise the layer state is read about
        4 times a second (schedule.py). Returns the generation that tags the held keys read
        under this plan."""
        with self.press_lock:
            self.press_enabled = bool(enabled)
            self.press_watch = bool(watch)
            self.press_layer = bool(layer)
            self.press_generation += 1
            generation = self.press_generation
        self.wake_event.set()
        return generation

    def stop(self):
        self.stop_event.set()
        self.wake_event.set()

    def reload(self):
        self.reload_event.set()
        self.wake_event.set()

    def refresh(self):
        """Re-read the layout after an edit, keeping the board definition and the current layout on show."""
        self.refresh_event.set()
        self.wake_event.set()

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
                self.expected_uid = uid
                self.reload_event.set()
                refresh_after, refresh_failures = 0.0, 0
                pointing_next, pointing_supported = 0.0, True
                settle_next = 0.0
                schedule = PollScheduler(self.clock())
                retry = .5
                while not self.stop_event.is_set():
                    if self.reload_event.is_set():
                        self.reload_event.clear()
                        self.refresh_event.clear()
                        # A profile read can take most of a second: a fresh layer state first, so
                        # the overlay's 0.6 s staleness check (Host.tick) doesn't blank it meanwhile.
                        self.state.emit(reader.layer_snapshot())
                        profile = reader.read_profile(uid, self.status.emit)
                        reader.checkpoint()
                        self.profile.emit(profile)
                        schedule.read_now(self.clock())  # the new layout's layer state at once
                        mode = "automatic defaults" if reader.feature_flags & DEFAULT_LAYER_STATE_FLAG else "manual default (older firmware)"
                        self.status.emit(f"Connected · Sval v{version} · layout read from board; {mode}")
                    elif self.refresh_event.is_set() and self.clock() >= refresh_after:
                        self.refresh_event.clear()
                        try:
                            self.state.emit(reader.layer_snapshot())  # as before a reload
                            profile = reader.read_profile(uid, reuse_definition=True)
                        except ProtocolError as exc:
                            # Usually Keybard still writing: keep the shown layout and try again shortly.
                            refresh_failures += 1
                            if refresh_failures > 3:
                                raise
                            self.status.emit(f"Layout refresh deferred · {exc}")
                            refresh_after = self.clock() + .5
                            self.refresh_event.set()
                        else:
                            refresh_failures = 0
                            reader.checkpoint()
                            self.profile.emit(profile)
                            schedule.read_now(self.clock())
                            self.status.emit(f"Connected · Sval v{version} · layout refreshed from board")
                    with self.press_lock:
                        enabled, watch, layer, generation = (self.press_enabled, self.press_watch,
                                                             self.press_layer, self.press_generation)
                    now = self.clock()
                    schedule.set_plan(enabled, watch, now, layer=layer)
                    if schedule.due(now):
                        # Timed from the read's start, so round trips don't stretch the interval.
                        snapshot = reader.layer_snapshot()
                        self.state.emit(snapshot)
                        positions = None
                        if schedule.reads_matrix(now) and generation != unavailable_generation:
                            try:
                                positions = reader.pressed_keys()
                            except UnsupportedCommand:
                                # Keep layer tracking available on firmware without matrix reads.
                                self.pressed.emit((generation, None, time.monotonic()))
                                unavailable_generation = generation
                            else:
                                self.pressed.emit((generation, positions, time.monotonic()))
                        schedule.done(snapshot, positions, now)
                    # A half that hadn't reported its pointing module at the profile read, or
                    # reported none in the first 35 s (the firmware probes again until 30 s after
                    # power-on): look again each second, and re-read the profile once it changes.
                    if reader.pointing_watching() and not self.refresh_event.is_set() and self.clock() >= settle_next:
                        settle_next = self.clock() + self.SETTLE_INTERVAL
                        if reader.pointing_settled():
                            self.refresh_event.set()
                    watching = (not self.pointing_enabled and self.pointing_watch
                                and reader.feature_flags2 & POINTING_MOTION_READERS_FLAG2)
                    if (self.pointing_enabled or watching) and pointing_supported and self.clock() >= pointing_next:
                        pointing_next = self.clock() + (self.WATCH_INTERVAL if watching else self.POINTING_INTERVAL)
                        motion = None
                        try:
                            motion = reader.pointing_motion()
                        except UnsupportedCommand:
                            pointing_supported = False
                        if not reader.feature_flags2 & POINTING_MOTION_FLAG2:
                            pointing_supported = False  # older firmware: still devices, nothing said
                        if motion is not None:
                            self.pointing.emit(motion)
                    # Sleep until the next read is due, or a new plan, reload, refresh or stop.
                    wake_at = schedule.next_at
                    if (self.pointing_enabled or watching) and pointing_supported: wake_at = min(wake_at, pointing_next)
                    if reader.pointing_watching() and not self.refresh_event.is_set(): wake_at = min(wake_at, settle_next)
                    if self.refresh_event.is_set(): wake_at = min(wake_at, refresh_after)
                    self.wait_for_wake(max(0, wake_at - self.clock()))
                    self.wake_event.clear()
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
