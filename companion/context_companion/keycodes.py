"""Small explicit keycode vocabulary; hex supports other QMK codes."""
KEYCODES = {f'KC_{chr(65+i)}': 4+i for i in range(26)}
KEYCODES.update({f'KC_{n}': 30+i for i, n in enumerate('1234567890')})
KEYCODES.update({f'KC_F{i+1}': 58+i for i in range(12)})
KEYCODES.update(dict(KC_NO=0, KC_TRNS=1, KC_ENTER=40, KC_ESC=41, KC_BSPC=42,
                     KC_TAB=43, KC_SPACE=44, KC_MINUS=45, KC_EQUAL=46,
                     KC_LEFT=80, KC_RIGHT=79, KC_UP=82, KC_DOWN=81,
                     KC_LCTL=224, KC_LSFT=225, KC_LALT=226, KC_LGUI=227,
                     KC_RCTL=228, KC_RSFT=229, KC_RALT=230, KC_RGUI=231))


def parse_keycode(text: str) -> int:
    value = text.strip().upper()
    name = value if value.startswith('KC_') else 'KC_' + value
    if not value.isdigit() and name in KEYCODES:
        return KEYCODES[name]
    try:
        result = int(value, 16 if value.startswith('0X') else 10)
    except ValueError:
        raise ValueError('Use KC_A, a common KC_ name, or a numeric code such as 0x0004') from None
    if not 0 <= result <= 65535:
        raise ValueError('Keycode must fit 16 bits')
    return result


def format_keycode(value: int) -> str:
    return next((k for k, v in KEYCODES.items() if v == value), f'0x{value:04X}')
