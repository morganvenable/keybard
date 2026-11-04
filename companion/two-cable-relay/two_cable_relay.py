#!/usr/bin/env python3
"""Svalboard two-cable relay (prototype): each half on its own USB cable.

Use it when the split cable between the halves isn't working. Plug each half
into the computer with its own USB cable, then run this script and leave it
running. Both halves need the two-cable firmware.

    python3 two_cable_relay.py              (Mac, Linux)
    py -3 two_cable_relay.py                (Windows)

It finds the two halves by itself. The right half leads (it runs the keymap
for both halves) and the left half follows (it sends its keys and trackball
motion through this script). Press Ctrl+C to stop: within a second each half
types on its own again.

Options:
    --lead left|right       which half runs the keymap (default: right)
    list                    show the Svalboard halves on USB and stop
    sides                   set which half is left and which is right again

How it works: the follower pushes its key rows and pointer motion over raw
HID; the relay hands them to the lead, which runs them through the keymap
where the split cable would put them. So layers, modifiers, combos, tap-hold
and the pointing modes work across the halves. Both roles are leases: if the
relay stops, the lead lets go of the follower's keys within 0.5 s and the
follower types on its own again within 0.6 s.

Wire: 64-byte raw HID reports, [0xDD][client:4][0xFB][op] ... (two_cable.c in
svalboard/qmk). Needs hidapi: pip install hidapi.
"""
import argparse
import secrets
import sys
import threading
import time

try:
    import hid
except ImportError:
    if sys.platform == "win32":
        how = "py -3 -m pip install hidapi"
    else:
        how = "python3 -m venv sval-relay\n  sval-relay/bin/pip install hidapi\nthen run it with sval-relay/bin/python"
    sys.exit("This needs the hidapi package. Install it with:\n  " + how)
if not hasattr(hid, "device"):
    sys.exit("A different Python package named 'hid' is installed, not hidapi.\n"
             "Use a fresh virtual environment with only hidapi in it (see the instructions).")

USAGE_PAGE, USAGE = 0xFF61, 0x62
SIZE = 64
WRAP, PROTO, VIA, SVAL, ERR = 0xDD, 0xFB, 0xFE, 0xDF, 0xFF
OP_FOLLOW, OP_LEAD, OP_RELEASE, OP_STATUS, OP_INJECT, OP_CAPTURE, OP_REBOOT = range(1, 8)
PUSH_ROWS, PUSH_APPLIED, PUSH_REPORT = 0x90, 0x92, 0x93
STATUS_CABLE = 3                     # the split cable works: FOLLOW and LEAD refused
SIDE_CMD = 0x33                      # Sval side record: 0 GET, 1 SET
SIDE_SRC_HOST = 2
ROLE = {0: "none", 1: "lead", 2: "follower"}
SIDE = {0: "left", 1: "right", 0xFF: "unknown"}
SIDE_NUM = {"left": 0, "right": 1}
SET_STATUS = {1: "the request was refused as invalid", 2: "this half has nowhere to keep it",
              3: "writing it failed", 4: "this half's thumb wiring says it is the other side",
              8: "this half runs a one-side build for the other side"}
HEARTBEAT_S = 0.1
RENEW_S = 30          # client IDs live at least about 65 s on the board


class Gone(Exception):
    pass


class NotTwoCable(Exception):
    pass


class OpenFailed(Exception):
    pass


def boards():
    """Svalboard halves answering on the raw HID interface (nothing is sent)."""
    seen, out = set(), []
    for d in hid.enumerate():
        s = d.get("serial_number") or ""
        if d.get("usage_page") == USAGE_PAGE and d.get("usage") == USAGE and s.startswith("sval:") and s not in seen:
            seen.add(s)
            out.append(d)
    return out


def open_hint():
    if sys.platform == "darwin":
        return ("Close Keybard and any other app that talks to the keyboard, then try again.\n"
                "If it still fails: System Settings > Privacy & Security > Input Monitoring,\n"
                "turn on Terminal, then quit Terminal and open it again.")
    if sys.platform.startswith("linux"):
        return "Close Keybard, then try again. On Linux the hidraw device also needs read/write access (a udev rule)."
    return "Close Keybard and any other app that talks to the keyboard, then try again."


class Half:
    """One half on its own USB cable: a raw HID handle, a client ID and a reader thread."""

    def __init__(self, serial, name):
        self.serial, self.name = serial, name
        self.dev = None
        self.cid = 0
        self.cids = set()
        self.lock = threading.Lock()
        self.replies = {}
        self.cond = threading.Condition()
        self.handlers = {}
        self.alive = False
        self.closing = False
        self.renewed = 0.0
        self.last_error = None

    def open(self):
        m = [d for d in boards() if d["serial_number"] == self.serial]
        if len(m) != 1:
            return False
        dev = hid.device()
        try:
            dev.open_path(m[0]["path"])
        except (OSError, IOError) as e:
            raise OpenFailed(f"couldn't open {self.serial}: {e}") from e
        self.dev = dev
        self.alive = True
        self.closing = False
        self.reader = threading.Thread(target=self._reader, daemon=True, name=f"read-{self.name}")
        self.reader.start()
        try:
            self.bootstrap()
        except Gone:
            self.close()
            raise
        return True

    def close(self):
        self.closing = True
        self.alive = False
        # hidapi must not close a handle another thread is reading: wait for the
        # reader to leave read() (it times out every 200 ms) first.
        r = getattr(self, "reader", None)
        if r and r.is_alive() and r is not threading.current_thread():
            r.join(1.0)
        with self.lock:
            dev, self.dev = self.dev, None
        try:
            if dev:
                dev.close()
        except Exception:
            pass
        with self.cond:
            self.cond.notify_all()

    def write(self, pkt):
        pkt = bytes(pkt).ljust(SIZE, b"\0")
        with self.lock:
            if not self.alive or not self.dev:
                raise Gone(self.name)
            try:
                n = self.dev.write(b"\0" + pkt)
            except (OSError, ValueError) as e:
                raise Gone(self.name) from e
            if n < SIZE:  # hidapi counts the report ID byte on every platform it ships for; allow either
                raise Gone(self.name)

    def _reader(self):
        dev = self.dev
        while self.alive:
            try:
                r = bytes(dev.read(SIZE, 200))
            except (OSError, ValueError):
                break
            if not r:
                continue
            t = time.perf_counter()
            if r[0] != WRAP or len(r) < 8:
                continue
            cid = int.from_bytes(r[1:5], "little")
            if cid == 0:  # bootstrap reply: matched by nonce
                with self.cond:
                    self.replies[("boot", r[5:25])] = r
                    self.cond.notify_all()
                continue
            if cid not in self.cids:
                continue  # another app's reply on the shared endpoint
            if r[5] == ERR:  # the firmware didn't take the protocol (not a two-cable build)
                with self.cond:
                    self.replies[("err",)] = (r, t)
                    self.cond.notify_all()
                continue
            if r[5] == PROTO and r[6] in self.handlers:
                self.handlers[r[6]](r, t)
                continue
            with self.cond:
                self.replies[(r[5], r[6])] = (r, t)
                self.cond.notify_all()
        if self.closing:  # closed by us: close() closes the handle
            return
        self.alive = False  # gone off USB
        with self.lock:
            self.dev = None
        try:
            dev.close()
        except Exception:
            pass
        h = self.handlers.get("gone")
        if h:
            h(self)

    def _wait(self, key, timeout, err=False):
        end = time.monotonic() + timeout
        with self.cond:
            while key not in self.replies:
                if err and ("err",) in self.replies:
                    self.replies.pop(("err",))
                    raise NotTwoCable(self.name)
                left = end - time.monotonic()
                if left <= 0 or not self.alive:
                    raise Gone(f"{self.name}: no reply")
                self.cond.wait(left)
            return self.replies.pop(key)

    def bootstrap(self):
        nonce = secrets.token_bytes(20)
        self.write(bytes([WRAP, 0, 0, 0, 0]) + nonce)
        r = self._wait(("boot", nonce), 1.0)
        cid = int.from_bytes(r[25:29], "little")
        self.cids = {cid, self.cid} - {0}
        self.cid = cid
        self.renewed = time.monotonic()

    def header(self, proto, op):
        return bytes([WRAP]) + self.cid.to_bytes(4, "little") + bytes([proto, op])

    def send(self, op, payload=b""):
        self.write(self.header(PROTO, op) + bytes(payload))

    def request(self, op, payload=b"", timeout=0.5):
        with self.cond:
            self.replies.pop((PROTO, 0x80 | op), None)
            self.replies.pop(("err",), None)
        self.send(op, payload)
        r, _ = self._wait((PROTO, 0x80 | op), timeout, err=True)
        return dict(status=r[8], role=ROLE.get(r[9], r[9]), side=SIDE.get(r[10], r[10]),
                    capture=bool(r[11]), lead_packets=int.from_bytes(r[12:16], "little"))

    def via(self, cmd, args=b"", timeout=0.5):
        with self.cond:
            self.replies.pop((VIA, cmd), None)
        self.write(self.header(VIA, cmd) + bytes(args))
        r, _ = self._wait((VIA, cmd), timeout)
        return r[6:]

    def sval(self, cmd, args=b"", timeout=0.5):
        with self.cond:
            self.replies.pop((SVAL, cmd), None)
        self.write(bytes([WRAP]) + self.cid.to_bytes(4, "little") + bytes([SVAL, cmd]) + bytes(args))
        r, _ = self._wait((SVAL, cmd), timeout)
        return r[5:]

    def side_info(self):
        """Sval 0x33 GET: this half's side and where it came from."""
        d = self.sval(SIDE_CMD, bytes([0]) + bytes(15))[2:]  # d[0] op, d[1] status, ...
        return dict(side=SIDE.get(d[3], "unknown"), source=d[4], strap=d[5], build_side=d[15])

    def set_side(self, side):
        """Sval 0x33 SET this half's side (source HOST), then the half restarts."""
        d = self.sval(SIDE_CMD, bytes([1, 0, SIDE_NUM[side], SIDE_SRC_HOST, 1]) + bytes(11))[2:]
        return d[1]


class Relay:
    """Carries the follower's rows to the lead; holds both leases."""

    def __init__(self, lead, follower, log=print, names=("lead", "follower")):
        self.lead, self.follower = Half(lead, names[0]), Half(follower, names[1])
        self.log = log
        self.rows = bytes(5)
        self.side = 0xFF
        self.stop = threading.Event()
        self.paused = False          # bench: stop relaying, as if the relay hung
        self.on_rows = None          # bench hooks
        self.on_applied = None
        self.on_report = None
        self.relayed = 0
        self.cable = False           # the split cable works: the halves refuse the relay
        self.lead_down = False       # a write to the lead failed: hold nothing until one succeeds
        self.follower.handlers[PUSH_ROWS] = self._rows
        self.follower.handlers[0x80 | OP_FOLLOW] = self._reply
        self.lead.handlers[0x80 | OP_LEAD] = self._reply
        self.lead.handlers[PUSH_APPLIED] = lambda r, t: self.on_applied and self.on_applied(r, t)
        self.lead.handlers[PUSH_REPORT] = lambda r, t: self.on_report and self.on_report(r, t)
        self.follower.handlers["gone"] = self._follower_gone
        self.lead.handlers["gone"] = self._lead_gone

    def _reply(self, r, t):
        cable = r[8] == STATUS_CABLE
        if cable and not self.cable:
            self.log("The split cable between the halves is working, so the halves don't need the relay.\n"
                     "They type over the cable. You can stop this with Ctrl+C.")
        self.cable = cable

    def _lead_packet(self, seq, rows, motion=bytes(7), ack=0):
        return bytes([seq & 0xFF, self.side]) + rows + motion + bytes([ack])

    def _rows(self, r, t):
        if self.paused:
            return
        self.rows, self.side = bytes(r[9:14]), r[8]
        try:
            # flags bit 1: the follower's rows hold bench-injected keys (r[25] bit 0),
            # which the lead lets act only while it captures
            flags = 2 if r[25] & 1 else 0
            self.lead.send(OP_LEAD, self._lead_packet(r[7], self.rows, bytes(r[14:21]), flags))
            self.relayed += 1
        except Gone:
            self._lead_unreachable()
        if self.on_rows:
            self.on_rows(r, t, time.perf_counter())

    def _follower_gone(self, half):
        self.log(f"The {half.name} left USB. Waiting for it to come back.")
        self.rows = bytes(5)
        try:
            self.lead.send(OP_LEAD, self._lead_packet(0, self.rows))
            self.lead.send(OP_RELEASE)
        except Gone:
            pass

    def _lead_gone(self, half):
        self.log(f"The {half.name} left USB. The other half types on its own until it comes back.")
        try:
            self.follower.send(OP_RELEASE)
        except Gone:
            pass

    def connect(self):
        for h in (self.lead, self.follower):
            if not h.alive:
                try:
                    if h.open():
                        h.request(OP_STATUS)
                        self.log(f"The {h.name} is connected ({h.serial}).")
                        h.last_error = None
                except (Gone, NotTwoCable, OpenFailed) as e:
                    if isinstance(e, Gone):
                        msg = f"The {h.name} isn't answering yet. Trying again."
                    elif isinstance(e, NotTwoCable):
                        msg = f"The {h.name} ({h.serial}) runs other firmware, not the two-cable firmware."
                    else:
                        msg = f"The {h.name}: {e}"
                    if msg != h.last_error:  # once, not every heartbeat
                        self.log(msg + ("\n" + open_hint() if isinstance(e, OpenFailed) else ""))
                        h.last_error = msg
                    h.close()

    def tick(self):
        """One heartbeat: renew IDs, hold both leases, reconnect what went away."""
        self.connect()
        now = time.monotonic()
        for h in (self.lead, self.follower):
            if h.alive and now - h.renewed > RENEW_S:
                try:
                    h.bootstrap()
                except Gone:
                    pass
        if self.paused:
            return
        if self.lead_down and self.lead.alive:
            try:
                self.lead.send(OP_STATUS)  # writes go through again: the lead is back
                self.lead_down = False
            except Gone:
                pass
        if self.lead.alive and self.follower.alive and not self.lead_down:
            try:
                self.follower.send(OP_FOLLOW)  # the follower answers with its rows: that is the lead's heartbeat
            except Gone:
                pass

    def _lead_unreachable(self):
        """A write to the lead failed: it has left USB, though the computer may say so only
        seconds later. Stop holding the follower, so it types on its own at once."""
        if self.lead_down:
            return
        self.lead_down = True
        try:
            self.follower.send(OP_RELEASE)
        except Gone:
            pass

    def run(self):
        while not self.stop.is_set():
            self.tick()
            self.stop.wait(HEARTBEAT_S)

    def shutdown(self):
        self.stop.set()
        for h in (self.lead, self.follower):
            try:
                h.send(OP_RELEASE)
            except Gone:
                pass
            h.close()


# ---- finding the halves ----------------------------------------------------------------

def probe(d):
    """Open one half, ask for its two-cable status and its side, and close it again."""
    h = Half(d["serial_number"], "half")
    info = dict(serial=d["serial_number"], name=d.get("product_string") or "", two_cable=False,
                side="unknown", role="none", error=None)
    try:
        h.open()
        st = h.request(OP_STATUS)
        info.update(two_cable=True, role=st["role"], side=st["side"])
        try:
            info.update(h.side_info())
        except Gone:
            pass
        if st["role"] != "none":  # a relay that quit uncleanly left a lease: end it now
            h.send(OP_RELEASE)
    except NotTwoCable:
        pass
    except OpenFailed as e:
        info["error"] = str(e)
    except Gone:
        info["error"] = "no answer"
    finally:
        h.close()
    return info


def wait_for(serials, timeout):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        have = {d["serial_number"] for d in boards()}
        if all(s in have for s in serials):
            time.sleep(0.5)  # let it finish starting
            return True
        time.sleep(0.25)
    return False


def identify_left(a, b, log):
    """Both halves follow for a moment; the one whose keys go down is the left."""
    halves = [Half(a, "first"), Half(b, "second")]
    down = {}
    lock = threading.Lock()

    def on_rows(h):
        def f(r, t):
            if any(r[9:14]):
                with lock:
                    down.setdefault(h.serial, time.monotonic())
        return f

    try:
        for h in halves:
            h.handlers[PUSH_ROWS] = on_rows(h)
            if not h.open():
                raise SystemExit(f"{h.serial} went away. Plug it back in and run this again.")
        log("\nPress and hold any key on your LEFT half (the half for your left hand) ...")
        end = time.monotonic() + 120
        while time.monotonic() < end:
            for h in halves:
                h.send(OP_FOLLOW)  # keys go to the relay only: nothing types
            with lock:
                if down:
                    first = min(down, key=down.get)
                    log("Got it. You can let go.")
                    return first
            time.sleep(0.1)
        raise SystemExit("No key press came in two minutes. Run this again when you're ready.")
    finally:
        for h in halves:
            try:
                h.send(OP_RELEASE)
            except Gone:
                pass
            h.close()


def fix_sides(found, log, interactive):
    """Make sure one half is left and the other right; set them if not. Returns the probes."""
    a, b = found
    sides = {a["side"], b["side"]}
    if sides == {"left", "right"}:
        return found
    if not interactive:
        raise SystemExit(f"The halves report sides {a['side']} and {b['side']}. Run the relay by hand to set them.")
    want = {}
    known = [x for x in found if x["side"] in ("left", "right")]
    if len(known) == 1:
        other = b if known[0] is a else a
        want[other["serial"]] = "right" if known[0]["side"] == "left" else "left"
        log(f"One half has no side yet. Setting it to {want[other['serial']]}, opposite the other half.")
    else:
        if sides == {"unknown"}:
            log("Neither half knows whether it is the left or the right one. That is normal after flash_nuke.")
        else:
            log(f"Both halves say they are the {a['side']} half.")
        left = identify_left(a["serial"], b["serial"], log)
        for x in found:
            want[x["serial"]] = "left" if x["serial"] == left else "right"
    for x in found:
        s = want.get(x["serial"])
        if not s or s == x["side"]:
            continue
        h = Half(x["serial"], "half")
        try:
            h.open()
            st = h.set_side(s)
        except (Gone, OpenFailed) as e:
            raise SystemExit(f"Couldn't set the side of {x['serial']}: {e}")
        finally:
            h.close()
        if st != 0:
            raise SystemExit(f"{x['serial']} wouldn't take the {s} side: {SET_STATUS.get(st, f'status {st}')}.")
        log(f"{x['serial']} is now the {s} half. It restarts.")
    time.sleep(1.0)
    if not wait_for([a["serial"], b["serial"]], 20):
        raise SystemExit("A half didn't come back after it restarted. Unplug it, plug it in again, and run this again.")
    end = time.monotonic() + 10
    while True:  # a half that just enumerated may not answer yet
        found = [probe(d) for d in boards() if d["serial_number"] in (a["serial"], b["serial"])]
        if len(found) == 2 and all(x["two_cable"] for x in found) or time.monotonic() > end:
            break
        time.sleep(0.5)
    if {x["side"] for x in found} != {"left", "right"}:
        raise SystemExit("The sides still aren't set: " + ", ".join(f"{x['serial']} {x['side']}" for x in found))
    log("Sides set. The halves keep them, with any firmware.")
    return found


def detect(lead_pref="right", exclude=(), log=print, interactive=True):
    """Find exactly two two-cable halves and pick the lead. Returns (lead serial, follower serial, probes)."""
    all_boards = [d for d in boards() if d["serial_number"] not in exclude]
    if not all_boards:
        raise SystemExit("No Svalboard found on USB.\n"
                         "Plug each half into the computer with its own USB cable. Each half needs the\n"
                         "two-cable firmware: a half on Vial or an older release doesn't show up here.")
    probes = [probe(d) for d in all_boards]
    errors = [p for p in probes if p["error"]]
    for p in errors:
        log(f"{p['serial']}: {p['error']}")
    if errors and any("open" in p["error"] for p in errors):
        log(open_hint())
    found = [p for p in probes if p["two_cable"]]
    others = [p for p in probes if not p["two_cable"] and not p["error"]]
    for p in others:
        log(f"{p['serial']} ({p['name']}) runs other firmware, not the two-cable firmware. Copy the two-cable file onto it.")
    if lead_pref not in ("left", "right"):  # a serial: the lead, and one other half
        found = [p for p in found if p["serial"] == lead_pref] + [p for p in found if p["serial"] != lead_pref]
    if len(found) == 0:
        raise SystemExit("No half with the two-cable firmware found.")
    if len(found) == 1:
        raise SystemExit(f"Found only one half with the two-cable firmware ({found[0]['side']}, {found[0]['serial']}).\n"
                         "Plug the other half into the computer with its own USB cable, and make sure it has the two-cable firmware.")
    if len(found) > 2:
        raise SystemExit("Found more than two halves with the two-cable firmware:\n  "
                         + "\n  ".join(f"{p['serial']} {p['side']}" for p in found)
                         + "\nUnplug the ones you don't want, or name both: --halves SERIAL SERIAL")
    found = fix_sides(found, log, interactive)
    if lead_pref in ("left", "right"):
        lead = next(p for p in found if p["side"] == lead_pref)
    else:
        lead = next(p for p in found if p["serial"] == lead_pref)
    follower = next(p for p in found if p is not lead)
    return lead["serial"], follower["serial"], dict(lead=lead, follower=follower)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", nargs="?", default="run", choices=("run", "list", "sides"),
                    help="run (the default), list, or sides")
    ap.add_argument("--lead", default="right", help="left, right (default), or a half's serial")
    ap.add_argument("--follower", help="the other half's serial (with --lead SERIAL; optional)")
    ap.add_argument("--exclude", action="append", default=[], help="never touch this serial (repeatable)")
    ap.add_argument("--halves", nargs=2, metavar="SERIAL", help="use exactly these two halves")
    a = ap.parse_args()

    if a.cmd == "list":
        found = [d for d in boards() if d["serial_number"] not in a.exclude]
        if not found:
            print("No Svalboard found on USB.")
        for d in found:
            p = probe(d)
            what = f"two-cable firmware, {p['side']} half" if p["two_cable"] else (p["error"] or "other firmware")
            print(f"{p['serial']}  {p['name']!r}  {what}")
        return

    exclude = set(a.exclude)
    if a.halves:
        exclude |= {d["serial_number"] for d in boards()} - set(a.halves)
    if a.follower and a.lead not in ("left", "right"):
        exclude |= {d["serial_number"] for d in boards()} - {a.lead, a.follower}

    if a.cmd == "sides":
        found = [p for p in (probe(d) for d in boards() if d["serial_number"] not in exclude) if p["two_cable"]]
        if len(found) != 2:
            sys.exit(f"Need exactly two halves with the two-cable firmware on USB; found {len(found)}.")
        for p in found:
            p["side"] = "unknown"  # ask again
        fix_sides(found, print, True)
        return

    lead, follower, info = detect(a.lead, exclude)
    print(f"\nRelaying. The {info['lead']['side']} half leads and the {info['follower']['side']} half follows.")
    print("Keep this window open while you type. Press Ctrl+C to stop.\n")
    relay = Relay(lead, follower, names=(f"{info['lead']['side']} half", f"{info['follower']['side']} half"))
    try:
        relay.run()
    except KeyboardInterrupt:
        pass
    finally:
        relay.shutdown()
        print("\nStopped. Each half types on its own again.")


if __name__ == "__main__":
    main()
