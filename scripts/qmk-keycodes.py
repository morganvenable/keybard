#!/usr/bin/env python3
"""Write Keybard's numbering for one QMK keycode version from QMK's own keycode data.

Run inside a QMK Python environment (the one `qmk` uses):

    python3 scripts/qmk-keycodes.py <path to sval-qmk checkout> 0.0.9

Writes src/constants/qmk-keycodes/<version>.json: every explicitly numbered
keycode with its QMK name and aliases. Composed ranges (mod-taps, layer keys,
tap dances...) are not listed; their encoding comes from the range bases, which
the test in tests/services/keycode-numbering.test.ts holds Keybard to.
"""
import json
import pathlib
import sys

qmk_home = pathlib.Path(sys.argv[1]).resolve()
version = sys.argv[2]
sys.path.insert(0, str(qmk_home / 'lib' / 'python'))

import os  # noqa: E402

os.chdir(qmk_home)
from qmk.keycodes import load_spec  # noqa: E402

spec = load_spec(version)
out = {
    'version': version,
    'ranges': {name: value['define'] for name, value in sorted(spec['ranges'].items())},
    'keycodes': {
        f'0x{int(code, 16):04X}': [kc['key'], *kc.get('aliases', [])]
        for code, kc in sorted(spec['keycodes'].items(), key=lambda item: int(item[0], 16))
    },
}
target = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'constants' / 'qmk-keycodes' / f'{version}.json'
target.write_text(json.dumps(out, indent=1) + '\n', encoding='utf-8')
print(f'{target}: {len(out["keycodes"])} keycodes')
