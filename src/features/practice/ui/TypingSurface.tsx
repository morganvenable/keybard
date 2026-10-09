import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { PILL_INK } from "@/components/shared/pills";
import { cn } from "@/lib/utils";
import type { KeymapResolution } from "../keymap/resolver";
import type { LessonRun } from "../state/lessonRun";
import { Attr, type Char } from "../vendor/keybr/textinput/index.ts";
import { InputHandler, type IInputEvent, type IKeyboardEvent } from "../vendor/keybr/textinput-events/index.ts";

// N-5 Typing surface (docs/practice/spec.md §5.2 "Text card", §5.11, §5.12): a visually hidden, focused
// textarea takes the keystrokes through keybr's input handler; the card shows the lesson text three lines
// at a time, the current line staying on line 2 once the first is done.

export interface TypingSurfaceHandle {
    focus: () => void;
    textarea: HTMLTextAreaElement | null;
    card: HTMLDivElement | null;
}

interface TypingSurfaceProps {
    run: LessonRun;
    /** Changes on every keystroke, so the text re-renders. */
    version: number;
    paused: boolean;
    showSpaces: boolean;
    layerUnderlines: boolean;
    resolution: KeymapResolution | null;
    defaultLayer: number;
    layerHex: (layer: number) => string;
    /** Under 480 px the text is 22 px (M-13). */
    compact?: boolean;
    onKey: (event: IKeyboardEvent) => void;
    onInput: (event: IInputEvent) => void;
    onFocusChange: (focused: boolean) => void;
    onTogglePause: () => void;
    onResume: () => void;
}

const MISSED = "text-kb-red underline decoration-wavy decoration-2 decoration-kb-red underline-offset-[6px]";
/** The current character after a miss (stop on error): the missed style on a light red tint. */
const MISSED_CURRENT = "bg-kb-red/15 rounded-sm";

interface Glyph {
    char: Char;
    index: number;
    cursor: boolean;
}

/** Splits the text into words and spaces, so lines break only between words. */
function tokens(chars: readonly Char[]): Glyph[][] {
    const list: Glyph[][] = [];
    let word: Glyph[] = [];
    chars.forEach((char, index) => {
        const glyph = { char, index, cursor: (char.attrs & Attr.Cursor) !== 0 };
        if (char.codePoint === 0x20) {
            if (word.length) list.push(word);
            list.push([glyph]);
            word = [];
        } else {
            word.push(glyph);
        }
    });
    if (word.length) list.push(word);
    return list;
}

export const TypingSurface = forwardRef<TypingSurfaceHandle, TypingSurfaceProps>(function TypingSurface(props, ref) {
    const { run, version, paused, showSpaces, layerUnderlines, resolution, defaultLayer, layerHex, compact = false } = props;
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const cardRef = useRef<HTMLDivElement | null>(null);
    const innerRef = useRef<HTMLDivElement | null>(null);
    const callbacks = useRef(props);
    callbacks.current = props;
    const [offset, setOffset] = useState(0);
    const lineHeight = compact ? 32 : 40;

    useImperativeHandle(ref, () => ({
        focus: () => textareaRef.current?.focus({ preventScroll: true }),
        get textarea() { return textareaRef.current; },
        get card() { return cardRef.current; },
    }), []);

    // keybr's input handler on the hidden textarea. Attaching it doesn't take focus (§4.1).
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const handler = new InputHandler();
        handler.setCallbacks({
            onFocus: () => callbacks.current.onFocusChange(true),
            onBlur: () => callbacks.current.onFocusChange(false),
            onKeyDown: (event) => callbacks.current.onKey(event),
            onKeyUp: (event) => callbacks.current.onKey(event),
            onInput: (event) => callbacks.current.onInput(event),
        });
        handler.setInput(textarea, { focus: false });
        return () => handler.setInput(null);
    }, []);

    const chars = run.textInput.chars;
    const words = useMemo(() => tokens(chars), [chars, version]);
    const typo = run.typoPending;
    const pos = run.textInput.pos;
    const length = run.textInput.length;

    // Keep the caret's line on line 2 once line 1 is done (keybr's scrolling).
    useLayoutEffect(() => {
        const cursor = innerRef.current?.querySelector<HTMLElement>("[data-cursor]");
        if (!cursor) { setOffset(0); return; }
        const line = Math.floor(cursor.offsetTop / lineHeight);
        setOffset(Math.max(0, line - 1) * lineHeight);
    }, [version, run, lineHeight, words]);

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            props.onTogglePause();
        } else if (event.key === "Enter" && paused) {
            // Enter resumes a paused lesson; it is not typed (§5.11).
            event.preventDefault();
            props.onResume();
        }
    };

    const currentWord = useMemo(() => {
        const text = run.textInput.text;
        const flat = typeof text === "string" ? text : run.textInput.chars.map((c) => String.fromCodePoint(c.codePoint)).join("");
        const start = flat.lastIndexOf(" ", Math.max(0, pos - 1)) + 1;
        const end = flat.indexOf(" ", pos);
        return flat.slice(start, end < 0 ? undefined : end);
    }, [run, pos, version]);

    const renderGlyph = ({ char, index, cursor }: Glyph): ReactNode => {
        const isSpace = char.codePoint === 0x20;
        const typed = (char.attrs & Attr.Hit) !== 0;
        const missed = (char.attrs & Attr.Miss) !== 0;
        const pending = !typed && !missed;
        const layer = pending && layerUnderlines && resolution ? resolution.primary(char.codePoint)?.layer ?? defaultLayer : defaultLayer;
        const underline = pending && layer !== defaultLayer;
        const text = isSpace ? (showSpaces ? "·" : " ") : String.fromCodePoint(char.codePoint);
        return (
            <span
                key={index}
                data-cursor={cursor || undefined}
                data-glyph={missed ? "missed" : typed ? "typed" : "pending"}
                className={cn(
                    cursor && "relative",
                    typed && "text-kb-ink",
                    missed && MISSED,
                    pending && (isSpace && showSpaces ? "text-muted-foreground/50" : "text-muted-foreground"),
                    cursor && typo && cn(MISSED, MISSED_CURRENT),
                    underline && "underline decoration-[3px] underline-offset-[6px]",
                )}
                style={underline ? { textDecorationColor: layerHex(layer) } : undefined}
            >
                {cursor && <span aria-hidden="true" data-caret className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 bg-kb-ink motion-safe:transition-transform duration-75" />}
                {text}
            </span>
        );
    };

    return (
        <div
            ref={cardRef}
            data-practice-text-card
            className="relative bg-kb-surface text-kb-ink rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 px-6 py-6 sm:px-10 sm:py-8 cursor-text"
            onMouseDown={(event) => {
                // Keep focus in the textarea; a click on the card focuses it and resumes (§4.1).
                event.preventDefault();
                textareaRef.current?.focus({ preventScroll: true });
                props.onResume();
            }}
        >
            <textarea
                ref={textareaRef}
                aria-label="Practice text"
                aria-describedby="practice-current-word"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onKeyDown={onKeyDown}
                className="absolute left-0 top-0 h-px w-px opacity-0 resize-none overflow-hidden pointer-events-none"
            />
            <span id="practice-current-word" className="sr-only">{currentWord}</span>
            <div
                aria-hidden="true"
                className={cn("overflow-hidden font-medium tabular-nums transition-[filter,opacity]", compact ? "text-[22px] leading-[32px]" : "text-[28px] leading-[40px]", paused && "blur-[3px] opacity-60")}
                style={{ height: lineHeight * 3 }}
            >
                <div ref={innerRef} className="relative break-words" style={{ transform: offset ? `translateY(-${offset}px)` : undefined }}>
                    {words.map((word, i) => (
                        word.length === 1 && word[0].char.codePoint === 0x20
                            ? renderGlyph(word[0])
                            : <span key={`w${i}`} className="whitespace-nowrap">{word.map(renderGlyph)}</span>
                    ))}
                </div>
            </div>
            {paused && (
                <div data-practice-paused className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <span className="text-lg font-semibold text-kb-ink">Paused</span>
                    <button
                        type="button"
                        className={PILL_INK}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={() => {
                            textareaRef.current?.focus({ preventScroll: true });
                            props.onResume();
                        }}
                    >
                        Resume
                    </button>
                </div>
            )}
            <div aria-hidden="true" className="absolute left-6 right-6 bottom-2 h-0.5 rounded-full bg-kb-ink/15 overflow-hidden sm:left-10 sm:right-10">
                <div data-practice-progress className="h-full bg-kb-ink/40" style={{ width: `${length ? (pos / length) * 100 : 0}%` }} />
            </div>
        </div>
    );
});

export default TypingSurface;
