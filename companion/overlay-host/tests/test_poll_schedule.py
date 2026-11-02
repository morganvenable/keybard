"""When a board's reader reads the layer state and the switch matrix (device/schedule.py),
and the read loop that follows it (device/worker.py)."""
import os
import threading
import time
import unittest
from unittest import mock

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
from keybard_host.device import schedule
from keybard_host.device.protocol import LayerSnapshot
from keybard_host.device.schedule import FAST, HELD_IDLE, IDLE, SETTLE, PollScheduler

try:
    from keybard_host.device import worker as worker_module
    QT = True
except ImportError:
    QT = False

IDLE_LAYER = LayerSnapshot(1, 1, None)
NONE = frozenset()


def run(sched, seconds, start=0.0, layer=lambda t: IDLE_LAYER, keys=lambda t: NONE):
    """Drive the scheduler as the worker does; return the times of each read."""
    t, reads = max(start, sched.next_at), []
    while t < start + seconds:
        reads.append(t)
        sched.done(layer(t), keys(t) if sched.wants_matrix else None, t)
        t = sched.next_at
    return reads


def gaps(reads):
    return [round(b - a, 6) for a, b in zip(reads, reads[1:])]


class SchedulerTests(unittest.TestCase):
    def test_shown_held_keys_read_fast_then_back_off_one_frame(self):
        s = PollScheduler(0.0)
        s.set_plan(True, False, 0.0)
        reads = run(s, 3.0)
        self.assertEqual(gaps(reads)[0], FAST)
        settled = [g for r, g in zip(reads, gaps(reads)) if r > SETTLE + .05]
        self.assertTrue(settled)
        self.assertEqual(max(settled), HELD_IDLE)                          # never slower than a frame
        self.assertTrue(s.wants_matrix)

    def test_idle_and_unshown_backs_off_to_four_reads_a_second(self):
        s = PollScheduler(0.0)
        s.set_plan(False, False, 0.0)
        self.assertFalse(s.wants_matrix)
        reads = run(s, 60.0)
        self.assertLessEqual(max(gaps(reads)), IDLE)
        late = [r for r in reads if r > 10]
        self.assertAlmostEqual(len(late) / 50, 1 / IDLE, delta=.2)         # about 4/s once settled
        self.assertLess(len(reads), 60 * 6)                                # was 125/s (0x16 every 8 ms)

    def test_any_change_returns_to_the_fast_rate_at_once(self):
        s = PollScheduler(0.0)
        s.set_plan(False, False, 0.0)
        run(s, 5.0)
        self.assertEqual(s.interval, IDLE)
        # A layer change at 5 s: seen within IDLE, then read fast for SETTLE.
        layer = lambda t: IDLE_LAYER if t < 5.0 else LayerSnapshot(2, 1, None)
        reads = run(s, 2.0, start=5.0, layer=layer)
        self.assertLessEqual(reads[0] - 5.0, IDLE)
        self.assertEqual(gaps(reads)[0], FAST)
        fast = [g for r, g in zip(reads, gaps(reads)) if r < reads[0] + SETTLE - .01]
        self.assertTrue(fast and all(g == FAST for g in fast))

    def test_held_keys_keep_the_fast_rate_while_held(self):
        s = PollScheduler(0.0)
        s.set_plan(True, False, 0.0)
        held = lambda t: frozenset({(0, 1)}) if 2.0 <= t < 4.0 else NONE
        reads = run(s, 5.0, keys=held)
        during = [g for r, g in zip(reads, gaps(reads)) if 2.02 <= r < 3.98]
        self.assertTrue(during and all(g == FAST for g in during))
        first = next(r for r in reads if r >= 2.0)
        self.assertLessEqual(first - 2.0, HELD_IDLE)                       # a press after a quiet spell
        after = [g for r, g in zip(reads, gaps(reads)) if 4.0 <= r < 4.0 + SETTLE - .01]
        self.assertTrue(after and all(g == FAST for g in after))           # letting go is a change too

    def test_watch_samples_the_matrix_slowly_and_speeds_up_on_a_key(self):
        s = PollScheduler(0.0)
        s.set_plan(False, True, 0.0)
        self.assertTrue(s.wants_matrix)
        run(s, 5.0)
        self.assertEqual(s.interval, IDLE)
        held = lambda t: frozenset({(6, 0)}) if t >= 5.0 else NONE
        reads = run(s, 1.0, start=5.0, keys=held)
        self.assertLessEqual(reads[0] - 5.0, IDLE)
        self.assertEqual(gaps(reads)[0], FAST)

    def test_showing_held_keys_reads_at_once_and_fast(self):
        s = PollScheduler(0.0)
        s.set_plan(False, False, 0.0)
        run(s, 5.0)
        self.assertGreater(s.next_at, 5.0)
        s.set_plan(True, False, 5.0)
        self.assertTrue(s.due(5.0))
        self.assertEqual(s.interval, FAST)

    def test_hiding_held_keys_keeps_the_current_slow_read_and_forgets_the_matrix(self):
        s = PollScheduler(0.0)
        s.set_plan(True, False, 0.0)
        run(s, 2.0, keys=lambda t: frozenset({(0, 0)}))
        s.set_plan(False, False, 2.0)
        self.assertFalse(s.wants_matrix)
        self.assertIsNone(s.last[1])
        self.assertLessEqual(s.next_at, 2.0 + IDLE)
        # Showing again: the first matrix read compares with nothing, so it isn't a "change".
        s.set_plan(True, False, 3.0)
        self.assertFalse(s.done(IDLE_LAYER, frozenset(), 3.0))

    def test_read_now_reads_without_changing_the_rate(self):
        s = PollScheduler(0.0)
        s.set_plan(False, False, 0.0)
        run(s, 5.0)
        s.read_now(5.0)
        self.assertTrue(s.due(5.0))
        self.assertEqual(s.interval, IDLE)

    def test_the_same_plan_again_changes_nothing(self):
        s = PollScheduler(0.0)
        s.set_plan(False, False, 0.0)
        run(s, 5.0)
        before = (s.interval, s.next_at, s.last_change)
        s.set_plan(False, False, 5.0)
        self.assertEqual((s.interval, s.next_at, s.last_change), before)


class FakeReader:
    """Enough of SvalReader for the read loop, counting reads."""
    instances = []

    def __init__(self, device, cancelled=lambda: False):
        self.cancelled = cancelled
        self.feature_flags = self.feature_flags2 = 0
        self.layer_reads = self.matrix_reads = 0
        self.lock = threading.Lock()
        FakeReader.instances.append(self)

    def info(self): return 3, 1
    def read_profile(self, uid, progress=None, reuse_definition=False): return 'profile'
    def checkpoint(self): pass
    def pointing_watching(self): return False
    def pointing_motion(self): return None

    def layer_snapshot(self):
        with self.lock: self.layer_reads += 1
        return IDLE_LAYER

    def pressed_keys(self):
        with self.lock: self.matrix_reads += 1
        return NONE


class FakeDevice:
    def open_path(self, path): pass
    def close(self): pass


@unittest.skipUnless(QT, 'Requires the native Qt runtime')
class ReadLoopTests(unittest.TestCase):
    def setUp(self):
        FakeReader.instances = []
        hid = mock.Mock(); hid.device = FakeDevice
        patcher = mock.patch.multiple(worker_module, SvalReader=FakeReader, hid_backend=lambda: hid,
                                      candidates=lambda hid: [dict(serial_number='sval:TEST', path=b'p')])
        patcher.start(); self.addCleanup(patcher.stop)
        self.worker = worker_module.DeviceWorker(dict(serial_number='sval:TEST', path=b'p'))
        self.thread = threading.Thread(target=self.worker.run, daemon=True)

    def tearDown(self):
        self.worker.stop(); self.thread.join(2)

    def counts(self):
        r = FakeReader.instances[0]
        with r.lock: return r.layer_reads, r.matrix_reads

    def test_unshown_board_reads_its_layer_slowly_and_never_the_matrix(self):
        self.worker.set_press_tracking(False)
        self.thread.start()
        time.sleep(SETTLE + 1.5)
        a = self.counts(); time.sleep(1.0); b = self.counts()
        self.assertEqual(b[1], 0)
        self.assertLessEqual(b[0] - a[0], 6)                               # about 4/s, not 125/s

    def test_shown_held_keys_read_both_and_a_new_plan_applies_at_once(self):
        self.worker.set_press_tracking(True)
        self.thread.start()
        time.sleep(1.0)
        a = self.counts()
        self.assertGreater(a[1], 30)
        self.worker.set_press_tracking(False)
        time.sleep(.3); b = self.counts(); time.sleep(.5); c = self.counts()
        self.assertEqual(c[1], b[1])                                       # matrix reads stopped
        self.worker.set_press_tracking(True)
        time.sleep(.05)
        self.assertGreater(self.counts()[1], c[1])                         # and start again at once

    def test_stop_ends_the_loop_at_once_even_while_idle(self):
        self.worker.set_press_tracking(False)
        self.thread.start()
        time.sleep(SETTLE + 1.0)
        started = time.monotonic()
        self.worker.stop(); self.thread.join(1)
        self.assertFalse(self.thread.is_alive())
        self.assertLess(time.monotonic() - started, .2)                     # not a full idle interval late


if __name__ == '__main__':
    unittest.main()
