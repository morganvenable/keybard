import { memo, type MouseEvent, useMemo, useSyncExternalStore } from "react";
import { X } from "lucide-react";

import { Key } from "@/components/Key";
import { cn } from "@/lib/utils";
import { IDLE_BOARD, type LiveBoardState, type LiveInput } from "../input/liveInput";
import type { BoardKeyView, BoardView } from "./boardModel";
import { withAlpha } from "./format";
import type { BoardFit } from "./boardFit";

// The Practice board (docs/practice/spec.md §5.2 "Board", §9.6): Keybard's own key caps (Key.tsx), laid
// out from board.keylayout like Matrix Tester. It is not interactive during a lesson: keys are not
// buttons and the whole board is aria-hidden; a click anywhere on it only focuses the typing surface.
// In Live · USB, LiveBoard adds the keys held now (the pressed face) and wrong keys (red border and ×
// badge, from the press until 600 ms after release), and shows the live layer (§5.2).

/** Classes per key state (§5.2 table). */
const STATE_CLASSES = {
    included: "",
    locked: "bg-transparent border border-dashed border-kb-gray-border text-muted-foreground",
    other: "[&>*]:opacity-60",
} as const;

const RING = "z-10 ring-[3px] ring-kb-ink ring-offset-2 ring-offset-kb-gray";
const ALTERNATIVE = "z-10 outline-dashed outline-[3px] outline-kb-ink outline-offset-2";
/** A newly unlocked key pulses twice (§5.3). */
const PULSE = "motion-safe:animate-[pulse_0.9s_ease-in-out_2]";
/** Held now, live (§5.0.3 N-7): the darkest face, not the select role. */
const PRESSED = "bg-kb-pressed text-kb-pressed-fg border-kb-pressed [&>*]:opacity-100";
/** Wrong key, live (§5.2): the red role's border; the × badge carries it without hue. */
const WRONG = "border-2 border-kb-red";
const BADGE = "absolute z-20 flex size-3.5 items-center justify-center rounded-full text-[10px] font-semibold leading-none pointer-events-none";

interface PracticeKeyboardProps {
    view: BoardView;
    fit: BoardFit;
    /** Dims the board while the lesson is paused (§5.3). */
    dimmed?: boolean;
    /** The character unlocked by the last lesson: its key and cluster pulse. */
    pulse?: number | null;
    /** Live · USB: matrix indices held now. */
    pressed?: ReadonlySet<number>;
    /** Live · USB: matrix indices pressed by mistake (§5.2 Wrong key). */
    wrong?: ReadonlySet<number>;
    onActivate?: () => void;
    className?: string;
}

/** Keys compare by what they draw, so a keystroke re-renders only the few keys whose hint changed (§9.6). */
function sameKey(a: BoardKeyView, b: BoardKeyView): boolean {
    return a.index === b.index && a.keycode === b.keycode && a.label === b.label && a.layerColor === b.layerColor
        && a.state === b.state && a.ring === b.ring && a.alternative === b.alternative && a.x === b.x && a.y === b.y
        && a.w === b.w && a.h === b.h && a.keyContents?.type === b.keyContents?.type && a.keyContents?.str === b.keyContents?.str;
}

interface BoardKeyProps {
    k: BoardKeyView;
    variant: BoardFit["variant"];
    pulse: boolean;
    pressed: boolean;
    wrong: boolean;
}

const BoardKey = memo(function BoardKey({ k, variant, pulse, pressed, wrong }: BoardKeyProps) {
    return (
        <Key
            x={k.x}
            y={k.y}
            w={k.w}
            h={k.h}
            row={k.row}
            col={k.col}
            keycode={k.keycode}
            label={k.label}
            keyContents={k.keyContents}
            layerColor={k.state === "other" && !k.ring ? "light-grey" : k.layerColor}
            variant={variant}
            disableHover
            disableDrag
            disableTooltip
            data-practice-key={k.index}
            data-state={k.state}
            data-ring={k.ring || undefined}
            data-alternative={k.alternative || undefined}
            data-pressed={pressed || undefined}
            data-wrong={wrong || undefined}
            className={cn(
                "cursor-default",
                STATE_CLASSES[k.state],
                k.ring && RING,
                k.alternative && !k.ring && ALTERNATIVE,
                pulse && PULSE,
                pressed && PRESSED,
                wrong && WRONG,
            )}
        />
    );
}, (a, b) => a.variant === b.variant && a.pulse === b.pulse && a.pressed === b.pressed && a.wrong === b.wrong && sameKey(a.k, b.k));

const NONE: ReadonlySet<number> = new Set();

export function PracticeKeyboard({ view, fit, dimmed = false, pulse = null, pressed = NONE, wrong = NONE, onActivate, className }: PracticeKeyboardProps) {
    const { unit, scale, variant } = fit;
    const width = view.width * unit;
    const height = view.height * unit;
    const onMouseDown = (event: MouseEvent) => {
        // Keep focus in the typing surface: the board only focuses it.
        event.preventDefault();
        onActivate?.();
    };
    const pulseKey = pulse != null ? view.keys.find((k) => k.char === pulse) : undefined;
    return (
        <div
            aria-hidden="true"
            data-practice-board
            data-layer={view.displayedLayer}
            className={cn("relative mx-auto transition-opacity", dimmed && "opacity-60", className)}
            style={{ width: width * scale, height: height * scale }}
            onMouseDown={onMouseDown}
        >
            <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: scale === 1 ? undefined : `scale(${scale})` }}>
                {view.cluster && (
                    <div
                        data-practice-cluster
                        className={cn("absolute pointer-events-none", pulseKey?.inCluster && PULSE)}
                        style={{
                            left: view.cluster.x * unit,
                            top: view.cluster.y * unit,
                            width: view.cluster.w * unit,
                            height: view.cluster.h * unit,
                            borderRadius: 10,
                            backgroundColor: withAlpha(view.cluster.color, 0.18),
                        }}
                    />
                )}
                {view.keys.map((k) => (
                    <BoardKey key={k.index} k={k} variant={variant} pulse={pulse != null && k.char === pulse}
                        pressed={pressed.has(k.index)} wrong={wrong.has(k.index)} />
                ))}
                {/* The × takes the top-right corner of a wrong key, in place of its step badge (§5.2). */}
                {view.keys.filter((k) => k.step != null && !wrong.has(k.index)).map((k) => (
                    <span
                        key={`step-${k.index}`}
                        data-step-badge={k.step}
                        className={cn(BADGE, "bg-kb-ink text-kb-surface")}
                        style={{ left: (k.x + k.w) * unit - 16, top: k.y * unit + 2 }}
                    >
                        {k.step}
                    </span>
                ))}
                {view.keys.filter((k) => wrong.has(k.index)).map((k) => (
                    <span
                        key={`wrong-${k.index}`}
                        data-wrong-badge
                        className={cn(BADGE, "bg-kb-red text-white")}
                        style={{ left: (k.x + k.w) * unit - 16, top: k.y * unit + 2 }}
                    >
                        <X className="size-2.5" strokeWidth={3} />
                    </span>
                ))}
            </div>
        </div>
    );
}

const noSubscription = () => () => {};
const idleBoard = () => IDLE_BOARD;

interface LiveBoardProps extends Omit<PracticeKeyboardProps, "view" | "pressed" | "wrong"> {
    live: LiveInput | null;
    /** The board for a displayed layer: the live layer while reading, else null (the page's own choice, §5.2). */
    viewFor: (liveLayer: number | null) => BoardView;
}

/**
 * The board with Live · USB on it. Only this component subscribes to the reader's change-only board
 * state, so a running sampler re-renders nothing until a key goes down or up or the layer changes (§9.3).
 */
export function LiveBoard({ live, viewFor, ...props }: LiveBoardProps) {
    const state: LiveBoardState = useSyncExternalStore(live?.subscribeBoard ?? noSubscription, live?.getBoard ?? idleBoard, live?.getBoard ?? idleBoard);
    const view = useMemo(() => viewFor(state.layer), [viewFor, state.layer]);
    return <PracticeKeyboard view={view} pressed={state.pressed} wrong={state.wrong} {...props} />;
}

export default PracticeKeyboard;
