"""What a new Overlay start does when another Overlay already holds the single-instance lock.

Same build: show the running one's controls. Another build: ask it to quit (localhost only,
with its session token), wait for the lock, then start. If it can't be asked or doesn't let
go, say so plainly and exit, so nobody keeps testing an old build without knowing.
No process is ever killed by name.
"""
import json
import time
from collections import namedtuple
from urllib.request import Request, urlopen
from .build import build_label

REFUSED = 3  # exit code of a start that refused; the start scripts show the message
Outcome = namedtuple('Outcome', 'action message')  # action: 'open', 'start' or 'refuse'


def refusal(running):
    return (f'Another Keybard Overlay ({"an older build" if not running or running.get("version") in (None, "unknown") else build_label(running)}) is running. '
            'Quit it from its tray icon, then start this one again.')


def same_build(a, b):
    return all(a.get(k) == b.get(k) for k in ('version', 'keybardCommit', 'testBuild'))


def fetch_bootstrap(url, timeout=2):
    """The running host's bootstrap (build and session token), or None if it doesn't answer."""
    try:
        with urlopen(url + 'api/host/bootstrap', timeout=timeout) as r: data = json.load(r)
        return data if isinstance(data, dict) else None
    except (OSError, ValueError): return None


def ask_to_quit(url, token, timeout=3):
    """True if the running host accepted. A host from before this existed answers 404."""
    request = Request(url + 'api/host/quit', data=b'{}', headers={'X-Keybard-Token': token or '', 'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=timeout) as r: return r.status == 202
    except (OSError, ValueError): return False


def hand_off(url, mine, try_lock, fetch=fetch_bootstrap, ask=ask_to_quit, wait=10.0, sleep=time.sleep):
    """mine: this build's build_info(). try_lock(): one short attempt at the lock, True if taken."""
    running = fetch(url)
    if running is None: return Outcome('refuse', refusal(None))
    theirs = {'version': running.get('version') if isinstance(running.get('version'), str) else 'unknown',
              'keybardCommit': running.get('keybardCommit'), 'testBuild': running.get('testBuild') is True}
    if theirs['version'] != 'unknown' and same_build(mine, theirs): return Outcome('open', '')
    if not ask(url, running.get('token')): return Outcome('refuse', refusal(theirs))
    deadline = time.monotonic() + wait
    while True:
        if try_lock(): return Outcome('start', '')
        if time.monotonic() >= deadline: return Outcome('refuse', refusal(theirs))
        sleep(0.2)
