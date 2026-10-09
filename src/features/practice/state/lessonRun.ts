// One lesson being typed (spec §5.3, §5.11, §6.5, §6.6, §8.2): keybr's TextInput
// fed by the input handler, plus what Practice adds on top of it.
//
// - Time to type is normalized by physical presses (input/timeToType.ts). In
//   Keymap-only mode every keystroke is attributed to the typed character's
//   primary path, so the divisor counts the prerequisites that path adds.
// - Each keystroke becomes a KeystrokeEvent (hit, miss, backspace) with an
//   inferred physical key, and each miss gets its §6.6 class.
// - Paused intervals are kept so the lesson time leaves them out (§6.5).
// - Keystrokes typed while Caps Lock is on are dropped: they are not saved and
//   the lesson does not advance on them (§5.3 "Caps Lock on").
//
// Live · USB (M2): the correlator attributes each keystroke a moment after it is
// typed (input/liveInput.ts calls attribute()). An observed attribution replaces
// the inferred key, path and miss class on the keystroke's events, and the
// lesson's timing is measured again from the press edges when the lesson ends
// (finalizeTiming), so a held layer or Shift counts once and delayed output is
// timed by its press (§6.5). practiceSteps() charges each typed position to the
// path observed for it.
import { classifyMiss, classifyPress } from '../input/classify';
import type { Attribution } from '../input/correlate';
import { PracticeTimeToType, type StepTiming } from '../input/timeToType';
import type { KeymapResolution, Path } from '../keymap/resolver';
import type { PracticeStep } from '../store/results';
import type { KeystrokeEvent } from '../types';
import { filterText } from '../vendor/keybr/keyboard/index.ts';
import { type IInputEvent, type IKeyboardEvent } from '../vendor/keybr/textinput-events/index.ts';
import { Feedback, type StyledText, TextInput, type TextInputSettings } from '../vendor/keybr/textinput/index.ts';

export type RunPhase = 'ready' | 'typing' | 'paused' | 'complete';

export interface LessonRunOptions {
    text: StyledText;
    textInput: TextInputSettings;
    resolution: KeymapResolution;
    cols: number;
}

export interface InputOutcome {
    /** The keystroke was dropped (Caps Lock on, paused, or the lesson is over). */
    ignored: boolean;
    feedback: Feedback | null;
    /** This keystroke finished the lesson. */
    completed: boolean;
    /** A character keystroke the lesson took (not a backspace): what live attribution needs. */
    keystroke?: TypedKeystroke;
}

/** A character keystroke, for live attribution (§9.3). */
export interface TypedKeystroke {
    seq: number;
    tInput: number;
    typed: number;
    expected: number;
}

/** Every character keystroke in order, with what live attribution found for it. */
interface KeystrokeRecord {
    seq: number;
    tInput: number;
    /** The typed character's primary path (Keymap only). */
    primary: Path | null;
    attribution?: Attribution;
    /** Timing measured again in finalizeTiming(). */
    timing?: StepTiming;
}

const IGNORED: InputOutcome = { ignored: true, feedback: null, completed: false };

/** keybr's TextInput keeps at most this many wrong characters (textinput.ts garbageBufferLength). */
const GARBAGE_LIMIT = 10;

/** A refused keystroke TextInput keeps as a wrong character, until a backspace, a hit or a recovery. */
interface WaitingKeystroke {
    /** Its index in `events` (a miss until a recovery proves it right). */
    event: number;
    ttt: number | null;
    pressed: Path | null;
}

export class LessonRun {
    readonly textInput: TextInput;
    readonly resolution: KeymapResolution;
    readonly cols: number;
    readonly events: KeystrokeEvent[] = [];
    readonly #timer = new PracticeTimeToType();
    readonly #paused: [number, number][] = [];
    #startedAt: number | null = null;
    #pausedAt: number | null = null;
    #lastInputAt: number | null = null;
    #capsLock = false;
    #typo = false;
    /** Mirrors TextInput's wrong characters, so a recovery can rewrite their events. */
    #garbage: WaitingKeystroke[] = [];
    #seq = 0;
    readonly #keystrokes: KeystrokeRecord[] = [];
    #observed = 0;
    #timingDirty = false;

    constructor({ text, textInput, resolution, cols }: LessonRunOptions) {
        this.textInput = new TextInput(text, textInput);
        this.resolution = resolution;
        this.cols = cols;
    }

    get phase(): RunPhase {
        if (this.textInput.completed) return 'complete';
        if (this.#pausedAt != null) return 'paused';
        return this.#startedAt == null ? 'ready' : 'typing';
    }

    get started(): boolean {
        return this.#startedAt != null;
    }

    /** DOM time stamp of the first keystroke. */
    get startedAt(): number | null {
        return this.#startedAt;
    }

    get lastInputAt(): number | null {
        return this.#lastInputAt;
    }

    get capsLock(): boolean {
        return this.#capsLock;
    }

    /** A miss is waiting on the current character (stop on error): the text tints it red (§5.2). */
    get typoPending(): boolean {
        return this.#typo;
    }

    /** Paused intervals, on the DOM clock; an open pause runs to `now`. */
    pausedIntervals(now?: number): readonly (readonly [number, number])[] {
        return this.#pausedAt != null && now != null ? [...this.#paused, [this.#pausedAt, now]] : this.#paused;
    }

    /** The character the caret is on, or null when the lesson is complete. */
    get expected(): number | null {
        return this.textInput.completed ? null : this.textInput.at(this.textInput.pos).codePoint;
    }

    /** Keystrokes the board observed (Live · USB): the result's source is `usb` (§8.3 x.src). */
    get observed(): number {
        return this.#observed;
    }

    /** The primary path of the character the caret is on. */
    get nextPath(): Path | null {
        const expected = this.expected;
        return expected == null ? null : this.resolution.primary(expected);
    }

    pause(at: number) {
        if (this.#pausedAt == null && !this.textInput.completed) this.#pausedAt = at;
    }

    resume(at: number) {
        if (this.#pausedAt == null) return;
        // Only time inside the lesson counts: a pause before the first keystroke removes nothing.
        if (this.#startedAt != null) this.#paused.push([Math.max(this.#pausedAt, this.#startedAt), Math.max(at, this.#startedAt)]);
        this.#pausedAt = null;
    }

    /** Tracks Caps Lock from every keystroke (§5.3). Returns true when its state changed. */
    onKey(event: IKeyboardEvent): boolean {
        const caps = event.modifiers.includes('CapsLock');
        const changed = caps !== this.#capsLock;
        this.#capsLock = caps;
        return changed;
    }

    onInput(event: IInputEvent): InputOutcome {
        if (this.textInput.completed || this.#pausedAt != null || this.#capsLock) return IGNORED;
        const expected = this.textInput.at(this.textInput.pos).codePoint;
        if (this.#startedAt == null) this.#startedAt = event.timeStamp;
        this.#lastInputAt = event.timeStamp;
        const t = Math.max(0, event.timeStamp - this.#startedAt);

        if (event.inputType === 'clearChar' || event.inputType === 'clearWord') {
            this.events.push({
                t, expected, typed: null, kind: 'backspace', raw: 0, ttt: null, path: '', prereq: [],
                phys: { index: -1, layer: -1, confidence: 'inferred', skew: null, reach: null, target: null },
            });
            const feedback = this.textInput.onInput({ ...event, timeToType: 0 });
            if (event.inputType === 'clearChar') this.#garbage.pop();
            else this.#garbage = [];
            // As keybr's TextInput: after a correction the next character counts as a typo.
            this.#typo = true;
            return { ignored: false, feedback, completed: false };
        }

        const typed = event.inputType === 'appendLineBreak' ? 0x0020 : event.codePoint;
        // Keymap only: the key pressed is the typed character's primary path (§6.5).
        const pressed = this.resolution.primary(typed);
        const timing = this.#timer.measure({ tInput: event.timeStamp, path: pressed });
        const ttt = timing.ttt ?? (timing.raw > 0 ? timing.raw / timing.presses : 0);
        const seq = this.#seq++;
        this.#keystrokes.push({ seq, tInput: event.timeStamp, primary: pressed });
        if (this.#keystrokes.some((k) => k.attribution)) this.#timingDirty = true;
        const keystroke: TypedKeystroke = { seq, tInput: event.timeStamp, typed, expected };
        const before = this.textInput.pos;
        const feedback = this.textInput.onInput({ ...event, timeToType: ttt });
        const appended = this.textInput.pos - before;
        // keybr ignores a stray Space before a word: nothing to record.
        if (appended === 0 && feedback === Feedback.Succeeded) return { ignored: false, feedback, completed: false, keystroke };

        // The outcome is the one TextInput reached, not a comparison of characters:
        // with Forgive errors off, the right character is refused while wrong ones
        // wait to be deleted, and a recovery (Forgive errors) appends several steps.
        const expectedPath = this.resolution.primary(expected);
        const base = { t, typed, raw: timing.raw, prereq: timing.newPrereqs.slice(0, 2), seq };
        const phys = { index: pressed?.index ?? -1, layer: pressed?.layer ?? -1, confidence: 'inferred' as const, skew: null, reach: null, target: null };
        const hit = (at: number, pos: number): KeystrokeEvent => ({
            ...base, expected: at, kind: 'hit', ttt: timing.ttt, path: pressed?.key ?? '', phys,
            delayed: pressed?.delayed ? true : undefined, pos,
        });

        if (appended === 0) {
            // Refused (Feedback.Failed). The right character refused because wrong ones
            // are still waiting to be deleted has no wrong key to class.
            const right = typed === expected || filterText.normalize(expected) === typed;
            const index = this.events.push({
                ...base, expected, kind: 'miss', ttt: null, path: expectedPath?.key ?? '',
                phys: { ...phys, shift: pressed?.shift },
                errorClass: right ? undefined : classifyMiss(this.resolution, expected, typed, this.cols),
            }) - 1;
            const { stopOnError, forgiveErrors } = this.textInput;
            if ((!stopOnError || forgiveErrors) && this.#garbage.length < GARBAGE_LIMIT) {
                this.#garbage.push({ event: index, ttt: timing.ttt, pressed });
            }
            this.#typo = true;
            return { ignored: false, feedback, completed: false, keystroke };
        }

        const garbage = this.#garbage;
        this.#garbage = [];
        this.#typo = false;
        const skipWord = this.textInput.spaceSkipsWords && typed === 0x0020 && expected !== 0x0020;
        if (skipWord) {
            // Space skipped the rest of the word: one miss on the character it left.
            this.events.push({
                ...base, expected, kind: 'miss', ttt: null, path: expectedPath?.key ?? '',
                phys: { ...phys, shift: pressed?.shift },
                errorClass: classifyMiss(this.resolution, expected, typed, this.cols),
            });
        } else if (appended > 1 && (appended === garbage.length + 2 || appended === garbage.length + 1)) {
            // Forgive errors recovered (keybr's #handleSkippedCharacter and
            // #handleReplacedCharacter): the waiting keystrokes and this one were the
            // right characters for the positions after `before`.
            const steps = this.textInput.steps.slice(before);
            const skipped = appended === garbage.length + 2;
            // Skipped: every waiting keystroke was right, and the character at `before`
            // was never typed. Replaced: the first waiting keystroke stays its miss.
            // Either way steps[0] is the typo on `before` and steps[1 + i] the i-th rewritten keystroke.
            const rewritten = skipped ? garbage : garbage.slice(1);
            rewritten.forEach((g, i) => {
                const old = this.events[g.event];
                this.events[g.event] = {
                    ...old, expected: steps[1 + i].codePoint, kind: 'hit', ttt: g.ttt, path: g.pressed?.key ?? '',
                    phys: { ...old.phys, shift: undefined }, errorClass: undefined,
                    delayed: g.pressed?.delayed ? true : undefined, pos: before + 1 + i,
                };
            });
            this.events.push(hit(steps[steps.length - 1].codePoint, before + appended - 1));
            if (skipped) {
                // The skipped character: a miss with nothing typed for it, before the first rewritten hit.
                const at = garbage.length ? garbage[0].event : this.events.length - 1;
                this.events.splice(at, 0, {
                    t: this.events[at].t, expected, typed: null, kind: 'miss', raw: 0, ttt: null, path: expectedPath?.key ?? '', prereq: [],
                    phys: { index: -1, layer: -1, confidence: 'inferred', skew: null, reach: null, target: null },
                });
            }
        } else {
            this.events.push(hit(expected, before));
        }
        return { ignored: false, feedback, completed: this.textInput.completed, keystroke };
    }

    /**
     * Live · USB: what the board showed for keystroke `seq` (§9.3). An observed
     * attribution puts the pressed key, the path used and, for a miss, the class
     * against the observed key on that keystroke's events.
     */
    attribute(seq: number, attribution: Attribution) {
        const record = this.#keystrokes.find((k) => k.seq === seq);
        if (!record || record.attribution) return;
        record.attribution = attribution;
        this.#timingDirty = true;
        if (attribution.confidence !== 'observed' || !attribution.pressed) return;
        this.#observed++;
        const { pressed, path } = attribution;
        for (let i = 0; i < this.events.length; i++) {
            const event = this.events[i];
            if (event.seq !== seq) continue;
            const phys = { ...event.phys, index: pressed.index, layer: pressed.layer, confidence: 'observed' as const, skew: attribution.skew };
            if (event.kind === 'hit') {
                // Rule 3 (the key types something else under the keymap): keep the character's
                // path, so its stats still count, with the key actually pressed in phys.
                this.events[i] = {
                    ...event, path: path?.key ?? event.path, phys: { ...phys, shift: undefined },
                    delayed: attribution.delayed || path?.delayed ? true : undefined,
                };
            } else if (event.kind === 'miss') {
                const expectedPath = this.resolution.primary(event.expected);
                this.events[i] = {
                    ...event, phys: { ...phys, shift: pressed.shift },
                    // A right character refused while wrong ones wait keeps no class.
                    errorClass: event.errorClass === undefined ? undefined
                        : expectedPath ? classifyPress(expectedPath, pressed, this.cols) : 'unknown',
                };
            }
        }
    }

    /**
     * Measures the lesson's timing again from the attributions (§6.5): observed
     * steps by their press edges (a delayed one by its target's press), the rest
     * from the keymap, in one chain so each step's divisor counts only the
     * prerequisites pressed for it. A no-op when nothing was attributed.
     */
    finalizeTiming() {
        if (!this.#timingDirty) return;
        this.#timingDirty = false;
        const timer = new PracticeTimeToType();
        const bySeq = new Map<number, KeystrokeRecord>();
        for (const k of this.#keystrokes) {
            const a = k.attribution;
            k.timing = a && a.confidence === 'observed'
                ? timer.measure({ tInput: k.tInput, path: a.path ?? k.primary, targetEdge: a.targetEdge, delayed: a.delayed, prereqEdges: a.prereqEdges })
                : timer.measure({ tInput: k.tInput, path: k.primary });
            bySeq.set(k.seq, k);
        }
        for (let i = 0; i < this.events.length; i++) {
            const event = this.events[i];
            const record = event.seq != null ? bySeq.get(event.seq) : undefined;
            const timing = record?.timing;
            if (!timing) continue;
            if (event.kind === 'hit') {
                const live = record.attribution?.confidence === 'observed';
                this.events[i] = {
                    ...event, raw: timing.raw, ttt: timing.ttt, prereq: timing.newPrereqs.slice(0, 2),
                    phys: { ...event.phys, reach: live ? timing.reach : null, target: live ? timing.target : null },
                };
            } else if (event.kind === 'miss') {
                this.events[i] = { ...event, raw: timing.raw };
            }
        }
    }

    /**
     * The final TextInput steps with the path each is charged to (§8.3). Keymap
     * only: a typed or forgiven position is charged to its character's primary path.
     */
    practiceSteps(): PracticeStep[] {
        const primary = (step: { codePoint: number }) => this.resolution.primary(step.codePoint)?.key ?? '';
        if (!this.#keystrokes.some((k) => k.attribution)) return this.textInput.steps.map((step) => ({ ...step, path: primary(step) }));
        // Live: a typed position is charged to the path observed for it, timed from its press edges (§6.5).
        this.finalizeTiming();
        const records = new Map(this.#keystrokes.map((k) => [k.seq, k]));
        const byPos = new Map<number, KeystrokeEvent>();
        for (const event of this.events) if (event.kind === 'hit' && event.pos != null) byPos.set(event.pos, event);
        return this.textInput.steps.map((step, pos) => {
            const event = byPos.get(pos);
            const record = event?.seq != null ? records.get(event.seq) : undefined;
            if (!event || !record?.timing || record.attribution?.confidence !== 'observed') return { ...step, path: primary(step) };
            const { ttt, raw, presses } = record.timing;
            return { ...step, path: event.path || primary(step), timeToType: ttt ?? (raw > 0 ? raw / presses : 0) };
        });
    }
}
