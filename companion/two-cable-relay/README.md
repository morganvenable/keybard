# Two-cable relay (prototype)

One Svalboard, each half on its own USB cable to the computer, no split cable.
This relay makes one half the **lead** (it runs the keymap for both halves) and
the other the **follower** (it only reports its keys and pointer motion). The
follower's keys reach the lead's keymap where the split link would put them,
so layers, modifiers, combos, tap-hold and pointing modes work across halves.

Needs firmware built with `SVAL_TWO_CABLE=yes` on both halves
(`feat/two-cable-pair` in morganvenable/sval-qmk; see
`keyboards/svalboard/docs/two-cable.md` there) and Python with hidapi.

```
py -3 -m pip install hidapi
py -3 two_cable_relay.py list
py -3 two_cable_relay.py run --lead <serial> --follower <serial>
```

`list` sends nothing to any board; `list --probe <serial>` asks that half for
its side and role.

If the relay stops, the lead lets go of the follower's keys within 0.5 s and the
follower types on its own again within 0.6 s.

`two_cable_bench.py` is the hardware test: it captures the lead's reports so
nothing types, presses keys by injection, and measures latency and the
failure cases.

This is a prototype outside Keybard Overlay. The recommended home is Keybard
Overlay, which already runs at login and talks to the board.
