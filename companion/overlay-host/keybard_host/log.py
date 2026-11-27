"""Timestamped lines about the overlay's health: to the console, and to overlay.log in the
Host's data folder, so a vanished overlay leaves a trace after the console is gone.
Never an address, a window title or anything typed."""
import sys
import time
from pathlib import Path

LIMIT = 512 * 1024  # bytes; the older half moves to overlay.log.1
_file = None


def set_file(path):
    global _file
    _file = Path(path) if path else None


def log(message):
    line = f'{time.strftime("%Y-%m-%d %H:%M:%S")} {message}'
    try: print(line, file=sys.stderr, flush=True)
    except (OSError, UnicodeError, AttributeError): pass  # pythonw: no console
    if _file is None: return
    try:
        if _file.exists() and _file.stat().st_size > LIMIT: _file.replace(_file.with_name(_file.name + '.1'))
        with _file.open('a', encoding='utf-8') as f: f.write(line + '\n')
    except OSError: pass
