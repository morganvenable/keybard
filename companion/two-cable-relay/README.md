# Two-cable relay (prototype)

One Svalboard, each half on its own USB cable to the computer, no split cable.
This relay makes one half the **lead** (it runs the keymap for both halves) and
the other the **follower** (it only reports its keys and pointer motion). The
follower's keys reach the lead's keymap where the split link would put them,
so layers, modifiers, combos, tap-hold and pointing modes work across halves.

Needs firmware built with `SVAL_TWO_CABLE=yes` on both halves
(`feat/two-cable-x4.4` in morganvenable/sval-qmk; see
`keyboards/svalboard/docs/two-cable.md` there) and Python 3.8 or later with
hidapi. The script is one file: `two_cable_relay.py`.

Mac (Terminal, in the folder with the script):

```
python3 -m venv sval-relay
sval-relay/bin/pip install hidapi
sval-relay/bin/python two_cable_relay.py
```

Windows (PowerShell):

```
py -3 -m pip install hidapi
py -3 two_cable_relay.py
```

With no arguments it finds the two halves, checks that one is left and one is
right, and relays until Ctrl+C. The right half leads; `--lead left` makes the
left half lead. If a half has no side (after flash_nuke) or both claim the same
one, it asks for a key press on the left half and stores the sides (Sval
`0x33`, source HOST), which normal firmware keeps too.

- `list` shows the halves on USB and their firmware and side.
- `sides` asks for the left half again and stores both sides.
- `--exclude SERIAL` never touches that board (repeatable); `--halves A B`
  uses exactly those two.

If the relay stops, the lead lets go of the follower's keys within 0.5 s and the
follower types on its own again within 0.6 s. If the split cable works, the
halves refuse the relay (status 3) and it says so.

`two_cable_bench.py` is the hardware test: it captures the lead's reports so
nothing types, presses keys by injection, measures latency and the failure
cases, and (with auto-detect) runs this script as its own process and kills it.

## Platform notes

- hidapi wheels exist for Python 3.8-3.14 on Windows, Linux, and macOS (Intel
  and Apple Silicon), so `pip install hidapi` doesn't compile anything.
- macOS: the raw HID interface uses a vendor usage page (0xFF61), so it should
  need no Input Monitoring permission; that permission covers keyboard and
  mouse interfaces. hidapi opens devices exclusively on macOS by default, so
  Keybard can't connect to the halves while the relay runs. Not yet tried on
  a Mac.
- The virtual environment keeps hidapi apart from Homebrew's Python (which
  refuses `pip install` outside one) and from the unrelated `hid` package.

This is a prototype outside Keybard Overlay. The recommended home is Keybard
Overlay, which already runs at login and talks to the board.
