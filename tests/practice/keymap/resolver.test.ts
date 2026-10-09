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
        expect(parsePathKey('1:27:f')).toEqual({ layer: 1, index: 27, shift: 'f' });
        expect(parsePathKey('1:27:x')).toBeNull();
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
