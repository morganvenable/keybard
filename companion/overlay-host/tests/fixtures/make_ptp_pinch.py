"""Writes ptp-pinch.jsonl: native touchpad input reports for a pinch across both pads.

The reports are packed in the firmware's input report layout (ptp.c, checked
against the descriptor by keyboards/svalboard/tools/multitouch/ptp_hid.py): one
finger on each pad, spreading apart for 0.6 s, then closing for 0.6 s, at the
pads' 8 ms period. The first line is a report read from the touchpad test
board itself (GET_REPORT input 1, idle: one lifted contact), so the replay
starts from a real report.

    py -3 tests/fixtures/make_ptp_pinch.py
"""
import json
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
REAL_IDLE = '0101091e0ab806000000000000000000000000000000000000000000000000533b0100'


def pack(contacts, count, scan, buttons=0):
    """contacts: [(id, x, y, tip, confidence)], at most 5."""
    b = bytearray(35)
    b[0] = 1
    for i, (cid, x, y, tip, conf) in enumerate(contacts):
        struct.pack_into('<BBHH', b, 1 + 6 * i, (1 if conf else 0) | (2 if tip else 0), cid, x, y)
    struct.pack_into('<H', b, 31, scan & 0xFFFF)
    b[33], b[34] = count, buttons
    return bytes(b)


def pinch():
    rows, t, scan = [(0.0, bytes.fromhex(REAL_IDLE))], 0.2, 0
    steps = 75

    def frame(lx, rx, tip=True):
        nonlocal t, scan
        rows.append((round(t, 3), pack([(0, lx, 900, tip, True), (1, rx, 880, tip, True)], 2, scan)))
        t += 0.008
        scan += 80  # 8 ms in 100 us units
    for i in range(steps):          # spread apart
        f = i / (steps - 1)
        frame(int(1700 - 1200 * f), int(2900 + 1300 * f))
    for i in range(steps):          # and back together
        f = i / (steps - 1)
        frame(int(500 + 1200 * f), int(4200 - 1300 * f))
    frame(1700, 2900, tip=False)    # both lift
    return rows


if __name__ == '__main__':
    out = HERE / 'ptp-pinch.jsonl'
    with out.open('w', encoding='utf-8', newline='\n') as f:
        f.write('# Native touchpad input reports (report 1, 35 bytes): t in s, hex. See make_ptp_pinch.py.\n')
        for t, r in pinch():
            f.write(json.dumps(dict(t=t, hex=r.hex())) + '\n')
    print(out)
