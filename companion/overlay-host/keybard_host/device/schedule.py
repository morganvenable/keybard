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

Separately, layer: the overlay shows this board's layer (on screen, or a page drawing
it). The layer is then read as fast as held keys would be, matrix or not, so turning
Highlight held keys off never slows layer changes.

The rate adapts: FAST right after any change (a layer change, a held key, a key
let go), and while anything is held. After SETTLE seconds without a change it
backs off, doubling the interval each read, to the plan's ceiling: HELD_IDLE
while held keys or the layer are shown, IDLE otherwise. So an idle overlay shows a layer
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
        self.layer = True
        self.interval = FAST
        self.next_at = now          # the first read is due at once
        self.last_change = now
        self.last = None            # (layer snapshot, pressed positions) of the last read
        self.matrix_next = now      # watch only: when the next matrix sample is due

    @property
    def ceiling(self):
        return HELD_IDLE if self.held or self.layer else IDLE

    @property
    def wants_matrix(self):
        return self.held or self.watch

    def reads_matrix(self, now):
        """Whether this read includes the matrix: every read while held keys are shown;
        while watching, every IDLE (every read while a key is held), however fast the layer is read."""
        return self.held or (self.watch and now >= self.matrix_next)

    def set_plan(self, held, watch, now, layer=None):
        """Apply a new plan. Starting to show held keys or the layer reads at once, and fast.
        layer defaults to held (held keys are only shown with the layer)."""
        held, watch = bool(held), bool(watch)
        layer = held if layer is None else bool(layer)
        if (held, watch, layer) == (self.held, self.watch, self.layer):
            return
        started = ((held and not self.held) or (layer and not self.layer)
                   or (watch and not self.watch and not self.held))
        if watch and not self.watch:
            self.matrix_next = now
        self.held, self.watch, self.layer = held, watch, layer
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
        # A read without the matrix keeps the last sample to compare the next one with.
        self.last = (snapshot, positions if positions is not None or previous is None else previous[1])
        if positions is not None and not self.held:
            self.matrix_next = now if positions else now + IDLE
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
