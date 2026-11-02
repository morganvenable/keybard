"""When a board's reader reads the layer state (0x16) and the switch matrix (0x02).

Each read is a Raw HID round trip, about 50-110 us of CPU on Windows. Reading both
every 8 ms is 250 exchanges a second per board, all the time, whether or not
anything shows the result. The plan says what is needed now:

* held: something shows this board's held keys (the overlay on screen with
  "Highlight held keys" on, or a Keybard page polling the Overlay): read the
  layer and the matrix together, fast.
* watch: held keys aren't shown, but which board is in use matters (more than
  one board, following the one in use): sample the matrix with the layer, slowly.
* neither: the layer only, slowly.

The rate adapts: FAST right after any change (a layer change, a held key, a key
let go), and while anything is held. After SETTLE seconds without a change it
backs off, doubling the interval each read, to the plan's ceiling: HELD_IDLE
while held keys are shown, IDLE otherwise. So an idle overlay shows a layer
change within IDLE (plus one round trip), and a key held on a shown board is
read within HELD_IDLE after a quiet spell, then every FAST.
"""

FAST = .008
# Shown held keys after a quiet spell: about one display frame.
HELD_IDLE = .016
# Nothing shows held keys: about 4 reads a second, so a layer change shows within ~250 ms.
IDLE = .25
# Seconds without a change before backing off from FAST.
SETTLE = .5


class PollScheduler:
    """Pure timing for one connection's state reads; the clock is passed in."""

    def __init__(self, now):
        self.held = True
        self.watch = False
        self.interval = FAST
        self.next_at = now          # the first read is due at once
        self.last_change = now
        self.last = None            # (layer snapshot, pressed positions) of the last read

    @property
    def ceiling(self):
        return HELD_IDLE if self.held else IDLE

    @property
    def wants_matrix(self):
        return self.held or self.watch

    def set_plan(self, held, watch, now):
        """Apply a new plan. Starting to show held keys reads at once, and fast."""
        held, watch = bool(held), bool(watch)
        if (held, watch) == (self.held, self.watch):
            return
        started = (held and not self.held) or (watch and not self.watch and not self.held)
        self.held, self.watch = held, watch
        if not self.wants_matrix and self.last is not None:
            # Matrix no longer read: forget it, so the next sample is compared fresh.
            self.last = (self.last[0], None)
        if started:
            self.interval, self.next_at, self.last_change = FAST, now, now
        else:
            self.interval = min(self.interval, self.ceiling)
            self.next_at = min(self.next_at, now + self.interval)

    def read_now(self, now):
        """Read at once (a layout was just read), without changing the rate."""
        self.next_at = min(self.next_at, now)

    def due(self, now):
        return now >= self.next_at

    def done(self, snapshot, positions, now):
        """Record one read (positions None when the matrix wasn't read) and schedule the next.
        Returns whether anything changed."""
        previous = self.last
        self.last = (snapshot, positions)
        changed = previous is not None and (snapshot != previous[0] or (
            positions is not None and previous[1] is not None and positions != previous[1]))
        if changed or positions:
            self.last_change = now
        if changed or positions or now - self.last_change < SETTLE:
            self.interval = FAST
        else:
            self.interval = min(self.ceiling, self.interval * 2)
        self.next_at = now + self.interval
        return changed
