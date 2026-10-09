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
// Live attribution (M2) replaces the inferred paths with observed ones.
// TODO(practice): M2 keeps the observed path per TextInput position.
import { classifyMiss } from '../input/classify';
import { PracticeTimeToType } from '../input/timeToType';
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
        const before = this.textInput.pos;
        const feedback = this.textInput.onInput({ ...event, timeToType: ttt });
        const appended = this.textInput.pos - before;
        // keybr ignores a stray Space before a word: nothing to record.
        if (appended === 0 && feedback === Feedback.Succeeded) return { ignored: false, feedback, completed: false };

        // The outcome is the one TextInput reached, not a comparison of characters:
        // with Forgive errors off, the right character is refused while wrong ones
        // wait to be deleted, and a recovery (Forgive errors) appends several steps.
        const expectedPath = this.resolution.primary(expected);
        const base = { t, typed, raw: timing.raw, prereq: timing.newPrereqs.slice(0, 2) };
        const phys = { index: pressed?.index ?? -1, layer: pressed?.layer ?? -1, confidence: 'inferred' as const, skew: null, reach: null, target: null };
        const hit = (at: number): KeystrokeEvent => ({
            ...base, expected: at, kind: 'hit', ttt: timing.ttt, path: pressed?.key ?? '', phys,
            delayed: pressed?.delayed ? true : undefined,
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
            return { ignored: false, feedback, completed: false };
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
                    delayed: g.pressed?.delayed ? true : undefined,
                };
            });
            this.events.push(hit(steps[steps.length - 1].codePoint));
            if (skipped) {
                // The skipped character: a miss with nothing typed for it, before the first rewritten hit.
                const at = garbage.length ? garbage[0].event : this.events.length - 1;
                this.events.splice(at, 0, {
                    t: this.events[at].t, expected, typed: null, kind: 'miss', raw: 0, ttt: null, path: expectedPath?.key ?? '', prereq: [],
                    phys: { index: -1, layer: -1, confidence: 'inferred', skew: null, reach: null, target: null },
                });
            }
        } else {
            this.events.push(hit(expected));
        }
        return { ignored: false, feedback, completed: this.textInput.completed };
    }

    /**
     * The final TextInput steps with the path each is charged to (§8.3). Keymap
     * only: a typed or forgiven position is charged to its character's primary path.
     */
    practiceSteps(): PracticeStep[] {
        return this.textInput.steps.map((step) => ({ ...step, path: this.resolution.primary(step.codePoint)?.key ?? '' }));
    }
}
