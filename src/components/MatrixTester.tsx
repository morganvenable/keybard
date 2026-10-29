import type { FC } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import "./MatrixTester.css";
import { Key } from "@/components/Key";
import { MatrixTesterNote } from "@/components/MatrixTesterNote";
import { BrushCleaningIcon } from "@/components/icons/BrushCleaning";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MATRIX_COLS, SVALBOARD_LAYOUT, UNIT_SIZE } from "@/constants/svalboard-layout";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useTypingPause } from "@/hooks/useTypingPause";
import { setMatrixTesterOpen } from "@/lib/matrix-tester-lock";
import { PARANOID, userIsLooking } from "@/lib/paranoid";
import { TesterEngine } from "@/lib/tester-engine";
import { keyboardService } from "@/services/keyboard.service";
import { requestSettingsSection } from "@/layout/SecondarySidebar/Panels/settings/anchor";
import { EXIT_HOLD_MS, findTesterExitKey } from "@/utils/tester-exit-key";

const BUTTON_STYLES = "w-12 h-12 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 bg-kb-surface shadow-lg flex items-center justify-center text-kb-ink focus:outline-none border border-gray-200 dark:border-neutral-700" as const;

/**
 * Creates a unique key identifier from row and column indices
 */
const createKeyId = (row: number, col: number): string => `${row}-${col}`;

type LayoutEntry = { x: number; y: number; w: number; h: number; row?: number; col?: number };
interface PlacedKey { id: string; row: number; col: number; l: LayoutEntry }

/** What the frame loop exposes for tests and measurements (window.keybardTester). */
export interface TesterStats {
    reads: number;
    readsPerSecond: number;
    roundTripMs: number;
    frames: number;
    drawnFrames: number;
    /** Renders of the tester and of its key grid since the page loaded. */
    renders: number;
    gridRenders: number;
}

// Render counts, for the tests' check that readings never go through React.
let testerRenders = 0;
let gridRenders = 0;

declare global {
    interface Window {
        keybardTester?: { stats: () => TesterStats };
    }
}

/**
 * Everything on the page outside `root` becomes inert (no focus, no clicks), so
 * Tab can't move focus to the editor behind the tester. Returns the undo.
 */
function makeOutsideInert(root: HTMLElement): () => void {
    const changed: HTMLElement[] = [];
    let node: HTMLElement | null = root;
    while (node && node !== document.body) {
        const parent: HTMLElement | null = node.parentElement;
        if (!parent) break;
        for (const sibling of Array.from(parent.children)) {
            if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert) continue;
            sibling.inert = true;
            changed.push(sibling);
        }
        node = parent;
    }
    return () => {
        for (const el of changed) el.inert = false;
    };
}

/** The key grid: rendered once per layout, never per reading. */
const KeyGrid = memo(function KeyGrid({ keys, keyVariant }: { keys: PlacedKey[]; keyVariant: "default" | "medium" | "small" }) {
    gridRenders++;
    return (
        <>
            {keys.map(({ id, row, col, l }) => (
                <Key
                    key={id}
                    x={l.x}
                    y={l.y}
                    w={l.w}
                    h={l.h}
                    keycode=""
                    label=""
                    row={row}
                    col={col}
                    selected={false}
                    layerColor="white"
                    variant={keyVariant}
                    disableHover
                    disableDrag
                    keyContents={{ type: "text", str: "" }}
                    disableTooltip={true}
                    data-matrix-key={id}
                />
            ))}
        </>
    );
});

/**
 * MatrixTester: every switch of the board, lit while it is down.
 *
 * The board is read as fast as the link allows (TesterEngine), and one
 * requestAnimationFrame loop draws at the display's own rate: it sets data
 * attributes on the key elements that changed since the last frame, with no
 * React state per reading or per frame. With the flicker latch (Sval 0x3D) a
 * switch that went down between two reads shows for at least one frame, and
 * each switch's presses are counted. Keys turn on and off instantly: no
 * transitions or animation.
 *
 * While it is open the board's typing is paused where the firmware can
 * (useTypingPause), Keybard's own shortcuts do nothing, the rest of the editor
 * is inert, and every key event reaching the page is swallowed. Holding the
 * board's Esc key for 2 s, Escape from another keyboard, or Close ends it.
 */
export const MatrixTester: FC = () => {
    testerRenders++;
    const { keyboard, isConnected, defaultLayerIndex } = useKeyboard();
    const { keyVariant } = useLayoutSettings();
    const { setActivePanel, openDetails, setPanelToGoBack, setItemToEdit } = usePanels();

    const [noteWidth, setNoteWidth] = useState<number | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const layoutRef = useRef<HTMLDivElement>(null);
    const countdownRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<TesterEngine | null>(null);

    const supportsPause = isConnected && keyboardService.hasTypingPause(keyboard);
    const hasLatch = isConnected && keyboardService.hasFlickerLatch(keyboard);
    useTypingPause(supportsPause);

    const close = useCallback(() => setActivePanel(null), [setActivePanel]);
    const closeRef = useRef(close);
    closeRef.current = close;

    const openFirmwareUpdate = useCallback(() => {
        requestSettingsSection("firmware");
        setActivePanel("settings");
        openDetails();
        setPanelToGoBack(null);
        setItemToEdit(null);
    }, [setActivePanel, openDetails, setPanelToGoBack, setItemToEdit]);

    const matrixCols = keyboard?.cols || MATRIX_COLS;
    const matrixRows = keyboard?.rows || 10;

    const exitKey = useMemo(
        () => findTesterExitKey(keyboard?.keymap, matrixCols, defaultLayerIndex ?? 0),
        [keyboard?.keymap, matrixCols, defaultLayerIndex]
    );

    const currentUnitSize = useMemo(() => {
        switch (keyVariant) {
            case 'small':
                return 30;
            case 'medium':
                return 45;
            default:
                return UNIT_SIZE;
        }
    }, [keyVariant]);

    const keyboardLayout = useMemo(() => {
        if (keyboard?.keylayout && Object.keys(keyboard.keylayout).length > 0) {
            return keyboard.keylayout as Record<number, LayoutEntry>;
        }
        return SVALBOARD_LAYOUT as Record<number, LayoutEntry>;
    }, [keyboard?.keylayout]);

    const placedKeys = useMemo<PlacedKey[]>(() => Object.entries(keyboardLayout).map(([pos, l]) => {
        const row = typeof l.row === "number" ? l.row : Math.floor(Number(pos) / matrixCols);
        const col = typeof l.col === "number" ? l.col : Number(pos) % matrixCols;
        return { id: createKeyId(row, col), row, col, l };
    }), [keyboardLayout, matrixCols]);

    const keyboardDimensions = useMemo(() => {
        let maxX = 0;
        let maxY = 0;
        Object.values(keyboardLayout).forEach((key) => {
            maxX = Math.max(maxX, key.x + key.w);
            maxY = Math.max(maxY, key.y + key.h);
        });
        return { width: maxX * currentUnitSize, height: maxY * currentUnitSize };
    }, [currentUnitSize, keyboardLayout]);

    // Where the exit key(s) sit: a static outline, and the countdown above them.
    const exitMarks = useMemo(() => exitKey.keys.flatMap(({ row, col }) => {
        const k = placedKeys.find((p) => p.row === row && p.col === col);
        if (!k) return [];
        const { l } = k;
        return [{ id: k.id, cx: (l.x + l.w / 2) * currentUnitSize, cy: (l.y + l.h / 2) * currentUnitSize, top: l.y * currentUnitSize, r: (Math.max(l.w, l.h) * currentUnitSize) / 2 + 6 }];
    }), [exitKey, placedKeys, currentUnitSize]);

    // The open tester: shortcuts off, the editor inert, key events swallowed.
    useLayoutEffect(() => {
        setMatrixTesterOpen(true);
        const root = rootRef.current;
        const undoInert = root ? makeOutsideInert(root) : () => undefined;
        root?.focus({ preventScroll: true });
        const swallow = (e: KeyboardEvent) => {
            if (e.type === "keydown" && e.key === "Escape") {
                e.preventDefault();
                e.stopImmediatePropagation();
                closeRef.current();
                return;
            }
            // Tab stays here, and nothing reaches Keybard's shortcuts or the editor.
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        window.addEventListener("keydown", swallow, true);
        window.addEventListener("keyup", swallow, true);
        window.addEventListener("keypress", swallow, true);
        return () => {
            window.removeEventListener("keydown", swallow, true);
            window.removeEventListener("keyup", swallow, true);
            window.removeEventListener("keypress", swallow, true);
            undoInert();
            setMatrixTesterOpen(false);
        };
    }, []);

    // The note fits the visible canvas, not the (wider) keyboard.
    useLayoutEffect(() => {
        const scroller = rootRef.current?.closest(".keyboard-canvas-scroll") as HTMLElement | null;
        if (!scroller) return;
        const measure = () => setNoteWidth(Math.max(240, scroller.clientWidth - 32));
        measure();
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        ro?.observe(scroller);
        return () => ro?.disconnect();
    }, []);

    // Reading (TesterEngine) and drawing (one requestAnimationFrame loop), outside React.
    useEffect(() => {
        const kb = keyboard;
        const layoutEl = layoutRef.current;
        if (!isConnected || !kb || !layoutEl) return;
        const rows = matrixRows, cols = matrixCols;
        const engine = new TesterEngine(rows, cols, {
            readLatch: hasLatch ? () => keyboardService.readFlickerLatch() : null,
            readCounts: hasLatch ? (half) => keyboardService.readFlickerCounts(half, kb) : null,
            readMatrix: () => keyboardService.pollMatrix(kb),
            // Paranoid: never read key presses while you're typing in another window.
            mayRead: () => document.visibilityState === "visible" && !(PARANOID && !userIsLooking()),
        });
        engineRef.current = engine;

        // The key elements, indexed row * cols + col.
        const keyEls: (HTMLElement | null)[] = new Array(rows * cols).fill(null);
        layoutEl.querySelectorAll<HTMLElement>("[data-matrix-key]").forEach((el) => {
            const [r, c] = (el.dataset.matrixKey ?? "").split("-").map(Number);
            if (r < rows && c < cols) keyEls[r * cols + c] = el;
        });
        const countEls: (HTMLElement | null)[] = new Array(rows * cols).fill(null);
        layoutEl.querySelectorAll<HTMLElement>("[data-key-count]").forEach((el) => {
            const [r, c] = (el.dataset.keyCount ?? "").split("-").map(Number);
            if (r < rows && c < cols) countEls[r * cols + c] = el;
        });
        const shownDown = new Uint8Array(rows), shownSeen = new Uint8Array(rows);
        const shownCounts = new Uint16Array(rows * cols);
        let drawnVersion = -1, drawnCounts = -1;
        let holdStart: number | null = null, shownStep = 0;
        let frame = 0, frames = 0, drawnFrames = 0;

        const setStep = (step: number) => {
            if (step === shownStep) return;
            shownStep = step;
            const el = countdownRef.current;
            if (!el) return;
            if (step > 0) {
                el.textContent = `Keep holding to close: ${step}`;
                el.hidden = false;
            } else {
                el.hidden = true;
            }
        };

        const draw = (now: number) => {
            frame = requestAnimationFrame(draw);
            frames++;
            if (engine.version !== drawnVersion) {
                drawnVersion = engine.version;
                drawnFrames++;
                for (let r = 0; r < rows; r++) {
                    const down = engine.current[r] | engine.latched[r];
                    const seen = engine.seen[r];
                    const changedDown = down ^ shownDown[r], changedSeen = seen ^ shownSeen[r];
                    if (changedDown | changedSeen) {
                        for (let c = 0; c < cols; c++) {
                            const bit = 1 << c;
                            const el = keyEls[r * cols + c];
                            if (!el) continue;
                            if (changedDown & bit) el.toggleAttribute("data-down", (down & bit) !== 0);
                            if (changedSeen & bit) el.toggleAttribute("data-seen", (seen & bit) !== 0);
                        }
                        shownDown[r] = down;
                        shownSeen[r] = seen;
                    }
                    // A switch that went down since the last frame has now shown for one
                    // frame; from the next frame it shows its real state.
                    if (engine.latched[r] & ~engine.current[r]) engine.version++;
                    engine.latched[r] = 0;
                }
            }
            if (engine.countsVersion !== drawnCounts) {
                drawnCounts = engine.countsVersion;
                for (let i = 0; i < engine.presses.length; i++) {
                    const n = engine.presses[i];
                    if (n === shownCounts[i]) continue;
                    shownCounts[i] = n;
                    const el = countEls[i];
                    if (!el) continue;
                    el.textContent = n > 999 ? "999+" : String(n);
                    el.hidden = n === 0;
                }
            }
            // The exit hold: a countdown in whole seconds, then close.
            const held = exitKey.keys.length > 0 && exitKey.keys.every(({ row, col }) => ((engine.current[row] >> col) & 1) === 1);
            if (held) {
                if (holdStart === null) holdStart = now;
                const left = EXIT_HOLD_MS - (now - holdStart);
                if (left <= 0) {
                    setStep(0);
                    cancelAnimationFrame(frame);
                    closeRef.current();
                    return;
                }
                setStep(Math.ceil(left / 1000));
            } else if (holdStart !== null) {
                holdStart = null;
                setStep(0);
            }
        };

        const startDrawing = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(draw);
        };
        const onVisibility = () => {
            if (document.visibilityState === "visible") startDrawing();
            else cancelAnimationFrame(frame);
        };
        document.addEventListener("visibilitychange", onVisibility);
        engine.start();
        startDrawing();
        window.keybardTester = {
            stats: () => {
                const secs = (performance.now() - engine.readStart) / 1000;
                return { reads: engine.reads, readsPerSecond: secs > 0 ? engine.reads / secs : 0, roundTripMs: engine.lastRoundTripMs, frames, drawnFrames, renders: testerRenders, gridRenders };
            },
        };
        return () => {
            engine.stop();
            cancelAnimationFrame(frame);
            document.removeEventListener("visibilitychange", onVisibility);
            engineRef.current = null;
            delete window.keybardTester;
            keyEls.forEach((el) => { el?.removeAttribute("data-down"); el?.removeAttribute("data-seen"); });
        };
    }, [isConnected, keyboard, hasLatch, matrixRows, matrixCols, exitKey, placedKeys]);

    const handleClearMatrix = useCallback(() => engineRef.current?.clearSeen(), []);
    const handleResetCounts = useCallback(() => engineRef.current?.resetCounts(), []);

    const noteKind = supportsPause || !isConnected ? "paused" : "unsupported";
    const badge = Math.max(14, Math.round(currentUnitSize * 0.32));

    return (
        <div
            ref={rootRef}
            tabIndex={-1}
            className="flex flex-col items-center justify-center p-4 outline-none"
            data-matrix-tester=""
            data-typing-pause={supportsPause ? "on" : "unsupported"}
            data-flicker-latch={hasLatch ? "on" : "off"}
            aria-label="Matrix tester"
            role="region"
        >
            {/* The note, kept in view while the keyboard scrolls sideways */}
            <div
                className="sticky left-4 z-10 mb-4 flex flex-wrap items-start justify-end gap-2 self-start"
                style={noteWidth ? { width: `${noteWidth}px` } : undefined}
                data-tester-note-row=""
            >
                <div className="min-w-[16rem] flex-1">
                    <MatrixTesterNote kind={noteKind} exitName={exitKey.name} onUpdateFirmware={openFirmwareUpdate} />
                </div>
                <button
                    type="button"
                    onClick={close}
                    className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-kb-gray-border bg-kb-surface px-3 py-1.5 text-sm font-medium text-kb-ink shadow-sm hover:bg-kb-gray-medium"
                    data-tester-close=""
                >
                    <X aria-hidden className="h-4 w-4" />
                    Close
                </button>
            </div>

            {/* Keyboard Layout */}
            <div
                ref={layoutRef}
                className="keyboard-layout relative"
                style={{ width: `${keyboardDimensions.width}px`, height: `${keyboardDimensions.height}px` }}
            >
                <KeyGrid keys={placedKeys} keyVariant={keyVariant} />

                {/* Press counts, one per switch, shown once a switch has been pressed (with the latch) */}
                {hasLatch && placedKeys.map(({ id, l }) => (
                    <span
                        key={`count-${id}`}
                        data-key-count={id}
                        hidden
                        className="pointer-events-none absolute z-10 flex items-center justify-center rounded-full border border-kb-gray-border bg-kb-surface px-1 font-semibold leading-none text-kb-ink shadow-sm tabular-nums"
                        style={{ left: (l.x + l.w) * currentUnitSize - badge * 0.7, top: l.y * currentUnitSize - badge * 0.3, minWidth: badge, height: badge, fontSize: Math.round(badge * 0.62) }}
                    />
                ))}

                {/* The exit key: a static outline, and a countdown in whole seconds while it is held */}
                {supportsPause && exitMarks.length > 0 && (
                    <>
                        <svg
                            className="pointer-events-none absolute inset-0 z-10 overflow-visible"
                            width={keyboardDimensions.width}
                            height={keyboardDimensions.height}
                            aria-hidden
                            data-tester-exit-mark=""
                        >
                            {exitMarks.map((m) => (
                                <circle key={m.id} data-exit-key={m.id} cx={m.cx} cy={m.cy} r={m.r} fill="none" strokeWidth={2} strokeDasharray="4 4" className="stroke-kb-gray" />
                            ))}
                        </svg>
                        <div
                            ref={countdownRef}
                            hidden
                            role="status"
                            data-tester-exit-countdown=""
                            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-kb-active px-2 py-1 text-sm font-semibold text-kb-active-fg shadow"
                            style={{ left: exitMarks[0].cx, top: exitMarks[0].top - 10 }}
                        />
                    </>
                )}
            </div>

            {/* Clear Matrix and Reset counts */}
            <div className="absolute bottom-9 left-[37px] z-50 flex items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={handleClearMatrix} className={BUTTON_STYLES} aria-label="Clear Matrix">
                            <BrushCleaningIcon className="h-5 w-5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>Clear Matrix</p>
                    </TooltipContent>
                </Tooltip>
                {hasLatch && (
                    <button
                        type="button"
                        onClick={handleResetCounts}
                        className="h-12 cursor-pointer rounded-2xl border border-kb-gray-border bg-kb-surface px-4 text-sm font-medium text-kb-ink shadow-lg hover:bg-kb-gray-medium"
                        data-tester-reset-counts=""
                    >
                        Reset counts
                    </button>
                )}
            </div>
        </div>
    );
};
