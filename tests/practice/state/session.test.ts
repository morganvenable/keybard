import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyMiss, classifyPress } from '@/features/practice/input/classify';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { LessonRun } from '@/features/practice/state/lessonRun';
import {
    IDLE_PAUSE_MS,
    NOTICE_TEXT,
    PracticeController,
    resetPracticePageSession,
    type KeymapInput,
} from '@/features/practice/state/controller';
import { loadProfileData, minutesToday, PracticeSession, resolvePracticeKeymap } from '@/features/practice/state/session';
import { chartPoints, periodView, stripKeys } from '@/features/practice/state/progressView';
import { DEFAULT_SETTINGS, effectiveLessonType, type PracticeSettings, practiceSettings, START_PRESETS } from '@/features/practice/state/settings';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import { Lesson } from '@/features/practice/vendor/keybr/lesson/index.ts';
import { LCG } from '@/features/practice/vendor/keybr/rand/index.ts';
import type { IInputEvent } from '@/features/practice/vendor/keybr/textinput-events/index.ts';
import { keyService } from '@/services/key.service';
import { rebind, svalDefault } from '../fixtures/boards';
import { englishModel, englishWords } from '../fixtures/content';

const content = () => ({ model: englishModel(), words: englishWords() });
const cp = (s: string) => s.codePointAt(0)!;

function input(char: string, timeStamp: number): IInputEvent {
    return { type: 'input', timeStamp, inputType: 'appendChar', codePoint: cp(char), timeToType: 0 };
}

function backspace(timeStamp: number): IInputEvent {
    return { type: 'input', timeStamp, inputType: 'clearChar', codePoint: 0, timeToType: 0 };
}

/** Types the rest of a run's text, `ms` apart. */
function typeAll(run: LessonRun, start = 1000, ms = 200): number {
    let t = start;
    for (let guard = 0; guard < 3000 && !run.textInput.completed; guard++) {
        run.onInput(input(String.fromCodePoint(run.expected!), t));
        t += ms;
    }
    return t;
}

const keymap = (board = svalDefault()) => ({ board, layoutId: 'us', defaultLayer: 0 });

async function session(settings: Partial<PracticeSettings> = {}, store = new MemoryPracticeStore(), board = svalDefault()) {
    const s = { ...DEFAULT_SETTINGS, ...settings };
    const { resolution, fingerprint } = await resolvePracticeKeymap(keymap(board));
    const data = await loadProfileData(store, s);
    return new PracticeSession(store, true, content(), keymap(board), resolution, fingerprint, s, data);
}

describe('Miss classes (§6.6)', () => {
    const board = svalDefault();
    const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
    it('follows the worked example for ! on the default keymap', () => {
        expect(classifyMiss(resolution, cp('!'), cp('q'), 6)).toBe('wrong-layer');
        expect(classifyMiss(resolution, cp('!'), cp('1'), 6)).toBe('wrong-direction');
        expect(classifyMiss(resolution, cp('!'), cp('@'), 6)).toBe('wrong-finger');
    });

    it('wrong hand, wrong shift and unknown', () => {
        expect(classifyMiss(resolution, cp('a'), cp('j'), 6)).toBe('wrong-hand');
        expect(classifyMiss(resolution, cp('a'), cp('A'), 6)).toBe('wrong-shift');
        expect(classifyMiss(resolution, cp('a'), cp('é'), 6)).toBe('unknown');
        expect(classifyPress({ index: 26, layer: 0, shift: 'n' }, null, 6)).toBe('unknown');
    });
});

describe('LessonRun (§5.3, §6.5)', () => {
    const board = svalDefault();
    const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
    const run = (text = 'asdf jkl asdf') => new LessonRun({ text, textInput: { stopOnError: true, forgiveErrors: true, spaceSkipsWords: false }, resolution, cols: 6 });

    it('records hits with inferred keys and normalized time', () => {
        const r = run('as');
        r.onInput(input('a', 100));
        const out = r.onInput(input('s', 300));
        expect(out.completed).toBe(true);
        expect(r.events.map((e) => e.kind)).toEqual(['hit', 'hit']);
        expect(r.events[1]).toMatchObject({ t: 200, raw: 200, ttt: 200, path: '0:20:n', phys: { index: 20, layer: 0, confidence: 'inferred' } });
        expect(r.practiceSteps().map((s) => s.path)).toEqual(['0:26:n', '0:20:n']);
    });

    it('counts a new layer hold once and firmware Shift never (keymap only)', () => {
        const r = run('1!');
        r.onInput(input('1', 0));
        r.onInput(input('!', 300));
        // ! and 1 both sit under MO(1): the hold is not new for !, and its Shift is firmware.
        expect(r.events[1]).toMatchObject({ raw: 300, ttt: 300, prereq: [] });
        const s = run('a!');
        s.onInput(input('a', 0));
        s.onInput(input('!', 300));
        expect(s.events[1].ttt).toBe(150);
        expect(s.events[1].prereq).toHaveLength(1);
    });

    it('classifies a miss and records backspaces', () => {
        const r = run('asdf');
        r.onInput(input('a', 0));
        r.onInput(input('j', 100));
        r.onInput(backspace(200));
        r.onInput(input('s', 300));
        expect(r.events.map((e) => e.kind)).toEqual(['hit', 'miss', 'backspace', 'hit']);
        expect(r.events[1]).toMatchObject({ expected: cp('s'), typed: cp('j'), errorClass: 'wrong-hand', path: '0:20:n' });
        expect(r.textInput.steps[1].typo).toBe(true);
    });

    it('drops keystrokes while Caps Lock is on, and while paused', () => {
        const r = run('asdf');
        r.onKey({ type: 'keydown', timeStamp: 0, code: 'KeyA', key: 'A', modifiers: ['CapsLock'] });
        expect(r.capsLock).toBe(true);
        expect(r.onInput(input('A', 10)).ignored).toBe(true);
        expect(r.textInput.pos).toBe(0);
        r.onKey({ type: 'keydown', timeStamp: 20, code: 'KeyA', key: 'a', modifiers: [] });
        r.onInput(input('a', 30));
        r.pause(40);
        expect(r.phase).toBe('paused');
        expect(r.onInput(input('s', 50)).ignored).toBe(true);
        r.resume(1040);
        expect(r.pausedIntervals()).toEqual([[40, 1040]]);
        expect(r.events).toHaveLength(1);
    });

    it('ignores a stray Space before a word, as keybr does', () => {
        const r = run('as');
        r.onInput(input(' ', 0));
        expect(r.events).toHaveLength(0);
        expect(r.textInput.pos).toBe(0);
    });
});

describe('PracticeSession (§5.3, §6.1, §8)', () => {
    beforeEach(() => { Lesson.rng = LCG(7); });

    it('starts on first run with Center first letters and generates text from them', async () => {
        const s = await session();
        expect(s.firstRun).toBe(true);
        expect(s.noLetters).toBe(false);
        const included = s.lessonKeys.findIncludedKeys().map((k) => String.fromCodePoint(k.letter.codePoint)).sort().join('');
        expect(included).toBe('adfkls');
        const run = s.newRun(LCG(1));
        expect(run.textInput.length).toBeGreaterThanOrEqual(100);
    });

    it('saves a completed lesson with its events and snapshot, and reports a new key', async () => {
        const store = new MemoryPracticeStore();
        const s = await session({ targetSpeed: 75 }, store);
        await s.completeStart();
        const run = s.newRun(LCG(3));
        typeAll(run, 1000, 120);
        const done = await s.complete(run, { ts: Date.now(), src: 'keymap', board: 'example', os: 'us' });
        expect(done.valid).toBe(true);
        expect(done.saved).toBe(true);
        expect(store.results.size).toBe(1);
        expect(store.events.size).toBe(1);
        expect(store.snapshots.get('me')?.resultCount).toBe(1);
        expect(done.record.x).toMatchObject({ type: 'guided', src: 'keymap', board: 'example', km: s.fingerprint, inf: done.record.x.inf });
        expect(done.record.x.obs).toBe(0);
        // Fast typing on every included letter unlocks the 7th.
        expect(done.events.filter((e) => e.type === 'new-key')).toHaveLength(1);
        expect(s.lastLesson()?.speed).toBeGreaterThan(0);
        expect(s.firstRun).toBe(false);
    });

    it('drops an invalid lesson (too short) without saving it', async () => {
        const store = new MemoryPracticeStore();
        const s = await session({}, store);
        const run = new LessonRun({ text: 'asd', textInput: { stopOnError: true, forgiveErrors: true, spaceSkipsWords: false }, resolution: s.resolution, cols: 6 });
        typeAll(run);
        const done = await s.complete(run, { ts: 1, src: 'keymap', board: 'example', os: 'us' });
        expect(done).toMatchObject({ valid: false, saved: false });
        expect(store.results.size).toBe(0);
    });

    it('a remap restarts only the remapped letter (acceptance, §12 M1b)', async () => {
        const store = new MemoryPracticeStore();
        const s = await session({ alphabetSize: 1 }, store);
        const run = s.newRun(LCG(5));
        typeAll(run, 1000, 150);
        await s.complete(run, { ts: Date.now(), src: 'keymap', board: 'example', os: 'us' });
        const stats = (sess: PracticeSession, ch: string) => sess.keyStatsMap.get(sess.lesson.letters.find((l) => l.codePoint === cp(ch))!);
        const typed = new Set(run.textInput.steps.map((st) => st.codePoint));
        const [kept, moved] = [...typed].filter((c) => c >= 0x61 && c <= 0x7a).map((c) => String.fromCodePoint(c));
        expect(stats(s, moved).samples.length).toBe(1);

        // Move `moved` to an unused key; every other letter keeps its stats.
        const board = rebind(rebind(svalDefault(), 0, s.resolution.primary(cp(moved))!.index, keyService.parse('KC_NO')), 0, 59, keyService.parse(`KC_${moved.toUpperCase()}`));
        const after = await session({ alphabetSize: 1 }, store, board);
        expect(after.fingerprint).not.toBe(s.fingerprint);
        expect(stats(after, moved).samples.length).toBe(0);
        expect(stats(after, kept).samples.length).toBe(1);
    });

    it('counts minutes today in the local day', () => {
        const now = new Date(2026, 9, 9, 12).getTime();
        expect(minutesToday([{ ts: now - 60_000, t: 90_000 }, { ts: now - 2 * 86_400_000, t: 60_000 }], now)).toBe(1.5);
    });

    it('reads profiles written by a newer schema as read-only (§8.6)', async () => {
        const store = new MemoryPracticeStore();
        await store.addResult({ schema: 2, profileId: 'me' } as never);
        const data = await loadProfileData(store, DEFAULT_SETTINGS);
        expect(data.newerSchema).toBe(true);
        expect(data.records).toEqual([]);
    });
});

describe('Progress view (§5.8)', () => {
    it('rolls results in the period into summary, chart and characters', async () => {
        Lesson.rng = LCG(9);
        const store = new MemoryPracticeStore();
        const s = await session({ targetSpeed: 75 }, store);
        for (let i = 0; i < 2; i++) {
            const run = s.newRun(LCG(11 + i));
            typeAll(run, 1000, 150);
            await s.complete(run, { ts: Date.now() - i * 40 * 86_400_000, src: 'keymap', board: 'example', os: 'us' });
        }
        const all = periodView(s.lesson, s.records, s.target, (c) => s.resolution.primary(c), 'all');
        const month = periodView(s.lesson, s.records, s.target, (c) => s.resolution.primary(c), '30');
        expect(all.summary.lessons).toBe(2);
        expect(month.summary.lessons).toBe(1);
        expect(all.summary.topSpeed).toBeGreaterThan(0);
        expect(all.characters.find((c) => c.label === 'a')).toMatchObject({ samples: 2, path: { key: '0:26:n' } });
        expect(chartPoints(all.records, all.results, 'lessons')).toHaveLength(2);
        expect(chartPoints(all.records, all.results, 'days')).toHaveLength(2);
        const strip = stripKeys(s.lessonKeys);
        expect(strip[0].included).toBe(true);
        expect(strip.at(-1)!.included).toBe(false);
    });
});

describe('Practice settings for M1b (§5.5, §8.1)', () => {
    it('validates the display fields and the lesson type', () => {
        const s = practiceSettings({ type: 'drill', hints: 'loud', speedUnit: 'cpm', period: '7', showBoard: false });
        expect(s).toMatchObject({ type: 'drill', hints: 'next-cluster', speedUnit: 'cpm', period: '7', showBoard: false });
        expect(effectiveLessonType('drill')).toBe('guided');
        expect(START_PRESETS.learn).toMatchObject({ type: 'guided', hints: 'next-cluster' });
        expect(START_PRESETS.qwerty).toMatchObject({ type: 'guided', hints: 'next' });
        expect(START_PRESETS.drill).toMatchObject({ type: 'drill', hints: 'off' });
    });
});

describe('PracticeController (§4.4, §5.3)', () => {
    let saved: PracticeSettings[] = [];
    let clock = 0;
    let now = Date.now();
    const keymapInput = (overrides: Partial<KeymapInput> = {}): KeymapInput => ({
        board: svalDefault(), source: 'example', sourceLabel: 'QWERTY example (demo)', layoutId: 'us', defaultLayer: 0,
        connected: false, unsentChanges: false, hidSupported: true, ...overrides,
    });

    function controller(store = new MemoryPracticeStore(), persistent = true, settings: Partial<PracticeSettings> = {}) {
        saved = [];
        return new PracticeController({
            loadSettings: () => ({ ...DEFAULT_SETTINGS, ...settings }),
            saveSettings: (s) => { saved.push(s); return true; },
            openStore: async () => ({ store, persistent }),
            loadContent: async () => content(),
            now: () => now,
            clock: () => clock,
        });
    }

    async function ready(c: PracticeController, input = keymapInput()) {
        c.setKeymap(input);
        await c.start();
        await vi.waitFor(() => expect(c.session).not.toBeNull());
    }

    beforeEach(() => {
        Lesson.rng = LCG(13);
        resetPracticePageSession();
        clock = 0;
        now = Date.now();
    });
    afterEach(() => vi.useRealTimers());

    it('shows Start on first run, then a lesson after Start', async () => {
        const c = controller();
        await ready(c);
        expect(c.session!.firstRun).toBe(true);
        expect(c.run).toBeNull();
        await c.startPractice('qwerty', 175);
        expect(c.settings).toMatchObject({ alphabetSize: 1, hints: 'next', targetSpeed: 175 });
        expect(c.run).not.toBeNull();
        expect(c.session!.firstRun).toBe(false);
    });

    it('pauses on blur and leaving the page; focus alone does not resume', async () => {
        const c = controller(new MemoryPracticeStore(), true, {});
        await ready(c);
        await c.startPractice('learn', 125);
        c.setActive(true);
        expect(c.paused).toBe(true);
        c.setFocused(true);
        expect(c.paused).toBe(true);
        c.resume();
        expect(c.paused).toBe(false);
        c.setFocused(false);
        expect(c.paused).toBe(true);
        c.setFocused(true);
        c.resume();
        c.setActive(false);
        expect(c.paused).toBe(true);
    });

    it('pauses after 10 s idle and replaces a lesson paused over 10 minutes', async () => {
        const c = controller();
        await ready(c);
        await c.startPractice('learn', 125);
        c.setActive(true);
        c.setFocused(true);
        c.resume();
        vi.useFakeTimers();
        c.onInput(input(String.fromCodePoint(c.run!.expected!), 10));
        vi.advanceTimersByTime(IDLE_PAUSE_MS + 1);
        expect(c.paused).toBe(true);
        const first = c.run;
        now += 11 * 60_000;
        c.resume();
        expect(c.run).not.toBe(first);
        expect(c.run!.started).toBe(false);
    });

    it('regenerates on a lesson-shaping setting, keeps the lesson on a display setting', async () => {
        const c = controller();
        await ready(c);
        await c.startPractice('learn', 125);
        const run = c.run;
        c.update({ hints: 'off' });
        expect(c.run).toBe(run);
        c.update({ naturalWords: false });
        expect(c.run).not.toBe(run);
        vi.useFakeTimers();
        const before = c.run;
        c.update({ capitals: 0.5 }, { debounce: true });
        expect(c.saving).toBe(true);
        expect(c.run).toBe(before);
        vi.advanceTimersByTime(300);
        expect(c.run).not.toBe(before);
        expect(c.saving).toBe(false);
    });

    it('restarts the lesson with a notice when the keymap fingerprint changes', async () => {
        const c = controller();
        await ready(c);
        await c.startPractice('learn', 125);
        const run = c.run;
        // A new draft with the same keymap: nothing happens.
        c.setKeymap(keymapInput({ board: { ...svalDefault() } }));
        await new Promise((r) => setTimeout(r, 20));
        expect(c.run).toBe(run);
        c.setKeymap(keymapInput({ board: rebind(svalDefault(), 0, 15, keyService.parse('KC_Z')) }));
        await vi.waitFor(() => expect(c.run).not.toBe(run));
        expect(c.status).toMatchObject({ id: 'keymap-changed', text: NOTICE_TEXT['keymap-changed'] });
    });

    it('status slot priority: storage off over unsent changes over banners', async () => {
        const c = controller(new MemoryPracticeStore(), false);
        await ready(c, keymapInput({ unsentChanges: true, connected: true, source: 'connected' }));
        expect(c.status?.id).toBe('storage-off');
        const d = controller();
        await ready(d, keymapInput({ unsentChanges: true, connected: true, source: 'connected' }));
        expect(d.status?.id).toBe('unsent-changes');
    });

    it('completes a lesson, announces it and clears the banner on the next keystroke', async () => {
        const c = controller(new MemoryPracticeStore(), true, { targetSpeed: 75 });
        await ready(c);
        await c.startPractice('learn', 75);
        c.setActive(true);
        c.setFocused(true);
        c.resume();
        const run = c.run!;
        let t = 1000;
        for (let guard = 0; guard < 3000 && !run.textInput.completed; guard++) { c.onInput(input(String.fromCodePoint(run.expected!), t)); t += 120; }
        await vi.waitFor(() => expect(c.run).not.toBe(run));
        expect(c.announcement).toMatch(/^Lesson complete\. [\d.]+ words per minute, \d+ percent\./);
        expect(c.status?.id).toBe('new-key');
        expect(c.justUnlocked).not.toBeNull();
        c.onInput(input(String.fromCodePoint(c.run!.expected!), t + 100));
        expect(c.status).toBeNull();
    });

    it('creates and selects a profile', async () => {
        const store = new MemoryPracticeStore();
        const c = controller(store);
        await ready(c);
        const p = await c.createProfile('Sam');
        expect(p?.id).toBe('sam');
        await vi.waitFor(() => expect(c.session?.profile.id).toBe('sam'));
        expect(c.settings.activeProfileId).toBe('sam');
        expect(c.profiles.map((x) => x.name).sort()).toEqual(['Me', 'Sam']);
    });

    it('reports a content error and retries', async () => {
        let fail = true;
        const c = new PracticeController({
            loadSettings: () => DEFAULT_SETTINGS,
            saveSettings: () => true,
            openStore: async () => ({ store: new MemoryPracticeStore(), persistent: true }),
            loadContent: async () => { if (fail) throw new Error('offline'); return content(); },
        });
        c.setKeymap(keymapInput());
        await c.start();
        expect(c.loadState).toBe('content-error');
        fail = false;
        c.retry();
        await vi.waitFor(() => expect(c.loadState).toBe('ready'));
    });
});
