import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveInput } from '@/features/practice/input/liveInput';
import { osLayoutName, osMismatchText, type PracticeController } from '@/features/practice/state/controller';
import { DEFAULT_DRILL } from '@/features/practice/state/settings';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import type { IInputEvent } from '@/features/practice/vendor/keybr/textinput-events/index.ts';
import { FakeBoard } from '../input/fakeBoard';
import { resetHarness, startController } from '../ui/harness';

// The live extras of M4 in the controller (spec §3.1, §5.3, §6.6, §12 M4): the OS layout mismatch notice,
// which a symbol drill on a correct layout never shows, and stray presses saved with the result.

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
    c.setFocused(true);
    c.resume();
    return c;
}

/** Types the whole lesson on the fake board: each character's keys (prerequisites and target) down in one sample. */
async function typeLesson(c: PracticeController, { onEach }: { onEach?: () => void } = {}) {
    const run = c.run!;
    await fake.reply([], 10);
    let t = 20;
    while (!run.textInput.completed) {
        const ch = run.expected!;
        const path = c.session!.resolution.primary(ch);
        const keys = path ? [...path.prereqs.map((p) => p.index), ...path.targets] : [];
        await fake.reply(keys, t + 10);
        c.onInput(input(ch, t + 6));
        await fake.reply([], t + 20);
        onEach?.();
        t += 150;
    }
    await fake.reply([], t + 100);
    return t;
}

afterEach(() => {
    live?.dispose();
    resetHarness();
});

describe('OS layout mismatch (§3.1, §5.3)', () => {
    it('names the layout as the notice does', () => {
        expect(osLayoutName('us')).toBe('US');
        expect(osLayoutName('uk')).toBe('UK');
        expect(osLayoutName('german')).toBe('German');
        expect(osMismatchText('us')).toBe("Typed characters don't match US layout");
    });

    it('shows after 5 eligible base-layer steps typed something other than the key pressed', async () => {
        const c = await liveController();
        const run = c.run!;
        await fake.reply([], 10);
        let t = 20;
        const statuses: (string | undefined)[] = [];
        for (let i = 0; i < 5; i++) {
            const ch = run.expected!;
            const path = c.session!.resolution.primary(ch)!;
            // The browser types a character other than the one the key makes (another OS layout).
            const typed = ch === 'z'.codePointAt(0) ? 'y'.codePointAt(0)! : 'z'.codePointAt(0)!;
            await fake.reply([path.index], t + 10);
            c.onInput(input(typed, t + 6));
            await fake.reply([], t + 20);
            await fake.reply([], t + 80);
            statuses.push(c.status?.id);
            t += 150;
        }
        expect(statuses.slice(0, 4)).not.toContain('os-mismatch');
        await vi.waitFor(() => expect(c.status).toMatchObject({ id: 'os-mismatch', kind: 'notice', text: "Typed characters don't match US layout", layoutId: 'us' }));
        expect(live.mismatch.count).toBe(5);
        // It stays while the select has focus (the text is blurred) …
        c.setFocused(false);
        expect(c.status?.id).toBe('os-mismatch');
        // … and a new OS layout restarts the lesson, which clears it.
        c.setKeymap({ ...c.keymap!, layoutId: 'german' });
        await vi.waitFor(() => expect(c.status?.id).not.toBe('os-mismatch'));
        expect(live.mismatch.count).toBe(0);
    });

    it('a symbol drill typed on a correct OS layout never shows the notice', async () => {
        const store = new MemoryPracticeStore();
        const c = await liveController({ store });
        // Start's preset chose Guided: switch to a Layer 1 symbol drill.
        c.update({ type: 'drill', drill: { ...DEFAULT_DRILL, group: 'symbols', layer: 1 } });
        await vi.waitFor(() => expect(c.session!.type).toBe('drill'));
        expect(c.session!.noLesson).toBe(false);
        c.setFocused(true);
        c.resume();
        const statuses = new Set<string | undefined>();
        await typeLesson(c, { onEach: () => statuses.add(c.status?.id) });
        await vi.waitFor(async () => expect((await store.listResults(c.session!.profile.id)).length).toBe(1));
        expect(statuses.has('os-mismatch')).toBe(false);
        expect(c.status?.id).not.toBe('os-mismatch');
        const [record] = await store.listResults(c.session!.profile.id);
        expect(record.x.src).toBe('usb');
        expect(record.x.type).toBe('drill');
        // Layer 1 symbols were typed through their layer key, every one observed.
        expect(Object.keys(record.h).filter((key) => key.split('|')[1].startsWith('1:')).length).toBeGreaterThan(3);
        expect(record.x.inf).toBe(0);
        expect(live.mismatch.count).toBe(0);
    });
});

describe('Stray presses in a live lesson (§6.6)', () => {
    it('are saved with the result against the key pressed', async () => {
        const store = new MemoryPracticeStore();
        const c = await liveController({ store });
        const run = c.run!;
        await fake.reply([], 10);
        let t = 20;
        let stray: number | null = null;
        while (!run.textInput.completed) {
            const ch = run.expected!;
            const path = c.session!.resolution.primary(ch)!;
            await fake.reply([...path.prereqs.map((p) => p.index), path.index], t + 10);
            c.onInput(input(ch, t + 6));
            await fake.reply([], t + 20);
            if (stray == null && run.events.length > 2) {
                // A key that types a character, pressed by mistake with nothing typed for it.
                stray = c.session!.resolution.primary('x'.codePointAt(0)!)!.index;
                await fake.reply([stray], t + 60);
                await fake.reply([], t + 80);
            }
            t += 150;
        }
        await fake.reply([], t + 100);
        await vi.waitFor(async () => expect((await store.listResults(c.session!.profile.id)).length).toBe(1));
        const [record] = await store.listResults(c.session!.profile.id);
        expect(record.k[`${stray}@0`]?.s).toBe(1);
        const events = await store.getEvents(record.id);
        expect(events).toBeDefined();
    });
});
