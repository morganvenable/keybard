"""Touch contacts on the native touchpad (demo): recorded reports in, contacts out.

The recording (fixtures/ptp-pinch.jsonl) is a pinch across both pads in the
firmware's report layout; its first report was read from the touchpad test
board. The events these reports produce are what the overlay draws; the same
events are in fixtures/ptp-pinch-events.json, which Keybard's overlay test
replays (tests/trainer/touch-contacts.test.tsx), so both ends see one stream.
"""
import json
import struct
from pathlib import Path
import unittest

from keybard_host import touch
from keybard_host.touch import ContactTracker, decode, load_recording, overlay_detail, pad_of, parse_rawinput, same_device

FIXTURES = Path(__file__).resolve().parent / 'fixtures'
RECORDING = FIXTURES / 'ptp-pinch.jsonl'
EVENTS = FIXTURES / 'ptp-pinch-events.json'


def events_from(rows):
    clock = [0.0]
    tracker = ContactTracker(clock=lambda: clock[0])
    out = []
    for t, report in rows:
        clock[0] = t
        if tracker.feed(report):
            out.append(dict(t=t, detail=tracker.snapshot()))
    return out


class DecodeTests(unittest.TestCase):
    def test_the_boards_own_idle_report(self):
        r = decode(bytes.fromhex('0101091e0ab806000000000000000000000000000000000000000000000000533b0100'))
        self.assertEqual(r['count'], 1)
        self.assertEqual(r['slots'][0], dict(confidence=True, tip=False, id=9, x=2590, y=1720))
        self.assertEqual(r['scan'], 0x3b53)

    def test_not_a_touchpad_report(self):
        self.assertIsNone(decode(b'\x02' + bytes(34)))
        self.assertIsNone(decode(b'\x01' + bytes(10)))

    def test_pads_on_the_one_surface(self):
        self.assertEqual(pad_of(0), ('left', 0.0))
        self.assertEqual(pad_of(2047), ('left', 1.0))
        self.assertEqual(pad_of(2200), (None, None))      # the 10 mm gap
        self.assertEqual(pad_of(2524), ('right', 0.0))
        self.assertEqual(pad_of(4571), ('right', 1.0))


class TrackerTests(unittest.TestCase):
    def pack(self, contacts, count):
        b = bytearray(35); b[0] = 1
        for i, (cid, x, y, tip) in enumerate(contacts):
            struct.pack_into('<BBHH', b, 1 + 6 * i, 1 | (2 if tip else 0), cid, x, y)
        b[33] = count
        return bytes(b)

    def test_a_lifted_contact_is_gone(self):
        t = ContactTracker()
        self.assertTrue(t.feed(self.pack([(3, 100, 100, True)], 1)))
        self.assertEqual(list(t.contacts), [3])
        self.assertTrue(t.feed(self.pack([(3, 100, 100, False)], 1)))
        self.assertEqual(t.contacts, {})

    def test_a_frame_split_over_two_reports_hybrid_mode(self):
        t = ContactTracker()
        first = self.pack([(i, 100 * i, 50, True) for i in range(5)], 6)
        self.assertFalse(t.feed(first))                      # one slot still due
        self.assertTrue(t.feed(self.pack([(5, 3000, 50, True)], 0)))
        self.assertEqual(sorted(t.contacts), [0, 1, 2, 3, 4, 5])

    def test_a_stray_continuation_is_ignored(self):
        t = ContactTracker()
        self.assertFalse(t.feed(self.pack([(1, 10, 10, True)], 0)))
        self.assertEqual(t.contacts, {})

    def test_contacts_expire_when_reports_stop(self):
        clock = [0.0]
        t = ContactTracker(clock=lambda: clock[0])
        t.feed(self.pack([(1, 10, 10, True)], 1))
        clock[0] = 0.3; self.assertFalse(t.expire())
        clock[0] = 0.6; self.assertTrue(t.expire()); self.assertEqual(t.contacts, {})

    def test_spread_on_the_surface_in_mm(self):
        d = overlay_detail({0: dict(x=0, y=0, confidence=True), 1: dict(x=4571, y=0, confidence=True)})
        self.assertEqual(d['spread'], 96.0)
        self.assertEqual([c['hand'] for c in d['contacts']], ['left', 'right'])

    def test_a_palm_is_drawn_but_not_measured(self):
        d = overlay_detail({0: dict(x=10, y=0, confidence=True), 1: dict(x=3000, y=0, confidence=False)})
        self.assertIsNone(d['spread'])
        self.assertTrue(d['contacts'][1]['palm'])


class RecordedPinchTests(unittest.TestCase):
    """The user flow: a pinch across both pads, replayed, as the overlay receives it."""

    def setUp(self):
        self.rows = load_recording(RECORDING)
        self.events = events_from(self.rows)

    def test_one_finger_on_each_pad_spreading_then_closing(self):
        two = [e['detail'] for e in self.events if len(e['detail']['contacts']) == 2]
        self.assertEqual(len(two), 150)
        for d in two:
            self.assertEqual([c['hand'] for c in d['contacts']], ['left', 'right'])
        spreads = [d['spread'] for d in two]
        widest = spreads.index(max(spreads))
        self.assertEqual(widest, 74)                                   # the end of the spread
        self.assertTrue(all(a <= b for a, b in zip(spreads[:widest], spreads[1:widest + 1])))
        self.assertTrue(all(a >= b for a, b in zip(spreads[widest:], spreads[widest + 1:])))
        self.assertAlmostEqual(spreads[0], 25.3, delta=0.2)
        self.assertAlmostEqual(max(spreads), 77.7, delta=0.2)
        # the left finger moves left and the right finger right as it opens
        self.assertLess(two[widest]['contacts'][0]['u'], two[0]['contacts'][0]['u'])
        self.assertGreater(two[widest]['contacts'][1]['u'], two[0]['contacts'][1]['u'])

    def test_both_lift_at_the_end(self):
        self.assertEqual(self.events[-1]['detail']['contacts'], [])

    def test_the_overlay_test_replays_the_same_events(self):
        self.assertEqual(json.loads(EVENTS.read_text()), self.events,
                         'regenerate with: py -3 -m tests.test_touch (from companion/overlay-host)')


class RawInputTests(unittest.TestCase):
    def test_parse_a_rawinput_hid_buffer(self):
        report = bytes.fromhex('0101091e0ab806000000000000000000000000000000000000000000000000533b0100')
        for ptr in (8, 4):
            header = struct.pack('<II', 2, 8 + 2 * ptr + 8 + 2 * 35) + (struct.pack('<QQ', 0x1234, 0) if ptr == 8 else struct.pack('<II', 0x1234, 0))
            buf = header + struct.pack('<II', 35, 2) + report + report
            handle, reports = parse_rawinput(buf, ptr)
            self.assertEqual(handle, 0x1234)
            self.assertEqual(reports, [report, report])

    def test_mouse_and_keyboard_raw_input_is_not_hid(self):
        self.assertIsNone(parse_rawinput(struct.pack('<II', 0, 40) + bytes(40)))

    def test_only_the_pinned_boards_touchpad(self):
        path = r'\\?\HID#VID_303A&PID_4044&MI_04&Col01#b&29534184&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}'
        self.assertTrue(same_device(path.lower(), path))
        self.assertFalse(same_device(path.replace('29534184', '11111111'), path))

        class FakeHid:
            @staticmethod
            def enumerate():
                return [dict(serial_number='sval:A', usage_page=0x0D, usage=0x05, path=path.encode()),
                        dict(serial_number='sval:A', usage_page=0x0D, usage=0x0E, path=b'config'),
                        dict(serial_number='sval:B', usage_page=0x0D, usage=0x05, path=b'other board')]
        self.assertEqual(touch.touchpad_paths(FakeHid, 'sval:A'), [path])


if __name__ == '__main__':
    EVENTS.write_text(json.dumps(events_from(load_recording(RECORDING)), indent=None, separators=(',', ':')) + '\n')
    print(EVENTS)
