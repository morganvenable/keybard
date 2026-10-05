"""Independent Svalboard schematic: 52 legacy positions, up to 60 from firmware."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Key:
    row: int
    col: int
    x: float
    y: float
    cluster: str
    direction: str

    @property
    def hand(self):
        return "Left" if self.row < 5 else "Right"


def keys():
    result = []
    # Legacy finger columns: south, east, center, north, west. Sixth keys are added below.
    offsets = [(0, 1), (1, 0), (0, 0), (0, -1), (-1, 0)]
    names = ["south", "east", "center", "north", "west"]
    for row, x, y, name in [(4, 1, 2, "Pinky"), (3, 4.4, 1.4, "Ring"),
                            (2, 7.8, 1, "Middle"), (1, 11.2, 2, "Index"),
                            (6, 15.8, 2, "Index"), (7, 19.2, 1, "Middle"),
                            (8, 22.6, 1.4, "Ring"), (9, 26, 2, "Pinky")]:
        for col, ((dx, dy), direction) in enumerate(zip(offsets, names)):
            result.append(Key(row, col, x + dx, y + dy, name, direction))
    # Two thumb rows; preserve column-to-physical-position mapping for each hand.
    for row, x, positions in [(0, 8.8, [(2, 1), (2, 0), (1, 1), (0, 0), (0, 1), (1, 0)]),
                               (5, 15.2, [(0, 1), (0, 0), (1, 1), (2, 0), (2, 1), (1, 0)])]:
        for col, (dx, dy) in enumerate(positions):
            result.append(Key(row, col, x + dx * 1.2, 4.4 + dy, "Thumb", f"{col + 1}"))
    return tuple(result)


KEYS = keys()


def keys_for_positions(positions):
    """Use the trainer schematic, populated by the board's fragment matrix maps."""
    from dataclasses import replace
    positions = set(positions)
    extra_fingers = any(row not in (0, 5) and col == 5 for row, col in positions)
    available = {(k.row, k.col): k for k in KEYS}
    for row in range(10):
        if row not in (0, 5):
            south = available[row, 0]
            available[row, 5] = replace(south, col=5, y=south.y + 1, direction="second south")
    selected = []
    for position in sorted(positions):
        key = available[position]
        if extra_fingers and key.row in (0, 5):
            key = replace(key, y=key.y + 1.8)
        selected.append(key)
    if not selected:
        raise ValueError("Board definition has no populated key positions")
    return tuple(selected)
