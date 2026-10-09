import { describe, expect, it } from 'vitest';
import { eligibleTemplates, NUMBER, SYMBOL_TEMPLATES, symbolTokens, templateChars, WORD } from '@/features/practice/content/symbols';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { boardGeometry } from '@/features/practice/keymap/geometry';
import { svalKeyboard } from '@/features/practice/keymap/svalKeyboard';
import { PracticeCustomLesson, stripUntypeable, untypeableChars } from '@/features/practice/lessons/custom';
import { PracticeDrillLesson } from '@/features/practice/lessons/drill';
import { numberTokens } from '@/features/practice/lessons/numbers';
import {
    charClass, clusterScope, drillFocus, drillScope, drillScopeLabel, hasDoubleSouth, isAsciiSymbol, MIN_DRILL_SCOPE, weakest,
} from '@/features/practice/lessons/scope';
import { PracticeWordsLesson } from '@/features/practice/lessons/words';
import { trackedLetters } from '@/features/practice/state/progress';
import {
    DEFAULT_DRILL, DEFAULT_SETTINGS, DRILL_DIRECTIONS, type DrillSettings, drillSettings, type PracticeSettings, practiceSettings, toKeybrSettings,
} from '@/features/practice/state/settings';
import { buildResultRecord, PracticeResult, type PracticeStep } from '@/features/practice/store/results';
import type { KeystrokeEvent } from '@/features/practice/types';
import { LCG } from '@/features/practice/vendor/keybr/rand/index.ts';
import { makeKeyStatsMap, speedToTime } from '@/features/practice/vendor/keybr/result/index.ts';
import { svalDefault } from '../fixtures/boards';
import { englishModel, englishWords } from '../fixtures/content';

// Drill, Words and Custom content (spec §5.5, §6.2, §7.3, §7.4) on the default keymap
// (src/default-layouts/sval-default.svil).

const cp = (s: string) => s.codePointAt(0)!;
const str = (list: readonly number[]) => list.map((c) => String.fromCodePoint(c)).join('');
const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const keyboard = svalKeyboard(board, resolution);
const letterFrequency = new Map(englishModel().letters.map((l) => [l.codePoint, l.f]));
const weight = (c: number) => keyboard.getCodePoints().weight(c);
const noProgress = () => ({ confidence: null, samples: 0 });
const scope = (drill: Partial<DrillSettings>, progress = noProgress) =>
    drillScope({ resolution, cols: board.cols, letterFrequency, drill: { ...DEFAULT_DRILL, group: 'all', ...drill }, weight, progress });

function drillLesson(drill: Partial<DrillSettings>, settings: Partial<PracticeSettings> = {}) {
    const s = { ...DEFAULT_SETTINGS, ...settings, drill: { ...DEFAULT_DRILL, group: 'all' as const, ...drill } };
    return new PracticeDrillLesson(toKeybrSettings(s), keyboard, englishModel(), englishWords(), s.drill);
}

/** A result where each listed character was typed `ms[char]` per character, three times. */
function resultAt(chars: string, ms: (ch: string) => number, ts: number) {
    const events: KeystrokeEvent[] = [];
    const steps: PracticeStep[] = [];
    let t = 0;
    for (const ch of chars[0] + chars.repeat(3)) {
        const c = cp(ch);
        const path = resolution.primary(c)!;
        const time = t === 0 ? 0 : ms(ch);
        events.push({
            t, expected: c, typed: c, kind: 'hit', raw: time, ttt: t === 0 ? null : time, path: path.key, prereq: [],
            phys: { index: path.index, layer: path.layer, confidence: 'inferred', skew: null, reach: null, target: null },
        });
        steps.push({ timeStamp: t, codePoint: c, timeToType: time, typo: false, path: path.key });
        t += Math.max(time, 50);
    }
    return new PracticeResult(buildResultRecord({
        profileId: 'me', type: 'drill', textType: 'generated', ts, steps, events,
        target: 175, src: 'keymap', board: 'example', os: 'us', km: 'test',
    }));
}

describe('Drill scope (§5.5, §6.2)', () => {
    it('classes characters: language letters, digits and ASCII punctuation; never whitespace or capitals', () => {
        const letters = new Set(letterFrequency.keys());
        expect(charClass(cp('a'), letters)).toBe('letter');
        expect(charClass(cp('7'), letters)).toBe('digit');
        expect(charClass(cp('#'), letters)).toBe('symbol');
        expect(charClass(cp('A'), letters)).toBeNull();
        expect(charClass(0x20, letters)).toBeNull();
        expect([...'!/:@[`{~'].every((c) => isAsciiSymbol(cp(c)))).toBe(true);
        expect([...'a0 A'].some((c) => isAsciiSymbol(cp(c)))).toBe(false);
    });

    it('Layer 1 · Symbols · N S on the default keymap is the eight layer-1 north symbols (M-16, M-21)', () => {
        const chars = scope({ layer: 1, group: 'symbols', dirs: ['N', 'S'] });
        expect(new Set(str(chars))).toEqual(new Set('$#@!&*()'));
    });

    it('Layer 1 · All holds the digits and the layer-1 symbols', () => {
        const chars = str(scope({ layer: 1 }));
        for (const ch of '0123456789!#$%&()*+-=@^_') expect(chars).toContain(ch);
        expect(chars).not.toMatch(/[a-z]/);
    });

    it('filters by directions, hands and thumbs', () => {
        // Layer 1 center keys: the digits on the finger centers.
        expect(new Set(str(scope({ layer: 1, dirs: ['C'] })))).toEqual(new Set('12347890'));
        expect(new Set(str(scope({ layer: 1, dirs: ['C'], hands: 'left' })))).toEqual(new Set('1234'));
        // No character of the default keymap's lesson classes sits on a thumb key: Thumbs changes nothing here.
        expect(scope({ layer: 0, thumbs: false })).toEqual(scope({ layer: 0, thumbs: true }));
        expect(scope({ group: 'letters', layer: 1 })).toEqual([]);
    });

    it('lists the scope in unlock order: tier, then frequency', () => {
        const letters = str(scope({ layer: 0, group: 'letters' }));
        expect(letters.slice(0, 7)).toMatch(/^[adfkls]{6}j$/);
        expect(letters[7]).toBe('e');
    });

    it('Weakest: the 8 lowest-confidence calibrated characters, filled up with uncalibrated ones in unlock order', () => {
        const candidates = scope({ layer: 0, group: 'letters' });
        // No samples: the first 8 in unlock order.
        expect(weakest(candidates, noProgress)).toEqual(candidates.slice(0, 8));
        // Two calibrated slow letters come first; six uncalibrated fill up the rest.
        const progress = (c: number) => (c === cp('z') ? { confidence: 0.2, samples: 5 } : c === cp('q') ? { confidence: 0.4, samples: 5 }
            : c === cp('a') ? { confidence: 1.5, samples: 5 } : { confidence: null, samples: 0 });
        const picked = weakest(candidates, progress);
        expect(picked).toHaveLength(8);
        expect(picked).toContain(cp('z'));
        expect(picked).toContain(cp('q'));
        expect(picked).toContain(cp('a'));
        expect(str(picked.filter((c) => c !== cp('z') && c !== cp('q') && c !== cp('a')))).toBe(
            str(candidates.filter((c) => c !== cp('a')).slice(0, 5)));
    });

    it('focuses Drill this key\'s character while it is below target, else the weakest', () => {
        const chars = [cp('!'), cp('1'), cp('=')];
        const progress = (c: number) => ({ confidence: c === cp('=') ? 0.3 : c === cp('!') ? 0.9 : 1.2, samples: 4 });
        expect(drillFocus(chars, progress, cp('!'))).toBe(cp('!'));
        expect(drillFocus(chars, progress, null)).toBe(cp('='));
        const done = (c: number) => ({ confidence: c === cp('!') ? 1.1 : 0.5, samples: 4 });
        expect(drillFocus(chars, done, cp('!'))).toBe(cp('1'));
    });

    it('Drill this key: the character and its cluster neighbors on its layer', () => {
        const keys = clusterScope(resolution, cp('!'), board.cols, letterFrequency);
        expect(keys[0]).toBe(cp('!'));
        expect(str(keys)).toContain('1');
        expect(str(keys)).toContain('=');
        expect(keys.length).toBeGreaterThanOrEqual(MIN_DRILL_SCOPE);
        // The scope is those characters, whatever else the Drill settings say.
        expect(new Set(scope({ keys, focus: cp('!'), layer: 0, group: 'letters' }))).toEqual(new Set(keys));
    });

    it('labels the scope for the type row (§5.2)', () => {
        const name = (layer: number) => `Layer ${layer}`;
        const dirs = DRILL_DIRECTIONS.filter((d) => d !== '2S');
        expect(drillScopeLabel({ ...DEFAULT_DRILL, layer: 1, group: 'symbols', dirs: ['N', 'S'] }, name, dirs)).toBe('Layer 1 · Symbols · N S');
        expect(drillScopeLabel({ ...DEFAULT_DRILL, group: 'all' }, name, dirs)).toBe('All keys');
        expect(drillScopeLabel(DEFAULT_DRILL, name, dirs)).toBe('Weakest');
        expect(drillScopeLabel({ ...DEFAULT_DRILL, group: 'all', hands: 'left', thumbs: false }, name, dirs)).toBe('Left hand · No thumbs');
        expect(drillScopeLabel({ ...DEFAULT_DRILL, keys: [cp('!'), cp('1')], focus: cp('!') }, name, dirs)).toBe('! and its cluster');
    });

    it('the default board has 5-key finger clusters: no 2S chip', () => {
        expect(hasDoubleSouth(boardGeometry(board))).toBe(false);
        expect(hasDoubleSouth([{ isThumb: false, key: '2S' }])).toBe(true);
    });

    it('validates stored Drill settings field by field', () => {
        expect(drillSettings({ layer: 1, group: 'symbols', dirs: ['N', 'X', 'S'], hands: 'left', thumbs: false, benford: false }))
            .toEqual({ layer: 1, group: 'symbols', dirs: ['N', 'S'], hands: 'left', thumbs: false, benford: false, keys: null, focus: null });
        expect(drillSettings({ layer: -1, group: 'nope', hands: 3, keys: [33, 'x', 49], focus: 99 }))
            .toMatchObject({ layer: null, group: 'weakest', hands: 'both', keys: [33, 49], focus: null });
        expect(drillSettings({ keys: [33, 49], focus: 33 })).toMatchObject({ keys: [33, 49], focus: 33 });
        expect(practiceSettings({ words: { size: 5000, longOnly: 'yes' }, drillLayerUnderlines: false }))
            .toMatchObject({ words: { size: 1000, longOnly: false }, drillLayerUnderlines: false, drill: DEFAULT_DRILL });
    });
});

describe('Symbol templates (§7.3)', () => {
    it('lists every template of the spec table', () => {
        expect(SYMBOL_TEMPLATES).toContain(`(${WORD})`);
        expect(SYMBOL_TEMPLATES).toContain(`${WORD} != ${WORD}`);
        expect(SYMBOL_TEMPLATES).toContain(`~/${WORD}`);
        expect(SYMBOL_TEMPLATES).toContain(`${NUMBER}%`);
        expect(SYMBOL_TEMPLATES).toHaveLength(38);
        expect(templateChars(`${WORD} != ${WORD}`).sort()).toEqual([0x20, cp('!'), cp('=')].sort());
    });

    it('a template is eligible only when all its symbols are in the alphabet', () => {
        const alphabet = new Set([cp('#'), cp('('), cp(')')]);
        const eligible = eligibleTemplates({ alphabet, spaceTypeable: true }, false);
        expect(eligible.sort()).toEqual([`#${WORD}`, `(${WORD})`].sort());
        // Digit templates need digits.
        expect(eligibleTemplates({ alphabet: new Set([cp('#'), cp('1')]), spaceTypeable: true }, true)).toContain(`#${NUMBER}`);
        // Spaced templates need Space.
        expect(eligibleTemplates({ alphabet: new Set([cp('+')]), spaceTypeable: false }, false)).toEqual([]);
    });

    it('every token contains the focused symbol and only typeable characters (acceptance)', () => {
        // Every symbol the default keymap types, in random scopes of three to eight.
        const symbols = resolution.codePoints.filter(isAsciiSymbol);
        const digits = resolution.codePoints.filter((c) => c >= 0x30 && c <= 0x39);
        const rng = LCG(7);
        for (let round = 0; round < 200; round++) {
            const size = 3 + Math.floor(rng() * 6);
            const alphabet = new Set([...symbols].sort(() => rng() - 0.5).slice(0, size));
            if (rng() < 0.3) for (const d of digits) alphabet.add(d);
            const symbolList = [...alphabet].filter(isAsciiSymbol);
            const focus = symbolList[Math.floor(rng() * symbolList.length)];
            const numbers = numberTokens({ digits: [...alphabet].filter((c) => c >= 0x30 && c <= 0x39), focus: null, benford: false }, rng);
            const next = symbolTokens({ alphabet, spaceTypeable: true, focus, word: () => 'sad', number: () => numbers?.() ?? null }, rng);
            const allowed = new Set([...alphabet, cp('s'), cp('a'), cp('d'), 0x20]);
            for (let i = 0; i < 20; i++) {
                const token = next();
                expect(token).toContain(String.fromCodePoint(focus));
                for (const ch of token) expect(allowed.has(cp(ch)), `${token} in ${str([...alphabet])}`).toBe(true);
                for (const ch of token) expect(resolution.primary(cp(ch))).not.toBeNull();
            }
        }
    });

    it('a symbol with a single template still mixes with the others by nesting (M-21, focus #)', () => {
        const alphabet = new Set([...'$#@!&*()'].map(cp));
        const next = symbolTokens({ alphabet, spaceTypeable: true, focus: cp('#'), word: () => 'sad', number: () => null }, LCG(3));
        const tokens = Array.from({ length: 60 }, next);
        expect(tokens.every((t) => t.includes('#'))).toBe(true);
        expect(tokens.some((t) => /[()!*&@$]/.test(t))).toBe(true);
    });
});

describe('Number tokens (§7.3)', () => {
    it('Benford: 3–6 digits from the scope, a non-zero first digit, each with the focused digit', () => {
        const next = numberTokens({ digits: [...'0129'].map(cp), focus: cp('9'), benford: true }, LCG(5))!;
        for (let i = 0; i < 100; i++) {
            const token = next();
            expect(token).toMatch(/^[129][0129]{2,5}$/);
            expect(token).toContain('9');
        }
    });

    it('Benford off: digit tokens of 2–5 digits', () => {
        const next = numberTokens({ digits: [...'12'].map(cp), focus: cp('2'), benford: false }, LCG(5))!;
        for (let i = 0; i < 50; i++) expect(next()).toMatch(/^[12]{2,5}$/);
    });

    it('no digits, no numbers', () => {
        expect(numberTokens({ digits: [], focus: null, benford: true }, LCG(1))).toBeNull();
    });
});

describe('Drill lessons (§6.2, §7.3)', () => {
    it('Layer 1 drill on the default keymap teaches digits and symbols adaptively (M3 acceptance)', () => {
        const lesson = drillLesson({ layer: 1 });
        const tracked = trackedLetters(lesson, resolution.codePoints);
        const chars = str(lesson.letters.map((l) => l.codePoint));
        expect(chars).toMatch(/[0-9]/);
        expect(chars).toMatch(/[!#$]/);

        // Fresh profile: everything in scope is included, the first in unlock order is focused.
        const fresh = lesson.update(makeKeyStatsMap(tracked, []));
        expect(fresh.findIncludedKeys()).toHaveLength(lesson.letters.length);
        const firstFocus = fresh.findFocusedKey()!.letter.codePoint;

        // Everything typed at target except '#' and '7', which are slow: the focus moves to the slowest.
        const fast = speedToTime(175) * 0.7;
        const slow = (ch: string) => (ch === '#' ? fast * 4 : ch === '7' ? fast * 3 : fast);
        const results = [resultAt(chars, slow, 1), resultAt(chars, slow, 2)];
        const keys = lesson.update(makeKeyStatsMap(tracked, lesson.filter(results)));
        expect(String.fromCodePoint(keys.findFocusedKey()!.letter.codePoint)).toBe('#');
        expect(keys.findFocusedKey()!.letter.codePoint).not.toBe(firstFocus === cp('#') ? -1 : firstFocus);

        // The text works on '#' and stays typeable; once '#' is fast, the focus moves on to '7'.
        const text = String(lesson.generate(keys, LCG(11)));
        expect(text.length).toBeGreaterThanOrEqual(100);
        for (const ch of text) expect(resolution.primary(cp(ch)), ch).not.toBeNull();
        const count = (ch: string) => [...text].filter((c) => c === ch).length;
        expect(count('#')).toBeGreaterThan(5);
        const better = (ch: string) => (ch === '7' ? fast * 3 : fast);
        // keybr filters time to type (α = 0.1), so '#' needs a run of fast lessons to catch up.
        const more = Array.from({ length: 10 }, (_, i) => resultAt(chars, better, 3 + i));
        const later = lesson.update(makeKeyStatsMap(tracked, lesson.filter([...results, ...more])));
        expect(String.fromCodePoint(later.findFocusedKey()!.letter.codePoint)).toBe('7');
        const digitText = String(lesson.generate(later, LCG(12)));
        expect([...digitText].filter((c) => c === '7').length).toBeGreaterThan(5);
        for (const ch of digitText) expect(resolution.primary(cp(ch)), ch).not.toBeNull();
    });

    it('a symbol drill\'s words come from the letters Guided has unlocked', () => {
        const lesson = drillLesson({ layer: 1, group: 'symbols', dirs: ['N', 'S'] });
        const keys = lesson.update(makeKeyStatsMap(trackedLetters(lesson, resolution.codePoints), []));
        const text = String(lesson.generate(keys, LCG(2)));
        // A fresh profile has Guided's six center letters.
        expect(text.replace(/[^a-z]/g, '')).toMatch(/^[adfkls]+$/);
    });

    it('Numbers with Benford is keybr\'s numbers text type', () => {
        expect(drillLesson({ group: 'numbers', layer: 1 }).textType).toBe('numbers');
        expect(drillLesson({ group: 'numbers', layer: 1, benford: false }).textType).toBe('generated');
        expect(drillLesson({ group: 'symbols' }).textType).toBe('generated');
        const lesson = drillLesson({ group: 'numbers', layer: 1 });
        const keys = lesson.update(makeKeyStatsMap(trackedLetters(lesson, resolution.codePoints), []));
        expect(String(lesson.generate(keys, LCG(4)))).toMatch(/^[0-9 ]+$/);
    });

    it('Weakest on a fresh profile drills the first 8 characters in unlock order', () => {
        const lesson = drillLesson({ group: 'weakest' });
        const keys = lesson.update(makeKeyStatsMap(trackedLetters(lesson, resolution.codePoints), []));
        expect(keys.findIncludedKeys()).toHaveLength(8);
    });
});

describe('Words lessons (§5.5)', () => {
    it('draws from the most frequent words that can be typed, Long words only keeping 4+ letters', () => {
        const settings = toKeybrSettings({ ...DEFAULT_SETTINGS, words: { size: 50, longOnly: true } });
        const lesson = new PracticeWordsLesson(settings, keyboard, englishModel(), englishWords());
        expect(lesson.wordList.length).toBeLessThanOrEqual(50);
        expect(lesson.wordList.every((w) => w.length > 3)).toBe(true);
        const keys = lesson.update(makeKeyStatsMap(trackedLetters(lesson, resolution.codePoints), []));
        expect(keys.findIncludedKeys()).toHaveLength(26);
        const text = String(lesson.generate(keys, LCG(9)));
        for (const word of text.split(' ')) expect(lesson.wordList).toContain(word);
    });
});

describe('Custom text (§5.10, §7.4)', () => {
    it('flags untypeable characters and keeps spaces (M3 acceptance)', () => {
        const text = 'Résumé — the end\nof\tit';
        expect(str(untypeableChars(text, resolution))).toBe('é—');
        expect(stripUntypeable(text, resolution)).toBe('Rsum  the end\nof\tit');
        const settings = toKeybrSettings({ ...DEFAULT_SETTINGS, customText: { content: text, lowercase: true, lettersOnly: false, randomize: false } });
        const lesson = new PracticeCustomLesson(settings, keyboard, englishModel());
        expect(lesson.empty).toBe(false);
        const out = String(lesson.generate(lesson.update(makeKeyStatsMap(trackedLetters(lesson, resolution.codePoints), [])), LCG(1)));
        expect(out.startsWith('rsum the end of it rsum')).toBe(true);
    });

    it('a text with nothing typeable is empty', () => {
        const settings = toKeybrSettings({ ...DEFAULT_SETTINGS, customText: { content: 'éé ——', lowercase: true, lettersOnly: true, randomize: false } });
        expect(new PracticeCustomLesson(settings, keyboard, englishModel()).empty).toBe(true);
    });

    it('lists Space when the keymap has no Space key', () => {
        const noSpace = svalDefault();
        noSpace.keymap = noSpace.keymap!.map((layer) => layer.map((code, i) => (i === 33 ? 0 : code)));
        const r = resolveKeymap({ keymap: noSpace.keymap, rows: noSpace.rows, cols: noSpace.cols });
        if (r.primary(0x20)) return; // Another Space key on the keymap: nothing to check.
        expect(untypeableChars('a b', r)).toEqual([0x20]);
    });
});
