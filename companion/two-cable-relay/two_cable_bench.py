#!/usr/bin/env python3
"""Bench test of the two-cable relay on two test-board halves (prototype builds only).

Nothing reaches the computer as typing: the lead's keyboard, mouse and media
reports are captured and sent to this script instead (two_cable.c OP_CAPTURE),
keys are pressed by injection (OP_INJECT), and the capture drains for a second
before it hands reports back. Writes bench.json next to --out.

    py -3 two_cable_bench.py --lead <serial> --follower <serial> --out <dir>
"""
import argparse
import json
import random
import statistics
import threading
import time
from pathlib import Path

from two_cable_relay import (OP_CAPTURE, OP_INJECT, OP_REBOOT, OP_STATUS, Gone, Relay)

ROWS = 5


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))]


def summary(xs):
    return dict(n=len(xs), p50=round(pct(xs, 50), 2), p90=round(pct(xs, 90), 2), p95=round(pct(xs, 95), 2), p99=round(pct(xs, 99), 2),
                max=round(max(xs), 2), mean=round(statistics.mean(xs), 2)) if xs else None


class Bench:
    def __init__(self, lead, follower):
        self.relay = Relay(lead, follower, log=self.log)
        self.logs = []
        self.reports = []      # (host time, kind, bytes)
        self.applied = []      # (host time, seq, layer_state, mods, weak, oneshot)
        self.pushes = {}       # seq -> (arrive, written, rows)
        self.cv = threading.Condition()
        self.capture_on = False
        self.relay.on_report = self._report
        self.relay.on_applied = self._applied
        self.relay.on_rows = self._rows
        self.lead_inject = [0] * ROWS

    def log(self, *a):
        line = " ".join(str(x) for x in a)
        self.logs.append(line)
        print(line, flush=True)

    # ---- events from the boards
    def _report(self, r, t):
        n = r[12]
        with self.cv:
            self.reports.append((t, r[7], bytes(r[13:13 + n])))
            self.cv.notify_all()

    def _applied(self, r, t):
        with self.cv:
            self.applied.append((t, r[7], int.from_bytes(r[8:12], "little"), r[16], r[17], r[18]))
            self.cv.notify_all()

    def _rows(self, r, arrive, written):
        with self.cv:
            self.pushes[r[7]] = (arrive, written, bytes(r[9:14]))
            self.cv.notify_all()

    def poll(self, fn, timeout):
        """fn() until truthy, without holding the event lock (fn may talk to a board)."""
        end = time.perf_counter() + timeout
        while time.perf_counter() < end:
            try:
                v = fn()
            except Gone:
                v = None
            if v:
                return v
            time.sleep(0.05)
        return None

    def wait(self, pred, timeout=1.0):
        end = time.perf_counter() + timeout
        with self.cv:
            while True:
                v = pred()
                if v:
                    return v
                left = end - time.perf_counter()
                if left <= 0:
                    return None
                self.cv.wait(left)

    # ---- the board side
    def keep_capture(self):
        while self.capture_on:
            try:
                self.relay.lead.send(OP_CAPTURE, bytes([1]))
            except Gone:
                pass
            time.sleep(0.3)

    def start(self):
        self.relay.connect()
        if not (self.relay.lead.alive and self.relay.follower.alive):
            raise SystemExit("both halves must be on USB")
        self.capture_on = True
        self.relay.lead.request(OP_CAPTURE, bytes([1]))
        threading.Thread(target=self.keep_capture, daemon=True).start()
        st = self.relay.lead.request(OP_STATUS)
        if not st["capture"]:
            raise SystemExit("the lead did not start capturing; stopping before any key is pressed")
        threading.Thread(target=self.relay.run, daemon=True).start()
        if not self.poll(lambda: self.relay.lead.request(OP_STATUS)["role"] == "lead", 2):
            raise SystemExit("no lead")
        self.log("relay up; lead capturing")

    def follower_keys(self, held, dx=0, dy=0):
        rows = bytearray(ROWS)
        for r, c in held:
            rows[r] |= 1 << c
        self.relay.follower.send(OP_INJECT, bytes(rows) + int(dx).to_bytes(2, "little", signed=True)
                                 + int(dy).to_bytes(2, "little", signed=True))

    def lead_key(self, r, c, down):
        st = self.relay.lead.request(OP_STATUS)
        if not st["capture"]:
            raise SystemExit("capture lost: no lead key pressed")
        if down:
            self.lead_inject[r] |= 1 << c
        else:
            self.lead_inject[r] &= ~(1 << c)
        self.relay.lead.send(OP_INJECT, bytes(self.lead_inject))

    # ---- keymap
    def read_keymap(self):
        lead = self.relay.lead
        layers = lead.via(0x11)[1]
        km = {}
        for layer in range(layers):
            for row in range(10):
                for col in range(6):
                    r = lead.via(0x04, bytes([layer, row, col]))
                    km[(layer, row, col)] = (r[4] << 8) | r[5]
        return layers, km

    def combos(self):
        out, i = [], 0
        while True:
            r = self.relay.lead.sval(0x21, bytes([1, i & 0xFF, i >> 8]))
            if not r[3]:
                return out
            idx = r[4] | (r[5] << 8)
            e = r[6:18]
            inputs = [int.from_bytes(e[k:k + 2], "little") for k in range(0, 8, 2)]
            out.append(dict(index=idx, inputs=[x for x in inputs if x], output=int.from_bytes(e[8:10], "little"),
                            term=int.from_bytes(e[10:12], "little")))
            i = idx + 1

    def combo_raw(self, idx):
        return bytes(self.relay.lead.sval(0x03, bytes([idx & 0xFF, idx >> 8]))[4:16])

    def put_combo_raw(self, idx, e):
        return self.relay.lead.sval(0x04, bytes([idx & 0xFF, idx >> 8]) + bytes(e))

    def set_combo(self, idx, inputs, output, term=0x8000):  # bit 15: enabled; timing 0: the board's combo term
        e = b"".join(k.to_bytes(2, "little") for k in (inputs + [0, 0, 0, 0])[:4]) + output.to_bytes(2, "little") + term.to_bytes(2, "little")
        return self.relay.lead.sval(0x04, bytes([idx & 0xFF, idx >> 8]) + e)

    # ---- helpers on captured reports
    def mark(self):
        with self.cv:
            return len(self.reports)

    def keys_since(self, m):
        """Every (mods, set of keycodes) keyboard state captured since mark m."""
        out = []
        with self.cv:
            for t, kind, b in self.reports[m:]:
                if kind == 1:
                    out.append((b[0], {k for k in b[1:] if k}))
                elif kind == 2:
                    out.append((b[0], {i for i in range(len(b) * 8 - 8) if b[1 + i // 8] & (1 << (i % 8))}))
        return out

    def mouse_since(self, m):
        with self.cv:
            out = []
            for t, kind, b in self.reports[m:]:
                if kind == 3:
                    g = lambda o: int.from_bytes(b[o:o + 2], "little", signed=True)
                    out.append(dict(buttons=b[0], x=g(1), y=g(3), h=g(5), v=g(7)))
            return out

    def stop(self):
        self.capture_on = False
        self.relay.shutdown()


def kc_name(k):
    return f"0x{k:04X}"


def resolve(km, layer, pos):
    """The keycode at pos on this layer, falling through KC_TRNS (0x0001) to layer 0."""
    for l in (layer, 0):
        k = km[(l,) + pos]
        if k != 0x0001:
            return k
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lead", required=True)
    ap.add_argument("--follower", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("-n", type=int, default=300)
    a = ap.parse_args()
    out = Path(a.out)
    res = {}
    b = Bench(a.lead, a.follower)
    b.start()
    try:
        fside = b.relay.follower.request(OP_STATUS)["side"]
        lside = b.relay.lead.request(OP_STATUS)["side"]
        res["sides"] = dict(lead=lside, follower=fside)
        f0 = 0 if fside == "left" else 5          # follower rows in the keymap
        l0 = 5 if fside == "left" else 0
        layers, km = b.read_keymap()
        res["layers"] = layers
        fpos = [(r, c) for r in range(5) for c in range(6)]
        basic = lambda k: 0x04 <= k <= 0x1D        # letters
        f_letters = [p for p in fpos if basic(km[(0, f0 + p[0], p[1])])]
        l_letters = [p for p in fpos if basic(km[(0, l0 + p[0], p[1])])]
        f_mo = [p for p in fpos if 0x5220 <= km[(0, f0 + p[0], p[1])] <= 0x523F]
        f_lt = [p for p in fpos if 0x4000 <= km[(0, f0 + p[0], p[1])] <= 0x4FFF]
        f_mod = [p for p in fpos if 0xE0 <= km[(0, f0 + p[0], p[1])] <= 0xE7]
        f_mt = [p for p in fpos if 0x2000 <= km[(0, f0 + p[0], p[1])] <= 0x3FFF]
        res["follower_layer0"] = {f"{r},{c}": kc_name(km[(0, f0 + r, c)]) for r, c in fpos}
        res["lead_layer0"] = {f"{r},{c}": kc_name(km[(0, l0 + r, c)]) for r, c in fpos}
        b.log("follower letters", len(f_letters), "MO", f_mo, "LT", f_lt, "mods", f_mod, "MT", f_mt)

        # ---- 1. latency: a follower letter, pressed and released n times
        fk = f_letters[0]
        lat = dict(push=[], host=[], lead=[], est=[], total=[])
        for i in range(a.n):
            for down in (True, False):
                t0 = time.perf_counter()
                want = 1 << fk[1] if down else 0
                b.follower_keys([fk] if down else [])
                hit = b.wait(lambda: min(((v[0], s) for s, v in b.pushes.items() if v[0] > t0 and (v[2][fk[0]] & (1 << fk[1])) == want), default=None), 1)
                if hit is None:
                    b.log("latency: no push", i, down)
                    continue
                got = hit[1]
                arrive, written, _ = b.pushes[got]
                ap_ = b.wait(lambda: next((x for x in b.applied if x[0] > written and x[1] == got), None), 1)
                if ap_ is None:
                    b.log("latency: no applied", i, down)
                    continue
                lat["push"].append((arrive - t0) * 1e3)
                lat["host"].append((written - arrive) * 1e3)
                lat["lead"].append((ap_[0] - written) * 1e3)
                lat["total"].append((ap_[0] - t0) * 1e3)  # inject -> follower -> relay -> lead -> applied report back
                # one way follower->host is about half its round trip; host->lead and its key handling about half the lead's
                lat["est"].append(((arrive - t0) / 2 + (written - arrive) + (ap_[0] - written) / 2) * 1e3)
                time.sleep(random.uniform(0.01, 0.03))
        res["latency_ms"] = {k: summary(v) for k, v in lat.items()}
        b.log("latency", json.dumps(res["latency_ms"]))
        m = b.mark()
        time.sleep(0.2)
        typed = {k for _, ks in b.keys_since(0) for k in ks}
        res["latency_letter"] = dict(follower_key=list(fk), keycode=kc_name(km[(0, f0 + fk[0], fk[1])]),
                                     captured_keycodes=sorted(kc_name(k) for k in typed))

        def tap_lead(pos, hold=0.03):
            b.lead_key(*pos, True)
            time.sleep(hold)
            b.lead_key(*pos, False)

        # ---- 2. layer held on the follower, key tapped on the lead
        layer_key = (f_mo or f_lt or [None])[0]
        if layer_key:
            k = km[(0, f0 + layer_key[0], layer_key[1])]
            n = (k & 0x1F) if 0x5220 <= k <= 0x523F else (k >> 8) & 0xF
            cand = [p for p in fpos if resolve(km, n, (l0 + p[0], p[1])) not in (0, km[(0, l0 + p[0], p[1])])
                    and resolve(km, n, (l0 + p[0], p[1])) < 0x0100]
            lp = cand[0] if cand else l_letters[0]
            expect = resolve(km, n, (l0 + lp[0], lp[1]))
            m = b.mark()
            b.follower_keys([layer_key])
            time.sleep(0.35)  # past any tapping term: a held layer
            layer_seen = b.applied[-1][2] if b.applied else None  # at the press: before the hold resolves
            tap_lead(lp)
            time.sleep(0.05)
            b.follower_keys([])
            time.sleep(0.3)
            got = {k for _, ks in b.keys_since(m) for k in ks}
            res["layer"] = dict(follower_key=list(layer_key), keycode=kc_name(k), layer=n, lead_key=list(lp),
                                layer_state=layer_seen, expect=kc_name(expect), captured=sorted(kc_name(x) for x in got),
                                base=kc_name(km[(0, l0 + lp[0], lp[1])]),
                                note="layer_state is the lead's report when the press was applied, before the hold resolved",
                                ok=expect in got and km[(0, l0 + lp[0], lp[1])] not in got)
            b.log("layer", res["layer"])

        # ---- 3. modifier held on the follower, letter tapped on the lead
        mod_key = (f_mod or f_mt or [None])[0]
        if mod_key:
            k = km[(0, f0 + mod_key[0], mod_key[1])]
            bits = (1 << (k - 0xE0)) if k <= 0xE7 else (((k >> 8) & 0xF) << (4 if k & 0x1000 else 0))
            lp = l_letters[0]
            m = b.mark()
            b.follower_keys([mod_key])
            time.sleep(0.35)
            tap_lead(lp)
            time.sleep(0.05)
            b.follower_keys([])
            time.sleep(0.3)
            states = b.keys_since(m)
            letter = km[(0, l0 + lp[0], lp[1])]
            res["mod"] = dict(follower_key=list(mod_key), keycode=kc_name(k), lead_key=list(lp), letter=kc_name(letter),
                              states=[[mo, sorted(kc_name(x) for x in ks)] for mo, ks in states],
                              ok=any(letter in ks and (mo & bits) for mo, ks in states))
            b.log("mod", res["mod"])

        # ---- 4. tap-hold on the follower, tapped
        th = (f_lt or f_mt or [None])[0]
        if th:
            k = km[(0, f0 + th[0], th[1])]
            m = b.mark()
            b.follower_keys([th])
            time.sleep(0.03)
            b.follower_keys([])
            time.sleep(0.4)
            got = {x for _, ks in b.keys_since(m) for x in ks}
            res["tap_hold_tap"] = dict(follower_key=list(th), keycode=kc_name(k), expect=kc_name(k & 0xFF),
                                       captured=sorted(kc_name(x) for x in got), ok=(k & 0xFF) in got)
            b.log("tap-hold tap", res["tap_hold_tap"])

        # ---- 5. a combo across the halves
        combos = b.combos()
        res["combos_on_board"] = len(combos)
        where = {}
        for (layer, row, col), kc in km.items():
            if layer == 0:
                where.setdefault(kc, (row, col))
        span = None
        for c in combos:
            if len(c["inputs"]) == 2 and all(x in where for x in c["inputs"]):
                hands = {where[x][0] >= 5 for x in c["inputs"]}
                if len(hands) == 2:
                    span = c
                    break
        temp = None
        if not span:
            used = {c["index"] for c in combos}
            temp = next(i for i in range(256) if i not in used)
            fkc = km[(0, f0 + f_letters[1][0], f_letters[1][1])]
            lkc = km[(0, l0 + l_letters[1][0], l_letters[1][1])]
            saved = b.combo_raw(temp)
            b.set_combo(temp, [fkc, lkc], 0x68)  # F13, captured, never typed
            span = dict(index=temp, inputs=[fkc, lkc], output=0x68, temporary=True)
        fin = next(x for x in span["inputs"] if (where[x][0] >= 5) == (f0 == 5))
        lin = next(x for x in span["inputs"] if x != fin)
        fp = (where[fin][0] - f0, where[fin][1])
        lp = (where[lin][0] - l0, where[lin][1])
        m = b.mark()
        b.follower_keys([fp])
        time.sleep(0.01)
        b.lead_key(*lp, True)
        time.sleep(0.05)
        b.lead_key(*lp, False)
        b.follower_keys([])
        time.sleep(0.4)
        got = {x for _, ks in b.keys_since(m) for x in ks}
        res["combo"] = dict(span, follower_key=list(fp), lead_key=list(lp), captured=sorted(kc_name(x) for x in got),
                            ok=span["output"] in got and fin not in got and lin not in got)
        b.log("combo", res["combo"])
        if temp is not None:
            b.put_combo_raw(temp, saved)
            res["combo"]["restored"] = b.combo_raw(temp) == saved and not any(c["index"] == temp for c in b.combos())

        # ---- 6. pointer motion from the follower
        m = b.mark()
        for _ in range(10):
            b.follower_keys([], dx=40, dy=-25)
            time.sleep(0.02)
        time.sleep(0.3)
        mv = b.mouse_since(m)
        res["pointer"] = dict(sent=[400, -250], steps=10, captured_xy=[sum(x["x"] for x in mv), sum(x["y"] for x in mv)],
                              captured_hv=[sum(x["h"] for x in mv), sum(x["v"] for x in mv)], reports=len(mv),
                              ok=any(x["x"] or x["y"] or x["h"] or x["v"] for x in mv),
                              note="raw counts after the follower's rotation; the lead applies the follower hand's pointing mode (scroll, sniper) and scaling")
        b.log("pointer", res["pointer"])

        # ---- 7. the relay stops (hung or quit) with a follower key held
        fk_kc = km[(0, f0 + fk[0], fk[1])]
        m = b.mark()
        b.follower_keys([fk])
        b.wait(lambda: any(fk_kc in ks for _, ks in b.keys_since(m)), 1)
        t0 = time.perf_counter()
        b.relay.paused = True
        rel = b.wait(lambda: next((t for t, kind, by in b.reports[m:] if t > t0 and kind in (1, 2) and not any(by[1:])), None), 2)
        res["relay_stops"] = dict(release_after_ms=round((rel - t0) * 1e3, 1) if rel else None)
        time.sleep(0.5)
        fst = b.relay.follower.request(OP_STATUS)
        res["relay_stops"]["follower_role_after_1s"] = fst["role"]
        b.relay.paused = False
        b.follower_keys([])
        time.sleep(0.3)
        b.log("relay stops", res["relay_stops"])

        # ---- 8. the follower drops off USB with a key held
        m = b.mark()
        b.follower_keys([fk])
        b.wait(lambda: any(fk_kc in ks for _, ks in b.keys_since(m)), 1)
        t0 = time.perf_counter()
        b.relay.follower.send(OP_REBOOT)
        rel = b.wait(lambda: next((t for t, kind, by in b.reports[m:] if t > t0 and kind in (1, 2) and not any(by[1:])), None), 3)
        time.sleep(0.5)
        back = b.poll(lambda: b.relay.follower.alive and b.relay.lead.request(OP_STATUS)["role"] == "lead" and time.perf_counter(), 10)
        res["follower_unplugged"] = dict(release_after_ms=round((rel - t0) * 1e3, 1) if rel else None,
                                         relayed_again_after_s=round(back - t0, 2) if back else None,
                                         note="simulated by a reboot: the half leaves USB and enumerates again")
        b.log("follower unplugged", res["follower_unplugged"])

        # ---- 9. the lead drops off USB (last: it ends the capture)
        t0 = time.perf_counter()
        b.capture_on = False
        b.relay.lead.send(OP_REBOOT)
        # The follower can miss a reply while the lead re-enumerates: poll, never one read.
        own = b.poll(lambda: b.relay.follower.request(OP_STATUS)["role"] != "follower" and time.perf_counter(), 3)
        back = b.poll(lambda: b.relay.lead.alive and b.relay.follower.request(OP_STATUS)["role"] == "follower" and time.perf_counter(), 15)
        res["lead_unplugged"] = dict(follower_on_its_own_after_ms=round((own - t0) * 1e3, 1) if own else None,
                                     paired_again_after_s=round(back - t0, 2) if back else None,
                                     note="simulated by a reboot; the reboot fires 100 ms after the command")
        b.log("lead unplugged", res["lead_unplugged"])
    finally:
        b.stop()
        out.mkdir(parents=True, exist_ok=True)
        res["log"] = b.logs
        (out / "bench.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
        print("wrote", out / "bench.json")


if __name__ == "__main__":
    main()
