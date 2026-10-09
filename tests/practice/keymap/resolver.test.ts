import { describe, expect, it } from 'vitest';
import { keymapFingerprint, fingerprintSource, shortFingerprint } from '@/features/practice/keymap/fingerprint';
import { boardGeometry, keyPlace, placeOf } from '@/features/practice/keymap/geometry';
import {
    layerAction,
    parsePathKey,
    pathKey,
    resolveBinding,
    resolveKeymap,
    shiftRole,
} from '@/features/practice/keymap/resolver';
import { isWhitespaceChar, whitespaceFor } from '@/features/practice/keymap/whitespace';
import { keyService } from '@/services/key.service';
import { rebind, svalDefault } from '../fixtures/boards';

const cp = (s: string) => s.codePointAt(0)!;
const resolveBoard = (board = svalDefault(), options = {}) =>
    resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols }, options);

describe('resolver on sval-default.svil (spec §9.9)', () => {
    const r = resolveBoard();

    it('a → 0:26:n (left pinky C)', () => {
        const a = r.primary(cp('a'))!;
        expect(a.key).toBe('0:26:n');
        expect(a.prereqs).toEqual([]);
        expect(placeOf(a.index)).toMatchObject({ cluster: 'left_pinky', key: 'C' });
    });

    it('space → 0:33:n (right thumb T3, KC_SPACE) through the whitespace table', () => {
        const space = r.primary(0x20)!;
        expect(space.key).toBe('0:33:n');
        expect(placeOf(33)).toMatchObject({ cluster: 'right_thumb', key: 'T3' });
        expect(space.emitsOnRelease).toBe(false);
    });

    it('Enter → the LT1(KC_ENTER) tap side, which emits on release', () => {
        const enter = r.primary(0x0a)!;
        expect(enter.index).toBe(3);
        expect(keyService.stringify(enter.code)).toBe('LT1(KC_ENTER)');
        expect(enter.emitsOnRelease).toBe(true);
        expect(enter.delayed).toBe(true);
    });

    it('Tab → the LGUI_T(KC_TAB) tap side', () => {
        const tab = r.primary(0x09)!;
        expect(tab.index).toBe(1);
        expect(tab.emitsOnRelease).toBe(true);
    });

    it('! → MO(1) (index 32, primary) or LT1 (index 3, alternative), target 27, firmware Shift', () => {
        const paths = r.pathsOf(cp('!'));
        expect(paths[0].key).toBe('1:27:f');
        expect(paths[0].prereqs.map((p) => [p.kind, p.index, p.tapHold])).toEqual([['hold', 32, false]]);
        expect(paths[0].delayed).toBe(false);
        expect(paths[1].key).toBe('1:27:f');
        expect(paths[1].prereqs.map((p) => [p.kind, p.index, p.tapHold])).toEqual([['hold', 3, true]]);
        expect(paths[1].cost).toBeGreaterThan(paths[0].cost);
        expect(paths[1].delayed).toBe(true);
    });

    it('detects firmware Shift from the keycode bits of KC_EXLM (0x021e)', () => {
        const bang = r.primary(cp('!'))!;
        expect(bang.code).toBe(0x021e);
        expect(bang.shift).toBe('f');
    });

    it('A → user Shift (left thumb index 2) + 26', () => {
        const A = r.primary(cp('A'))!;
        expect(A.key).toBe('0:26:u');
        expect(A.prereqs.map((p) => [p.kind, p.index])).toEqual([['shift', 2]]);
    });

    it('t → left middle E (index 13)', () => {
        expect(r.primary(cp('t'))!.key).toBe('0:13:n');
        expect(placeOf(13)).toMatchObject({ cluster: 'left_middle', key: 'E' });
    });

    it('digits on layer 1 resolve through MO(1)', () => {
        expect(r.primary(cp('1'))!.key).toBe('1:26:n');
        expect(r.primary(cp('1'))!.prereqs.map((p) => p.index)).toEqual([32]);
    });

    it('never offers a path that only adds presses to another (no LT14 + MO(1) detours)', () => {
        for (const path of r.pathsOf(cp('!'))) expect(path.prereqs.some((p) => p.index === 49)).toBe(false);
    });

    it('reverse map: (index, layer, shift) → character', () => {
        expect(r.charAt(27, 0)).toBe(cp('q'));
        expect(r.charAt(27, 1, 'f')).toBe(cp('!'));
        expect(r.charAt(26, 0, 'u')).toBe(cp('A'));
        expect(r.charAt(4, 0)).toBeNull();
    });

    it('lists reachable layers with their cheapest prerequisites', () => {
        expect(r.layers.get(0)?.prereqs).toEqual([]);
        expect(r.layers.get(1)?.prereqs.map((p) => p.index)).toEqual([32]);
        expect(r.layers.get(2)?.prereqs.map((p) => p.index)).toEqual([35]);
    });

    it('custom text with spaces, newlines and é reports only é as untypeable', () => {
        expect(r.untypeable('Café au lait\nwith\tmilk\r\n')).toEqual([cp('é')]);
    });

    it('covers every lowercase letter and digit', () => {
        for (const ch of 'abcdefghijklmnopqrstuvwxyz0123456789') expect(r.primary(cp(ch)), ch).not.toBeNull();
    });
});

describe('resolver rules', () => {
    it('follows QMK transparency to the next active layer', () => {
        const keymap = [[4, 5], [1, 6]];
        expect(resolveBinding(keymap, 0, 0b11)).toEqual({ code: 4, layer: 0 });
        expect(resolveBinding(keymap, 1, 0b11)).toEqual({ code: 6, layer: 1 });
        expect(resolveBinding(keymap, 1, 0b01)).toEqual({ code: 5, layer: 0 });
    });

    it('treats a transparent key under a hold as reachable without it', () => {
        const r = resolveBoard();
        // Layer 1 thumbs are KC_TRNS: space is never a layer-1 path.
        expect(r.pathsOf(0x20).every((p) => p.layer === 0)).toBe(true);
    });

    it('cannot reach a layer that no key turns on', () => {
        const board = svalDefault();
        const r = resolveBoard(board);
        expect(r.layers.has(3)).toBe(false);
        // A key bound only on layer 3 has no path.
        const lonely = rebind(board, 3, 26, keyService.parse('KC_KP_PLUS'));
        expect(resolveBoard(lonely).pathsOf(cp('+')).some((p) => p.layer === 3)).toBe(false);
    });

    it('excludes TG/TO/DF/TT from paths', () => {
        expect(layerAction('TG(1)')).toBeNull();
        expect(layerAction('TO(1)')).toBeNull();
        expect(layerAction('DF(1)')).toBeNull();
        expect(layerAction('TT(1)')).toBeNull();
        expect(layerAction('MO(3)')).toEqual({ kind: 'hold', toLayer: 3, tapHold: false });
        expect(layerAction('LT2(KC_A)')).toEqual({ kind: 'hold', toLayer: 2, tapHold: true });
        expect(layerAction('OSL(4)')).toEqual({ kind: 'oneshot', toLayer: 4, tapHold: false });
    });

    it('a toggle key does not make its layer reachable', () => {
        const board = rebind(svalDefault(), 0, 32, keyService.parse('TG(1)'));
        const r = resolveBoard(board);
        // `!` is still reachable through LT1 (index 3), but not through the toggle.
        expect(r.pathsOf(cp('!')).map((p) => p.prereqs[0].index)).not.toContain(32);
        expect(r.primary(cp('!'))!.prereqs[0].index).toBe(3);
    });

    it('OSL is a one-shot prerequisite, costed between MO and LT', () => {
        const board = rebind(svalDefault(), 0, 32, keyService.parse('OSL(1)'));
        const bang = resolveBoard(board).primary(cp('!'))!;
        expect(bang.prereqs.map((p) => [p.kind, p.index])).toEqual([['oneshot', 32]]);
    });

    it('recognizes Shift keys and Shift mod-taps', () => {
        expect(shiftRole('KC_LSHIFT')).toEqual({ tapHold: false });
        expect(shiftRole('KC_RSFT')).toEqual({ tapHold: false });
        expect(shiftRole('LSFT_T(KC_A)')).toEqual({ tapHold: true });
        expect(shiftRole('LGUI_T(KC_TAB)')).toBeNull();
    });

    it('a keymap without a Shift key has no user-Shift paths', () => {
        const board = rebind(svalDefault(), 0, 2, 0);
        const r = resolveBoard(board);
        expect(r.primary(cp('A'))).toBeNull();
        expect(r.primary(cp('"'))!.shift).toBe('f');
    });

    it('a duplicated character keeps both keys as paths, cheapest first', () => {
        const board = rebind(svalDefault(), 0, 49, keyService.parse('KC_A'));
        const paths = resolveBoard(board).pathsOf(cp('a'));
        expect(paths.map((p) => p.key)).toEqual(['0:26:n', '0:49:n']);
    });

    it('follows the OS layout for character output', () => {
        const de = resolveBoard(svalDefault(), { layoutId: 'german' });
        // KC_Z types y on a German layout, KC_Y types z.
        expect(de.primary(cp('y'))!.index).toBe(24);
        expect(de.primary(cp('z'))!.index).toBe(46);
    });

    it('uses the default layer as the base state', () => {
        const r = resolveBoard(svalDefault(), { defaultLayer: 1 });
        expect(r.primary(cp('1'))!.key).toBe('1:26:n');
        expect(r.primary(cp('1'))!.prereqs).toEqual([]);
    });

    it('custom keycodes resolve to no character', () => {
        const board = rebind(svalDefault(), 0, 26, 0x7e40);
        expect(resolveBoard(board).primary(cp('a'))).toBeNull();
    });

    it('round-trips path keys', () => {
        expect(pathKey(1, 27, 'f')).toBe('1:27:f');
        // M3 added the targets and taps of combos and double taps to the parsed key.
        expect(parsePathKey('1:27:f')).toEqual({ layer: 1, index: 27, targets: [27], taps: 1, shift: 'f' });
        expect(parsePathKey('1:27:x')).toBeNull();
    });

    it('round-trips combo and double-tap path keys (M3)', () => {
        expect(pathKey(0, [20, 14], 'n')).toBe('0:14+20:n');
        expect(parsePathKey('0:14+20:n')).toEqual({ layer: 0, index: 14, targets: [14, 20], taps: 1, shift: 'n' });
        expect(pathKey(0, 26, 'n', 2)).toBe('0:26*2:n');
        expect(parsePathKey('0:26*2:u')).toEqual({ layer: 0, index: 26, targets: [26], taps: 2, shift: 'u' });
        expect(parsePathKey('0:14+20*2:n')).toBeNull();
    });
});

describe('combos, tap dances and key overrides (M3, §9.4 step 5)', () => {
    const TD0 = 0x5700;
    const withTapDance = () => {
        const board = rebind(svalDefault(), 0, 26, TD0);
        board.tapdances = [{ idx: 0, tap: 'KC_A', hold: 'KC_NO', doubletap: 'KC_B', taphold: 'KC_NO', tapping_term: 200, enabled: true }];
        return board;
    };
    const resolveFull = (board: ReturnType<typeof svalDefault>) => resolveKeymap(
        { keymap: board.keymap!, rows: board.rows, cols: board.cols, combos: board.combos, tapdances: board.tapdances, key_overrides: board.key_overrides });

    it('a tap-dance tap types its tap keycode, delayed by the tapping term', () => {
        const r = resolveFull(withTapDance());
        const a = r.primary(cp('a'))!;
        expect(a.key).toBe('0:26:n');
        expect(a.via).toBe('tapdance');
        expect(a.delayed).toBe(true);
        expect(a.emitsOnRelease).toBe(false);
        expect(a.cost).toBeCloseTo(1 + 1, 5);
        // User Shift reaches the tap's capital through the same key.
        expect(r.primary(cp('A'))!.key).toBe('0:26:u');
    });

    it('a tap-dance double tap is an alternative path pressing its key twice', () => {
        const r = resolveFull(withTapDance());
        const paths = r.pathsOf(cp('b'));
        expect(paths[0].key).toBe('0:19:n');
        const double = paths.find((p) => p.taps === 2)!;
        expect(double.key).toBe('0:26*2:n');
        expect(double.delayed).toBe(true);
        expect(double.cost).toBeGreaterThan(paths[0].cost);
        // The reverse map keeps single presses: the key's tap.
        expect(r.charAt(26, 0, 'n')).toBe(cp('a'));
        expect(r.byKey.get('0:26*2:n')).toBe(cp('b'));
    });

    it('a disabled or empty tap dance types nothing', () => {
        const board = withTapDance();
        board.tapdances = [{ ...board.tapdances![0], enabled: false }];
        expect(resolveFull(board).primary(cp('a'))).toBeNull();
    });

    it('a combo is a multi-target path with cost n and the sorted path key', () => {
        const board = svalDefault();
        board.combos = [{ cmbid: 0, keys: ['KC_K', 'KC_J', 'KC_NO', 'KC_NO'], output: 'KC_EQUAL', options: 0x8000 }];
        const r = resolveFull(board);
        const eq = r.primary(cp('='))!;
        expect(eq.key).toBe('0:38+44:n');
        expect(eq.targets).toEqual([38, 44]);
        expect(eq.via).toBe('combo');
        expect(eq.cost).toBeCloseTo(2, 5);
        expect(eq.delayed).toBe(false);
        // The layer-1 key stays an alternative.
        expect(r.pathsOf(cp('=')).some((p) => p.key === '1:25:n')).toBe(true);
        // Shift + the combo types its shifted output.
        expect(r.pathsOf(cp('+')).some((p) => p.key === '0:38+44:u')).toBe(true);
    });

    it('a disabled combo, or one whose key is not on the keymap, is no path', () => {
        const board = svalDefault();
        board.combos = [
            { cmbid: 0, keys: ['KC_K', 'KC_J'], output: 'KC_EQUAL', options: 0 },
            { cmbid: 1, keys: ['KC_K', 'KC_F13'], output: 'KC_EQUAL', options: 0x8000 },
        ];
        expect(resolveFull(board).pathsOf(cp('=')).every((p) => p.targets.length === 1)).toBe(true);
    });

    it('a Shift key override types its replacement instead of the shifted character', () => {
        const board = svalDefault();
        board.key_overrides = [{ koid: 0, trigger: 'KC_COMMA', replacement: 'KC_SCOLON', layers: 0xffff, trigger_mods: 0x02, negative_mod_mask: 0, suppressed_mods: 0x02, options: 0x80 }];
        const r = resolveFull(board);
        expect(r.pathsOf(cp(';')).map((p) => p.key)).toContain('0:42:u');
        expect(r.pathsOf(cp(';')).find((p) => p.key === '0:42:u')!.via).toBe('override');
        // "<" no longer comes from Shift + comma.
        expect(r.pathsOf(cp('<')).some((p) => p.key === '0:42:u')).toBe(false);
        expect(r.charAt(42, 0, 'u')).toBe(cp(';'));
        expect(r.primary(cp(','))!.key).toBe('0:42:n');
    });

    it('a key override needing Ctrl, a disabled one, or one off its layers changes nothing', () => {
        const base = resolveFull(svalDefault());
        const ko = { koid: 0, trigger: 'KC_COMMA', replacement: 'KC_SCOLON', layers: 0xffff, trigger_mods: 0x02, negative_mod_mask: 0, suppressed_mods: 0x02, options: 0x80 };
        for (const variant of [{ trigger_mods: 0x01 }, { options: 0 }, { layers: 0b10 }]) {
            const board = svalDefault();
            board.key_overrides = [{ ...ko, ...variant }];
            expect(resolveFull(board).charAt(42, 0, 'u')).toBe(base.charAt(42, 0, 'u'));
        }
    });

    it('a key override with no trigger mods replaces the plain character', () => {
        const board = svalDefault();
        board.key_overrides = [{ koid: 0, trigger: 'KC_COMMA', replacement: 'KC_SCOLON', layers: 0xffff, trigger_mods: 0, negative_mod_mask: 0, suppressed_mods: 0, options: 0x80 }];
        const r = resolveFull(board);
        expect(r.charAt(42, 0, 'n')).toBe(cp(';'));
        expect(r.charAt(42, 0, 'u')).toBe(cp(':'));
        expect(r.primary(cp(','))).toBeNull();
    });
});

describe('whitespace table', () => {
    it('maps Space, Enter and Tab', () => {
        expect(whitespaceFor('KC_SPACE')).toBe(0x20);
        expect(whitespaceFor('KC_ENTER')).toBe(0x0a);
        expect(whitespaceFor('KC_TAB')).toBe(0x09);
        expect(whitespaceFor('KC_A')).toBeNull();
        expect(isWhitespaceChar(0x20)).toBe(true);
        expect(isWhitespaceChar(cp('a'))).toBe(false);
    });
});

describe('geometry', () => {
    it('places finger and thumb keys', () => {
        expect(keyPlace(4, 3)).toMatchObject({ index: 27, hand: 'left', finger: 'pinky', key: 'N', isThumb: false });
        expect(keyPlace(6, 1)).toMatchObject({ index: 37, hand: 'right', finger: 'index', key: 'E' });
        expect(keyPlace(0, 3)).toMatchObject({ index: 3, cluster: 'left_thumb', key: 'T1', isThumb: true });
        expect(keyPlace(5, 2)).toMatchObject({ index: 32, cluster: 'right_thumb', key: 'T5' });
        expect(keyPlace(1, 5)).toMatchObject({ key: '2S' });
        expect(keyPlace(10, 0)).toBeNull();
    });

    it('reads the board keylayout (52 keys on the default file)', () => {
        const keys = boardGeometry(svalDefault());
        expect(keys).toHaveLength(52);
        expect(keys.find((k) => k.index === 0)).toMatchObject({ x: 10.8, y: 6.5, w: 1.5, key: 'T6' });
    });

    it('falls back to the built-in Svalboard layout', () => {
        const keys = boardGeometry({ rows: 10, cols: 6 });
        expect(keys.length).toBeGreaterThan(40);
    });
});

describe('fingerprint', () => {
    it('is stable for the same keymap and changes with a remap, the default layer or the OS layout', async () => {
        const board = svalDefault();
        const a = await keymapFingerprint(resolveBoard(board));
        expect(a).toMatch(/^[\da-f]{64}$/);
        expect(await keymapFingerprint(resolveBoard(svalDefault()))).toBe(a);
        expect(await keymapFingerprint(resolveBoard(rebind(board, 0, 26, keyService.parse('KC_E'))))).not.toBe(a);
        expect(await keymapFingerprint(resolveBoard(board, { defaultLayer: 1 }))).not.toBe(a);
        expect(await keymapFingerprint(resolveBoard(board, { layoutId: 'uk' }))).not.toBe(a);
        expect(shortFingerprint(a)).toHaveLength(4);
        expect(fingerprintSource(resolveBoard(board))).toContain('layout=us');
    });
});
