#!/usr/bin/env python3
"""Two-cable relay (prototype): one Svalboard, each half on its own USB cable.

The relay makes one half the lead and the other the follower (firmware built
with SVAL_TWO_CABLE=yes, keyboards/svalboard/two_cable.c in svalboard/qmk):

  follower -> relay: its key rows and pointer motion, pushed on every change
  relay -> lead:     those rows, which the lead runs through the keymap as the
                     other half's, exactly where the split link puts them

So layers, modifiers, combos, tap-hold and the pointing modes work across the
halves as they do over the split cable. Both roles are leases: if this relay
stops, the lead lets go of the other half's keys within 0.5 s and the
follower types on its own again within 0.6 s.

    py -3 two_cable_relay.py list
    py -3 two_cable_relay.py run --lead <serial> --follower <serial>

Wire: 64-byte raw HID reports, [0xDD][client:4][0xFB][op] ... (two_cable.c).
Needs hidapi (pip install hidapi).
"""
import argparse
import secrets
import sys
import threading
import time

import hid

USAGE_PAGE, USAGE = 0xFF61, 0x62
SIZE = 64
WRAP, PROTO, VIA = 0xDD, 0xFB, 0xFE
OP_FOLLOW, OP_LEAD, OP_RELEASE, OP_STATUS, OP_INJECT, OP_CAPTURE, OP_REBOOT = range(1, 8)
PUSH_ROWS, PUSH_APPLIED, PUSH_REPORT = 0x90, 0x92, 0x93
ROLE = {0: "none", 1: "lead", 2: "follower"}
SIDE = {0: "left", 1: "right", 0xFF: "unknown"}
HEARTBEAT_S = 0.1
RENEW_S = 60          # client IDs live 120 s on the board


def boards():
    return [d for d in hid.enumerate() if d.get("usage_page") == USAGE_PAGE and d.get("usage") == USAGE
            and (d.get("serial_number") or "").startswith("sval:")]


class Gone(Exception):
    pass


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
        self.renewed = 0.0

    def open(self):
        m = [d for d in boards() if d["serial_number"] == self.serial]
        if len(m) != 1:
            return False
        dev = hid.device()
        dev.open_path(m[0]["path"])
        self.dev = dev
        self.alive = True
        threading.Thread(target=self._reader, daemon=True, name=f"read-{self.name}").start()
        self.bootstrap()
        return True

    def close(self):
        self.alive = False
        try:
            if self.dev:
                self.dev.close()
        except Exception:
            pass
        self.dev = None
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
            if n != SIZE + 1:
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
            if r[0] != WRAP:
                continue
            cid = int.from_bytes(r[1:5], "little")
            if cid == 0:  # bootstrap reply: matched by nonce
                with self.cond:
                    self.replies[("boot", r[5:25])] = r
                    self.cond.notify_all()
                continue
            if cid not in self.cids:
                continue  # another app's reply on the shared endpoint
            if r[5] == PROTO and r[6] in self.handlers:
                self.handlers[r[6]](r, t)
                continue
            with self.cond:
                self.replies[(r[5], r[6])] = (r, t)
                self.cond.notify_all()
        if self.dev is dev:  # gone off USB, not closed by us
            self.alive = False
            try:
                dev.close()
            except Exception:
                pass
            self.dev = None
        else:
            return
        h = self.handlers.get("gone")
        if h:
            h(self)

    def _wait(self, key, timeout):
        end = time.monotonic() + timeout
        with self.cond:
            while key not in self.replies:
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
        self.send(op, payload)
        r, _ = self._wait((PROTO, 0x80 | op), timeout)
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
            self.replies.pop((0xDF, cmd), None)
        self.write(bytes([WRAP]) + self.cid.to_bytes(4, "little") + bytes([0xDF, cmd]) + bytes(args))
        r, _ = self._wait((0xDF, cmd), timeout)
        return r[5:]


class Relay:
    """Carries the follower's rows to the lead; holds both leases."""

    def __init__(self, lead, follower, log=print):
        self.lead, self.follower = Half(lead, "lead"), Half(follower, "follower")
        self.log = log
        self.rows = bytes(5)
        self.side = 0xFF
        self.stop = threading.Event()
        self.paused = False          # bench: stop relaying, as if the relay hung
        self.on_rows = None          # bench hooks
        self.on_applied = None
        self.on_report = None
        self.relayed = 0
        self.follower.handlers[PUSH_ROWS] = self._rows
        self.lead.handlers[PUSH_APPLIED] = lambda r, t: self.on_applied and self.on_applied(r, t)
        self.lead.handlers[PUSH_REPORT] = lambda r, t: self.on_report and self.on_report(r, t)
        self.follower.handlers["gone"] = self._follower_gone
        self.lead.handlers["gone"] = self._lead_gone

    def _lead_packet(self, seq, rows, motion=bytes(7), ack=0):
        return bytes([seq & 0xFF, self.side]) + rows + motion + bytes([ack])

    def _rows(self, r, t):
        if self.paused:
            return
        self.rows, self.side = bytes(r[9:14]), r[8]
        try:
            self.lead.send(OP_LEAD, self._lead_packet(r[7], self.rows, bytes(r[14:21])))
            self.relayed += 1
        except Gone:
            pass
        if self.on_rows:
            self.on_rows(r, t, time.perf_counter())

    def _follower_gone(self, half):
        self.log("follower gone: releasing its keys on the lead")
        self.rows = bytes(5)
        try:
            self.lead.send(OP_LEAD, self._lead_packet(0, self.rows))
            self.lead.send(OP_RELEASE)
        except Gone:
            pass

    def _lead_gone(self, half):
        self.log("lead gone: the follower types on its own")
        try:
            self.follower.send(OP_RELEASE)
        except Gone:
            pass

    def connect(self):
        for h in (self.lead, self.follower):
            if not h.alive:
                try:
                    if h.open():
                        st = h.request(OP_STATUS)
                        self.log(f"{h.name} {h.serial}: {st['side']} half")
                except Gone as e:
                    self.log(f"{h.name}: {e}")
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
        if self.lead.alive and self.follower.alive:
            try:
                self.follower.send(OP_FOLLOW)  # the follower answers with its rows: that is the lead's heartbeat
            except Gone:
                pass

    def run(self):
        while not self.stop.is_set():
            self.tick()
            self.stop.wait(HEARTBEAT_S)

    def shutdown(self):
        self.stop.set()
        for h, op in ((self.lead, OP_RELEASE), (self.follower, OP_RELEASE)):
            try:
                h.send(op)
            except Gone:
                pass
            h.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    ls = sub.add_parser("list", help="Svalboard halves on USB")
    ls.add_argument("--probe", action="append", help="also ask this serial for its side and role")
    r = sub.add_parser("run", help="relay until Ctrl+C")
    r.add_argument("--lead", required=True, help="serial of the half that runs the keymap")
    r.add_argument("--follower", required=True, help="serial of the other half")
    a = ap.parse_args()
    if a.cmd == "list":
        # Lists only: nothing is sent to any board unless its serial is named.
        for d in boards():
            line = f"{d['serial_number']}  {d['product_string']!r}"
            if d["serial_number"] in (a.probe or []):
                h = Half(d["serial_number"], d["product_string"])
                try:
                    h.open()
                    st = h.request(OP_STATUS)
                    line += f"  {st['side']}  role {st['role']}"
                except Gone:
                    line += "  (no two-cable support)"
                finally:
                    h.close()
            print(line)
        return
    if a.lead == a.follower:
        sys.exit("lead and follower must be different halves")
    relay = Relay(a.lead, a.follower)
    try:
        relay.run()
    except KeyboardInterrupt:
        pass
    finally:
        relay.shutdown()


if __name__ == "__main__":
    main()
