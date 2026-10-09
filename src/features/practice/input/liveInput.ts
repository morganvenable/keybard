// Live · USB, wired together (spec §3.2, §5.2, §5.3, §9.3): the sampler, the
// correlator and the lesson being typed.
//
// - The controller says when reading is wanted (setWanted): the §3.2 mode is
//   Live · USB and the lesson is not paused. Reading stops on the next
//   iteration after that turns false (D10).
// - Each character keystroke is queued (enqueue) and attributed once the
//   sampler's latest sample passes t_input + ε, in keystroke order, into the
//   LessonRun (LessonRun.attribute). The UI never waits for it.
// - The board reads a small change-only state (getBoard/subscribeBoard): keys
//   held now, wrong keys (from the press edge until 600 ms after release) and
//   the live layer. A sample that changes none of them notifies nobody, so a
//   running sampler re-renders nothing (§9.3, §9.9).
// - Layer locked on (§5.3): the active mask has a layer no held key explains,
//   for 300 ms, while no layer key or tap dance is held (TT, LM, a tri-layer or
//   a tap-dance hold turns layers on the correlator doesn't model) and other
//   than Svalboard's auto-mouse layer.
// - While the board isn't answering, keystrokes aren't queued: they stay
//   inferred, and the next step's interval starts after them.
// - onChange tells the controller about what its notices and pill show: the
//   sampler failing or recovering, and Layer locked on.
//
// Nothing here is React state; PracticeEngineHost owns one LiveInput and hands
// it to the controller.
import type { KeymapResolution } from '../keymap/resolver';
import { layerAction } from '../keymap/resolver';
import type { LessonRun, TypedKeystroke } from '../state/lessonRun';
import { attributeStep, EPSILON_MS, LiveKeymap, MismatchCounter, topLayer } from './correlate';
import { type LayerMasks, type MaskSample, type MatrixEdge, type MatrixSample, type SamplerStats, UsbSampler } from './usbSampler';

/** A wrong key keeps its mark this long after release (§5.2). */
export const WRONG_KEY_HOLD_MS = 600;
/** Layer locked on shows after the unexplained layer has lasted this long (§5.3). */
export const LAYER_LOCK_MS = 300;
/** settle() waits at most this long for the last keystroke's evidence. */
export const SETTLE_TIMEOUT_MS = 250;

export interface LiveBoardState {
    /** Matrix indices held now. */
    pressed: ReadonlySet<number>;
    /** Matrix indices marked wrong (§5.2 Wrong key). */
    wrong: ReadonlySet<number>;
    /** The live layer (top of the effective mask), or null before the first sample. */
    layer: number | null;
    /** The effective layer mask (§9.3), so legends resolve transparency through every active layer. */
    mask: number | null;
}

export const IDLE_BOARD: LiveBoardState = { pressed: new Set(), wrong: new Set(), layer: null, mask: null };

export interface LiveKeymapInput {
    resolution: KeymapResolution;
    keymap: readonly (readonly number[])[];
    rows: number;
    cols: number;
}

export interface LiveInputDeps {
    /** keyboardService.pollMatrix(board), never the context's wrapper (§9.3). */
    pollMatrix: () => Promise<boolean[][]>;
    /** keyboardService.getLayerStateMasks(board). */
    getLayerMasks: () => Promise<LayerMasks>;
    clock?: () => number;
    /** Paranoid: read only while Keybard is in front (userIsLooking). */
    canRead?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
    epsilon?: number;
}

function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
}

export class LiveInput {
    /** Failed or recovered, Layer locked on changed: the controller re-emits. */
    onChange: (() => void) | null = null;
    /** The layer locked on (§5.3), or null. */
    layerLocked: number | null = null;
    /** OS layout mismatch evidence (§3.1). TODO(practice): M4 shows its notice. */
    readonly mismatch = new MismatchCounter();

    readonly #deps: LiveInputDeps;
    readonly #epsilon: number;
    #sampler: UsbSampler | null = null;
    #keymap: LiveKeymap | null = null;
    #wanted = false;
    #run: LessonRun | null = null;
    #pending: TypedKeystroke[] = [];
    #consumed = new Set<number>();
    #tPrev: number | null = null;
    /** Recent keystrokes: a press seen after its own input is not a wrong key. */
    #recent: TypedKeystroke[] = [];
    /** Wrong keys: release time, or null while held. */
    #wrong = new Map<number, number | null>();
    #wrongTimers = new Map<number, ReturnType<typeof setTimeout>>();
    /** One-shot layers waiting for their key: layer → press time. */
    #oneShots = new Map<number, number>();
    #lockSince: number | null = null;
    #board: LiveBoardState = IDLE_BOARD;
    readonly #boardListeners = new Set<() => void>();
    #settle: (() => void)[] = [];
    #disposed = false;

    constructor(deps: LiveInputDeps) {
        this.#deps = deps;
        this.#epsilon = deps.epsilon ?? EPSILON_MS;
    }

    // ---- keymap and reading

    /** The practiced keymap. A different matrix size makes a new sampler. */
    setKeymap({ resolution, keymap, rows, cols }: LiveKeymapInput) {
        this.#keymap = new LiveKeymap(resolution, keymap, rows, cols);
        if (this.#sampler && this.#sampler.history.size === rows * cols) return;
        const running = this.#sampler?.running ?? false;
        this.#sampler?.stop();
        const sampler = new UsbSampler({
            pollMatrix: this.#deps.pollMatrix,
            getLayerMasks: this.#deps.getLayerMasks,
            rows, cols,
            clock: this.#deps.clock,
            canRead: this.#deps.canRead,
            sleep: this.#deps.sleep,
        });
        sampler.onSample = (sample, edges) => this.#onSample(sample, edges);
        sampler.onMasks = (mask) => this.#onMasks(mask);
        sampler.onHealth = (failed) => {
            // A board that stopped answering shows nothing held, rather than its last state.
            if (failed) {
                // What was typed before it stopped is attributed from the history there is.
                this.#flush();
                this.#clearBoard();
                this.#setLocked(null);
            }
            this.onChange?.();
        };
        this.#sampler = sampler;
        if (running || this.#wanted) sampler.start();
    }

    /** Reading is wanted: Live · USB and the lesson not paused (§9.3 Lifecycle). */
    setWanted(wanted: boolean) {
        if (this.#disposed) return;
        this.#wanted = wanted;
        const sampler = this.#sampler;
        if (!sampler) return;
        if (wanted && !sampler.running) {
            sampler.start();
        } else if (!wanted && sampler.running) {
            sampler.stop();
            // What was typed until now is attributed from the history there is.
            this.#flush();
            this.#clearBoard();
            this.#setLocked(null);
        }
    }

    get running(): boolean {
        return this.#sampler?.running ?? false;
    }

    /** Three reads in a row failed (§9.3 Errors): Keymap only, retrying every 2 s. */
    get failed(): boolean {
        return this.#sampler?.failed ?? false;
    }

    stats(): SamplerStats | null {
        return this.#sampler?.stats() ?? null;
    }

    // ---- the lesson

    /** A new lesson (or none): attribution and the wrong-key marks start over. */
    bindRun(run: LessonRun | null) {
        if (run === this.#run) return;
        this.#flush();
        this.#run = run;
        this.#pending = [];
        this.#consumed = new Set();
        this.#tPrev = null;
        this.#recent = [];
        this.#oneShots.clear();
        this.mismatch.reset();
        if (this.#wrong.size) {
            this.#clearWrong();
            this.#publish(this.#board.pressed, this.#board.mask);
        }
    }

    /** A character keystroke the lesson took; attributed once the sampler has seen past it. */
    enqueue(keystroke: TypedKeystroke) {
        this.#recent.push(keystroke);
        if (this.#recent.length > 8) this.#recent.shift();
        // A one-shot layer is used up by the key it applied to.
        this.#oneShots.clear();
        if (!this.running) return;
        if (this.failed) {
            // No evidence is coming for it: it stays inferred, and the next step
            // looks only at what the board shows after it (§9.3 Errors).
            this.#tPrev = keystroke.tInput;
            return;
        }
        this.#pending.push(keystroke);
        this.#drain();
    }

    /**
     * Waits until the sampler has seen past the last queued keystroke (or
     * SETTLE_TIMEOUT_MS), then attributes everything queued. The controller
     * calls it before saving a finished lesson.
     */
    settle(timeoutMs = SETTLE_TIMEOUT_MS): Promise<void> {
        if (!this.#pending.length) return Promise.resolve();
        if (!this.running || this.failed) {
            this.#flush();
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const timer = setTimeout(done, timeoutMs);
            const self = this;
            function done() {
                clearTimeout(timer);
                self.#settle = self.#settle.filter((w) => w !== done);
                self.#flush();
                resolve();
            }
            this.#settle.push(done);
        });
    }

    // ---- board state

    getBoard = (): LiveBoardState => this.#board;

    subscribeBoard = (listener: () => void) => {
        this.#boardListeners.add(listener);
        return () => { this.#boardListeners.delete(listener); };
    };

    dispose() {
        this.#disposed = true;
        this.#sampler?.stop();
        this.#clearWrong();
        for (const done of [...this.#settle]) done();
        this.#boardListeners.clear();
        this.onChange = null;
    }

    // ---- sampling

    #onSample(sample: MatrixSample, edges: readonly MatrixEdge[]) {
        const keymap = this.#keymap;
        const sampler = this.#sampler;
        if (!keymap || !sampler) return;
        const history = sampler.history;
        for (const edge of edges) {
            if (edge.press) this.#onPress(edge);
            else if (this.#wrong.has(edge.index)) this.#release(edge);
        }
        this.#drain();
        const pressed = new Set<number>();
        for (let i = 0; i < sample.down.length; i++) if (sample.down[i]) pressed.add(i);
        this.#publish(pressed, keymap.effectiveMask(history, sample, this.#oneShotMask()));
    }

    /** One-shot layers tapped since the last keystroke: on before any mask read shows them. */
    #oneShotMask(): number {
        let mask = 0;
        for (const layer of this.#oneShots.keys()) if (layer < 32) mask |= 1 << layer;
        return mask >>> 0;
    }

    #onPress(edge: MatrixEdge) {
        const keymap = this.#keymap!;
        const history = this.#sampler!.history;
        const mask = keymap.effectiveMask(history, edge.sample, this.#oneShotMask());
        const key = keymap.keyAt(edge.index, mask);
        const action = layerAction(keymap.name(key.code));
        if (action?.kind === 'oneshot') this.#oneShots.set(action.toLayer, edge.t);
        // Layer keys, Shift, tap-hold keys and keys that type nothing are never wrong.
        if (key.prereqKey || key.tapHold || !this.#run) return;
        const char = keymap.charAt(edge.index, key.layer, keymap.shiftHeld(edge.sample.down, mask));
        if (!char) return;
        if (!this.#isWrong(char.char, edge)) return;
        // A roll out of an LT or mod-tap key: with permissive hold, releasing it
        // first types its tap and then this key's tap side. Not wrong if that's right.
        if (keymap.tapHoldHeld(edge.sample.down, mask, edge.index)) {
            const tapMask = keymap.effectiveMask(history, edge.sample, this.#oneShotMask(), true);
            const tapKey = keymap.keyAt(edge.index, tapMask);
            const tapChar = keymap.charAt(edge.index, tapKey.layer, keymap.shiftHeld(edge.sample.down, tapMask, true));
            if (tapChar && !this.#isWrong(tapChar.char, edge)) return;
        }
        const timer = this.#wrongTimers.get(edge.index);
        if (timer) { clearTimeout(timer); this.#wrongTimers.delete(edge.index); }
        this.#wrong.set(edge.index, null);
    }

    /** A press is wrong unless it types the character expected now, or one just typed right, or the next one (a roll). */
    #isWrong(char: number, edge: MatrixEdge): boolean {
        const run = this.#run!;
        const text = run.textInput;
        if (!text.completed) {
            if (text.at(text.pos).codePoint === char) return false;
            if (text.pos + 1 < text.length && text.at(text.pos + 1).codePoint === char) return false;
        }
        const since = edge.t - edge.dt - this.#epsilon;
        return !this.#recent.some((k) => k.tInput >= since && k.typed === char && k.expected === char);
    }

    #release(edge: MatrixEdge) {
        this.#wrong.set(edge.index, edge.t);
        const clock = this.#deps.clock ?? (() => performance.now());
        const wait = Math.max(0, edge.t + WRONG_KEY_HOLD_MS - clock());
        const timer = setTimeout(() => {
            this.#wrongTimers.delete(edge.index);
            if (this.#wrong.get(edge.index) !== edge.t) return;
            this.#wrong.delete(edge.index);
            this.#publish(this.#board.pressed, this.#board.mask);
        }, wait);
        this.#wrongTimers.set(edge.index, timer);
    }

    #onMasks(mask: MaskSample) {
        const keymap = this.#keymap;
        if (!keymap) return;
        // Layers on that no held key explains, less one-shots still waiting for their
        // key and the auto-mouse layer the trackball turns on.
        let unexplained = keymap.unexplainedMask(mask) & ~this.#oneShotMask();
        if (keymap.autoMouseLayer < 32) unexplained &= ~(1 << keymap.autoMouseLayer);
        unexplained >>>= 0;
        // A held layer key or tap dance may explain it in a way the correlator doesn't
        // model (TT, LM, a tri-layer, a tap-dance hold): never a lock while one is down.
        const down = mask.sample?.down;
        if (unexplained && down && keymap.layerKeyHeld(down, keymap.heldMask(down, keymap.defaultMask(mask)))) unexplained = 0;
        if (!unexplained) {
            this.#lockSince = null;
            this.#setLocked(null);
            return;
        }
        this.#lockSince ??= mask.ts;
        if (mask.ts - this.#lockSince >= LAYER_LOCK_MS) this.#setLocked(topLayer(unexplained));
    }

    #setLocked(layer: number | null) {
        if (layer === null) this.#lockSince = null;
        if (layer === this.layerLocked) return;
        this.layerLocked = layer;
        this.onChange?.();
    }

    // ---- attribution

    /** Attributes queued keystrokes the sampler has seen past. */
    #drain() {
        const latest = this.#sampler?.history.latest;
        if (!latest) return;
        while (this.#pending.length && this.#pending[0].tInput + this.#epsilon <= latest.ts) this.#attributeNext();
        if (!this.#pending.length && this.#settle.length) for (const done of [...this.#settle]) done();
    }

    /** Attributes everything queued now, with the history there is. */
    #flush() {
        while (this.#pending.length) this.#attributeNext();
    }

    #attributeNext() {
        const keystroke = this.#pending.shift()!;
        const run = this.#run;
        const keymap = this.#keymap;
        const history = this.#sampler?.history;
        if (!run || !keymap || !history) return;
        const attribution = attributeStep(
            { typed: keystroke.typed, expected: keystroke.expected, tInput: keystroke.tInput, tPrev: this.#tPrev },
            history, keymap, this.#consumed, this.#epsilon,
        );
        for (const id of attribution.consumed) this.#consumed.add(id);
        run.attribute(keystroke.seq, attribution);
        this.mismatch.add(attribution.mismatch);
        this.#tPrev = attribution.delayed && attribution.targetEdge != null ? attribution.targetEdge : keystroke.tInput;
    }

    // ---- publishing

    #clearWrong() {
        for (const timer of this.#wrongTimers.values()) clearTimeout(timer);
        this.#wrongTimers.clear();
        this.#wrong.clear();
    }

    #clearBoard() {
        this.#clearWrong();
        if (this.#board !== IDLE_BOARD) {
            this.#board = IDLE_BOARD;
            this.#notify();
        }
    }

    #publish(pressed: ReadonlySet<number>, mask: number | null) {
        const wrong = new Set(this.#wrong.keys());
        const board = this.#board;
        if (board.mask === mask && sameSet(board.pressed, pressed) && sameSet(board.wrong, wrong)) return;
        this.#board = { pressed, wrong, layer: mask == null ? null : topLayer(mask), mask };
        this.#notify();
    }

    #notify() {
        for (const listener of [...this.#boardListeners]) listener();
    }
}
