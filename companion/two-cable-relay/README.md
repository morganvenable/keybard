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

## Always on

Windows (PowerShell, in the folder with the script):

```
py -3 two_cable_relay.py install --halves SERIAL SERIAL
```

`install` copies the script to `%LOCALAPPDATA%\Svalboard\two-cable-relay\`,
adds a shortcut to the Startup folder that runs it with `pythonw` (no window),
and starts it now. `--halves` pins the two halves (serials from `list`); without
it the relay picks the only two two-cable halves on USB. `uninstall` stops it
and removes the shortcut; `stop` stops it until the next login.

What runs is `supervise`: it starts `run --service` and starts it again 0.5 s
after it exits for any reason. Only one supervisor runs at a time (a lock file).
The service relay never asks anything and never exits for a missing half: it
waits for both halves, then relays, and opens a half again whenever it leaves
USB, restarts, stops answering for 2 s (as after the computer sleeps), or
forgets the relay's client ID.

- Log: `relay.log` in that folder (1 MB, three old copies kept).
- Status: `status.json` in that folder, rewritten on every change and at least
  every 5 s: `state` is `relaying`, `connecting`, `waiting` (a half is off
  USB), `looking` (the halves aren't both found yet), `cable` (the split cable
  works), `conflict` (another relay has the halves), `restarting` or `stopped`, with `detail`, `since`, `updated` (Unix
  seconds), `pid`, `lead`, `follower` and `relayed`. An `updated` older than
  about 15 s means no relay is running.
- The lead half shows an amber double blip every 3 s when its relay lease has
  lapsed for 3 s (the relay stopped without letting go), until a relay or the
  split cable takes over.

Mac (untested): `install` copies the script to
`~/Library/Application Support/Svalboard/two-cable-relay/` and stops there. A
LaunchAgent starts it at login and restarts it if it exits, so it needs no
`supervise`. Save this as
`~/Library/LaunchAgents/com.svalboard.two-cable-relay.plist`, with the paths
of your virtual environment's Python and the copied script:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.svalboard.two-cable-relay</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/YOU/sval-relay/bin/python</string>
    <string>/Users/YOU/Library/Application Support/Svalboard/two-cable-relay/two_cable_relay.py</string>
    <string>run</string>
    <string>--service</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>1</integer>
</dict>
</plist>
```

Then `launchctl load ~/Library/LaunchAgents/com.svalboard.two-cable-relay.plist`.
`stop` there makes the relay exit, and launchd starts it again; unload the
agent instead.

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
