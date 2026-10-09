import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type KeymapInput, PracticeController, resetPracticePageSession } from '@/features/practice/state/controller';
import type { LessonRun } from '@/features/practice/state/lessonRun';
import { ENGINE_VERSION, snapshotIsUsable } from '@/features/practice/state/progress';
import { periodView } from '@/features/practice/state/progressView';
import { loadProfileData, PracticeSession, resolvePracticeKeymap } from '@/features/practice/state/session';
import { DEFAULT_DRILL, DEFAULT_SETTINGS, type PracticeSettings } from '@/features/practice/state/settings';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import { Lesson } from '@/features/practice/vendor/keybr/lesson/index.ts';
import { LCG } from '@/features/practice/vendor/keybr/rand/index.ts';
import type { IInputEvent } from '@/features/practice/vendor/keybr/textinput-events/index.ts';
import { svalDefault } from '../fixtures/boards';
import { englishModel, englishWords } from '../fixtures/content';

// Drill, Words and Custom sessions (spec §5.3, §5.5, §8.3) and the controller's Drill this key (§5.7).

const content = () => ({ model: englishModel(), words: englishWords() });
const cp = (s: string) => s.codePointAt(0)!;
const keymap = (board = svalDefault()) => ({ board, layoutId: 'us', defaultLayer: 0 });
const meta = (ts = Date.now()) => ({ ts, src: 'keymap' as const, board: 'example', os: 'us' });

function input(char: string, timeStamp: number): IInputEvent {
    return { type: 'input', timeStamp, inputType: 'appendChar', codePoint: cp(char), timeToType: 0 };
}

function typeAll(run: LessonRun, start = 1000, ms = 150): number {
    let t = start;
    for (let guard = 0; guard < 3000 && !run.textInput.completed; guard++) {
        run.onInput(input(String.fromCodePoint(run.expected!), t));
        t += ms;
    }
    return t;
}

async function session(settings: Partial<PracticeSettings> = {}, store = new MemoryPracticeStore()) {
    const s = { ...DEFAULT_SETTINGS, ...settings };
    const { resolution, fingerprint } = await resolvePracticeKeymap(keymap());
    const data = await loadProfileData(store, s);
    const snapshot = await store.getSnapshot(data.profile.id);
    return new PracticeSession(store, true, content(), keymap(), resolution, fingerprint, s, data, snapshot);
}

const drill = (patch: Partial<typeof DEFAULT_DRILL>): Partial<PracticeSettings> => ({ type: 'drill', drill: { ...DEFAULT_DRILL, ...patch } });

describe('Drill sessions', () => {
    beforeEach(() => { Lesson.rng = LCG(21); });

    it('saves a Drill lesson with its type and scope, and announces no new keys', async () => {
        const store = new MemoryPracticeStore();
        const s = await session(drill({ layer: 1, group: 'symbols', dirs: ['N', 'S'] }), store);
        expect(s.noLesson).toBe(false);
        expect(new Set(s.lessonKeys.findIncludedKeys().map((k) => String.fromCodePoint(k.letter.codePoint)))).toEqual(new Set('$#@!&*()'));
        const run = s.newRun(LCG(2));
        typeAll(run);
        const done = await s.complete(run, meta());
        expect(done.valid).toBe(true);
        expect(done.record.m).toBe('generated');
        expect(done.record.x.type).toBe('drill');
        expect(done.record.x.scope).toEqual({ layer: 1, group: 'symbols', dirs: ['N', 'S'], hands: null, thumbs: true });
        expect(done.events.filter((e) => e.type === 'new-key')).toEqual([]);
        // The symbols' samples are stored per path, e.g. "!" through MO(1).
        expect(Object.keys(done.record.h).some((k) => k.startsWith(`${cp('!')}|1:27:f`))).toBe(true);
    });

    it('Numbers with Benford saves keybr\'s numbers text type', async () => {
        const s = await session(drill({ layer: 1, group: 'numbers' }));
        const run = s.newRun(LCG(3));
        expect(String(run.textInput.text)).toMatch(/^[0-9 ]+$/);
        typeAll(run);
        expect((await s.complete(run, meta())).record.m).toBe('numbers');
    });

    it('a scope under 3 characters is Nothing to drill: no lesson runs', async () => {
        const s = await session(drill({ layer: 1, group: 'letters' }));
        expect(s.nothingToDrill).toBe(true);
        expect(s.noLesson).toBe(true);
        expect(s.noLetters).toBe(false);
    });

    it('keeps every character\'s stats across lesson types: a Drill session restores a Guided snapshot', async () => {
        const store = new MemoryPracticeStore();
        const guided = await session({ alphabetSize: 1 }, store);
        const run = guided.newRun(LCG(5));
        typeAll(run);
        await guided.complete(run, meta());
        const snapshot = await store.getSnapshot('me');
        expect(snapshot?.engineVersion).toBe(ENGINE_VERSION);
        // The snapshot holds every tracked character, symbols included.
        expect(snapshot!.keyStats.some((k) => k.codePoint === cp('#'))).toBe(true);
        const d = await session(drill({ layer: 0, group: 'letters' }), store);
        const a = d.keyStatsMap.get(d.trackedLetters.find((l) => l.codePoint === cp('a'))!);
        const typedA = run.textInput.steps.some((st) => st.codePoint === cp('a'));
        expect(a.samples.length).toBe(typedA ? 1 : 0);
        // A snapshot that lacks a tracked character is not used (it would start it empty).
        expect(snapshotIsUsable({ ...snapshot!, keyStats: snapshot!.keyStats.slice(1) }, {
            resultCount: 1, keymapFingerprint: d.fingerprint, codePoints: d.trackedLetters.map((l) => l.codePoint),
        })).toBe(false);
    });

    it('Progress lists the language letters always and other characters once practiced', async () => {
        const store = new MemoryPracticeStore();
        const s = await session(drill({ layer: 1, group: 'symbols', dirs: ['N', 'S'] }), store);
        const run = s.newRun(LCG(2));
        typeAll(run);
        await s.complete(run, meta());
        const view = periodView(s.lesson, s.records, s.target, (c) => s.resolution.primary(c), 'all', Date.now(), {
            tracked: s.trackedLetters, always: new Set(s.languageLetters.map((l) => l.codePoint)),
        });
        const labels = view.characters.map((c) => c.label);
        expect(labels).toContain('z');
        expect(labels.filter((l) => '$#@!&*()'.includes(l)).length).toBeGreaterThan(0);
        expect(labels).not.toContain('~');
    });
});

describe('Words and Custom sessions', () => {
    it('Words saves a natural-text result', async () => {
        const s = await session({ type: 'words', words: { size: 100, longOnly: false } });
        const run = s.newRun(LCG(4));
        typeAll(run);
        const done = await s.complete(run, meta());
        expect(done.record.m).toBe('natural');
        expect(done.record.x.type).toBe('words');
    });

    it('Custom types the text without its untypeable characters and saves a natural-text result', async () => {
        const s = await session({ type: 'custom', customText: { content: 'Café — open late, every day', lowercase: true, lettersOnly: false, randomize: false } });
        expect(s.emptyCustom).toBe(false);
        const run = s.newRun(LCG(4));
        expect(String(run.textInput.text).startsWith('caf open late, every day caf')).toBe(true);
        typeAll(run);
        const done = await s.complete(run, meta());
        expect(done.record).toMatchObject({ m: 'natural', x: { type: 'custom' } });
    });

    it('a Custom text with nothing typeable runs no lesson', async () => {
        const s = await session({ type: 'custom', customText: { content: 'ééé', lowercase: true, lettersOnly: true, randomize: false } });
        expect(s.emptyCustom).toBe(true);
        expect(s.noLesson).toBe(true);
    });
});

describe('Controller: Drill this key and the Drill scope (§5.5, §5.7)', () => {
    const keymapInput = (): KeymapInput => ({
        board: svalDefault(), source: 'example', sourceLabel: 'QWERTY example (demo)', layoutId: 'us', defaultLayer: 0,
        connected: false, unsentChanges: false, hidSupported: true,
    });

    async function ready(settings: Partial<PracticeSettings> = {}) {
        resetPracticePageSession();
        const c = new PracticeController({
            loadSettings: () => ({ ...DEFAULT_SETTINGS, ...settings }),
            saveSettings: () => true,
            openStore: async () => ({ store: new MemoryPracticeStore(), persistent: true }),
            loadContent: async () => content(),
        });
        c.setKeymap(keymapInput());
        await c.start();
        await vi.waitFor(() => expect(c.session).not.toBeNull());
        await c.startPractice('learn', 125);
        return c;
    }

    it('Drill this key drills the character and its cluster, focused on it', async () => {
        const c = await ready();
        c.drillKey(cp('!'));
        await vi.waitFor(() => expect(c.session?.type).toBe('drill'));
        expect(c.settings.drill.focus).toBe(cp('!'));
        expect(c.settings.drill.keys).toContain(cp('1'));
        expect(c.session!.lessonKeys.findFocusedKey()?.letter.codePoint).toBe(cp('!'));
        expect(String(c.run!.textInput.text)).toContain('!');
    });

    it('changing the scope in the panel ends Drill this key', async () => {
        const c = await ready();
        c.drillKey(cp('!'));
        c.updateDrill({ group: 'symbols' });
        expect(c.settings.drill).toMatchObject({ group: 'symbols', keys: null, focus: null });
    });

    it('Nothing to drill shows no lesson, and a wider scope brings one back', async () => {
        const c = await ready();
        c.update(drill({ layer: 1, group: 'letters' }));
        await vi.waitFor(() => expect(c.session?.nothingToDrill).toBe(true));
        expect(c.run).toBeNull();
        c.updateDrill({ group: 'all' });
        await vi.waitFor(() => expect(c.run).not.toBeNull());
    });

    it('the Drill my keymap preset runs Drill → Weakest', async () => {
        resetPracticePageSession();
        const c = new PracticeController({
            loadSettings: () => ({ ...DEFAULT_SETTINGS }),
            saveSettings: () => true,
            openStore: async () => ({ store: new MemoryPracticeStore(), persistent: true }),
            loadContent: async () => content(),
        });
        c.setKeymap(keymapInput());
        await c.start();
        await vi.waitFor(() => expect(c.session).not.toBeNull());
        await c.startPractice('drill', 225);
        await vi.waitFor(() => expect(c.session?.type).toBe('drill'));
        expect(c.settings.drill.group).toBe('weakest');
        expect(c.session!.lessonKeys.findIncludedKeys()).toHaveLength(8);
    });
});
