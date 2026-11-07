#!/usr/bin/env bash
# Start Keybard Overlay on Linux from this folder. Needs python3 with venv and internet on the first run
# (it downloads Qt into ./.venv). Nothing is installed system-wide.
set -euo pipefail
cd "$(dirname "$0")"

if ! python3 -c 'import venv, ensurepip' 2>/dev/null; then
    echo "python3 with venv is missing. On Ubuntu/Debian: sudo apt install python3-venv" >&2
    exit 1
fi
[ -x .venv/bin/python ] || { rm -rf .venv; python3 -m venv .venv; }
.venv/bin/python -m pip install -q -r requirements.txt

# Qt needs a few system libraries; name the ones missing instead of failing with a Qt abort.
plugin=$(.venv/bin/python -c 'import PySide6, os; print(os.path.join(os.path.dirname(PySide6.__file__), "Qt/plugins/platforms/libqxcb.so"))')
missing=$(ldd "$plugin" 2>/dev/null | awk '/not found/ {print $1}' | sort -u | tr '\n' ' ')
if [ -n "$missing" ]; then
    echo "Qt needs system libraries that are missing: $missing" >&2
    echo "On Ubuntu/Debian try: sudo apt install libxcb-cursor0 libxkbcommon-x11-0 libegl1 libxcb-icccm4 libxcb-keysyms1 libxcb-shape0" >&2
fi

# The board is read through /dev/hidraw*: see install-udev-rule.sh (once, then replug).
if ! ls /dev/hidraw* >/dev/null 2>&1; then
    echo "No /dev/hidraw device yet: plug the board in." >&2
fi
[ -f /etc/udev/rules.d/60-svalboard.rules ] || echo "Board permission rule not installed: run  sudo ./install-udev-rule.sh  once and replug the board." >&2

# Wayland does not let an app keep its window on top or place it, so run through XWayland when there is one.
# QT_QPA_PLATFORM, when already set, wins. Start with --wayland to try native Wayland.
if [ -z "${QT_QPA_PLATFORM:-}" ]; then
    if [ "${1:-}" = "--wayland" ]; then shift; export QT_QPA_PLATFORM=wayland
    elif [ -n "${DISPLAY:-}" ]; then export QT_QPA_PLATFORM=xcb; fi
fi
if [ -n "${WAYLAND_DISPLAY:-}" ] && [ "${QT_QPA_PLATFORM:-}" != wayland ]; then
    echo "Wayland session: Shift and AltGr come from the board's firmware (x4.5 or newer); the computer's keys can't be read here." >&2
fi
exec .venv/bin/python -m keybard_host "$@"
