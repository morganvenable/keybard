import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveInput } from '@/features/practice/input/liveInput';
import { layerLockedText, type PracticeController } from '@/features/practice/state/controller';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import type { IInputEvent } from '@/features/practice/vendor/keybr/textinput-events/index.ts';
import { svalDefault } from '../fixtures/boards';
import { FakeBoard, settle } from '../input/fakeBoard';
import { resetHarness, startController } from '../ui/harness';

// Live · USB in the controller (spec §3.2, §5.3, §9.3, §12 M2): the mode, reading only while the text has
// focus and the lesson runs, falling back without losing the lesson, Layer locked on, and observed results.

const board = svalDefault();
const connected = { source: 'connected' as const, connected: true, sourceLabel: 'Svalboard' };
const input = (codePoint: number, timeStamp: number): IInputEvent => ({ type: 'input', timeStamp, inputType: 'appendChar', codePoint, timeToType: 0 });

let fake: FakeBoard;
let live: LiveInput;

async function liveController(options: Parameters<typeof startController>[0] = {}): Promise<PracticeController> {
    fake = new FakeBoard();
    live = new LiveInput({ pollMatrix: fake.pollMatrix, getLayerMasks: fake.getLayerMasks, clock: fake.clock, sleep: fake.sleep });
    const c = await startController({ keymap: connected, ...options });
    c.attachLive(live);
    await vi.waitFor(() => expect(c.live).toBe(live));
    return c;
}

/** Focuses the text and resumes, as a click on the text card does. */
function focusAndResume(c: PracticeController) {
    c.setFocused(true);
    c.resume();
}

afterEach(() => {
    live?.dispose();
    resetHarness();
});

describe('Live · USB mode (§3.2)', () => {
    it('reads only while the text has focus and the lesson runs; the pill shows Live · USB', async () => {
        const c = await liveController();
        expect(c.liveAvailable).toBe(true);
        expect(c.pressedKeysValue).toBe('Shown');
        expect(live.running).toBe(false); // not focused: paused
        focusAndResume(c);
        expect(c.inputMode).toBe('usb');
        expect(live.running).toBe(true);
        await fake.reply([], 10);
        expect(fake.pollMatrix).toHaveBeenCalledTimes(2);
    });

    it('stops reading within one iteration of blur (D10)', async () => {
        const c = await liveController();
        focusAndResume(c);
        await fake.reply([], 10);
        const started = performance.now();
        c.setFocused(false);
        expect(live.running).toBe(false);
        expect(c.paused).toBe(true);
        expect(c.inputMode).toBe('keymap');
        // The request in flight comes back and nothing more is asked.
        const calls = fake.pollMatrix.mock.calls.length;
        await fake.reply([], 20);
        await settle();
        expect(fake.pollMatrix.mock.calls.length).toBe(calls);
        expect(performance.now() - started).toBeLessThan(100);
    });

    it('a hidden tab, leaving the page or turning off Read key presses stops reading', async () => {
        const c = await liveController();
        focusAndResume(c);
        c.setVisible(false);
        expect(live.running).toBe(false);
        c.setVisible(true);
        focusAndResume(c);
        expect(live.running).toBe(true);
        c.setActive(false);
        expect(live.running).toBe(false);
        c.setActive(true);
        focusAndResume(c);
        expect(live.running).toBe(true);
        c.update({ readKeyPresses: false });
        expect(live.running).toBe(false);
        expect(c.inputMode).toBe('keymap');
        expect(c.pressedKeysValue).toBe('Not shown · reading is off');
    });

    it('a board that stops answering falls back to Keymap only and the lesson goes on', async () => {
        const c = await liveController();
        focusAndResume(c);
        for (let i = 1; i <= 3; i++) await fake.fail(i);
        await vi.waitFor(() => expect(c.inputMode).toBe('keymap'));
        expect(c.pressedKeysValue).toBe("Not shown · the board isn't answering");
        const run = c.run!;
        c.onInput(input(run.expected!, 100));
        expect(run.events.length).toBe(1);
        // It is still asked every 2 s, and Live · USB comes back when it answers.
        expect(live.running).toBe(true);
        await fake.wake();
        await fake.reply([], 2100);
        await vi.waitFor(() => expect(c.inputMode).toBe('usb'));
        expect(c.pressedKeysValue).toBe('Shown');
    });

    it('unplugging mid-lesson falls back without losing the lesson', async () => {
        const c = await liveController();
        focusAndResume(c);
        const run = c.run!;
        c.onInput(input(run.expected!, 100));
        // The board goes away; its keymap is kept (no unsent edits), so the lesson stays.
        c.setKeymap({ board: c.keymap!.board, source: 'connected', sourceLabel: 'Svalboard', layoutId: 'us', defaultLayer: 0, connected: false, unsentChanges: false, hidSupported: true });
        expect(c.inputMode).toBe('keymap');
        expect(live.running).toBe(false);
        expect(c.run).toBe(run);
        c.onInput(input(run.expected!, 300));
        expect(run.events.length).toBe(2);
        expect(run.events.every((e) => e.phys.confidence === 'inferred')).toBe(true);
    });

    it('Layer locked on shows in the status slot and drops keystrokes (OWNER_Q12)', async () => {
        const c = await liveController();
        focusAndResume(c);
        fake.masks = { active: 0b11, default: 1 };
        for (let t = 10; t <= 450; t += 10) await fake.reply([], t);
        await vi.waitFor(() => expect(c.layerLocked).toBe(1));
        expect(c.status).toMatchObject({ id: 'layer-locked', text: 'Layer 1 is locked on' });
        const run = c.run!;
        c.onInput(input(run.expected!, 500));
        expect(run.events.length).toBe(0);
        fake.masks = { active: 1, default: 1 };
        for (let t = 460; t <= 520; t += 10) await fake.reply([], t);
        await vi.waitFor(() => expect(c.layerLocked).toBeNull());
        c.onInput(input(run.expected!, 600));
        expect(run.events.length).toBe(1);
    });

    it('names the locked layer from cosmetic.layer', () => {
        expect(layerLockedText({ cosmetic: { layer: { 1: 'NAS' } } } as never, 1)).toBe('NAS is locked on');
        expect(layerLockedText(undefined, 2)).toBe('Layer 2 is locked on');
    });
});

describe('Live · USB lessons (§8.3)', () => {
    it('a lesson typed while reading is saved with src usb and observed hits', async () => {
        const store = new MemoryPracticeStore();
        const c = await liveController({ store });
        focusAndResume(c);
        const run = c.run!;
        await fake.reply([], 10);
        let t = 20;
        // Each character: its key goes down in a sample, the input follows, the key comes up.
        while (!run.textInput.completed) {
            const ch = run.expected!;
            const path = c.session!.resolution.primary(ch);
            const keys = path ? [...path.prereqs.map((p) => p.index), path.index] : [];
            await fake.reply(keys, t + 10); // ts t + 5
            c.onInput(input(ch, t + 6));
            await fake.reply([], t + 20);
            t += 150; // 80 WPM: keybr drops faster samples as noise
        }
        await fake.reply([], t + 100);
        await vi.waitFor(async () => expect((await store.listResults(c.session!.profile.id)).length).toBe(1));
        const [record] = await store.listResults(c.session!.profile.id);
        expect(record.x.src).toBe('usb');
        // The M2 acceptance bar: at least 95 % of hits observed, not inferred.
        expect(record.x.obs / (record.x.obs + record.x.inf)).toBeGreaterThanOrEqual(0.95);
        expect(record.x.inf).toBe(0);
    });

    it('without a board the result says keymap', async () => {
        const store = new MemoryPracticeStore();
        fake = new FakeBoard();
        live = new LiveInput({ pollMatrix: fake.pollMatrix, getLayerMasks: fake.getLayerMasks, clock: fake.clock, sleep: fake.sleep });
        const c = await startController({ store });
        c.attachLive(live);
        focusAndResume(c);
        expect(c.inputMode).toBe('keymap');
        expect(live.running).toBe(false);
        expect(c.pressedKeysValue).toBe('Not shown · connect the board');
        expect(board.rows).toBe(10);
    });
});
