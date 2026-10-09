import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import demoLayoutUrl from "@/default-layouts/sval-default.svil?url";
import { PILL_INK, PILL_QUIET } from "@/components/shared/pills";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { usePanels } from "@/contexts/PanelsContext";
import { cn } from "@/lib/utils";
import { placeOf } from "../keymap/geometry";
import { PracticeGuidedLesson } from "../lessons/guided";
import { PAGE_FRAME } from "../PracticeWorkspace";
import { PracticeHeader } from "../PracticeHeader";
import { usePractice } from "../PracticeProvider";
import type { PracticeController } from "../state/controller";
import { characterStats, type CharacterStats, stripKeys } from "../state/progressView";
import { effectiveLessonType, START_PRESETS, type StartPreset, toKeybrSettings } from "../state/settings";
import { boardSize, boardView, displayedLayerFor } from "./boardModel";
import { fitBoard, useSettledWidth } from "./boardFit";
import { layerColorHex, layerColorName, spokenPlace } from "./format";
import { InputStatus } from "./InputStatus";
import { KeyStrip } from "./KeyStrip";
import { MetricsRow } from "./MetricsRow";
import { PracticeKeyboard } from "./PracticeKeyboard";
import { presetWpm, StartView } from "./StartView";
import { StatusSlotItem, TypeRow } from "./TypeRow";
import { TypingSurface, type TypingSurfaceHandle } from "./TypingSurface";
import { FloatingTools, Well } from "./Wells";

// P1 Lessons (docs/practice/spec.md §5.2, §5.3): key strip, metrics row, type row with the status slot,
// the text card and the board, with the floating tools; P2 Start on first run; the empty and error wells.
// The page reads PracticeController and tells it about focus; the controller owns the lesson.

const EMPTY = new Set<number>();

function useCharacterStats(controller: PracticeController | null) {
    const session = controller?.session ?? null;
    const version = controller?.version;
    return useMemo(() => {
        const cache = new Map<number, CharacterStats>();
        return (codePoint: number): CharacterStats => {
            let stats = cache.get(codePoint);
            if (stats) return stats;
            const letter = session!.lesson.letters.find((l) => l.codePoint === codePoint)!;
            stats = characterStats(session!.keyStatsMap.get(letter), session!.target, session!.resolution.primary(codePoint));
            cache.set(codePoint, stats);
            return stats;
        };
        // The stats change with every completed lesson (the version) and every new session.
    }, [session, version]);
}

export default function LessonsPage({ active = true }: { active?: boolean }) {
    const controller = usePractice();
    const { keyboard, connect, loadFromFile } = useKeyboard();
    const { layoutMode } = useLayoutSettings();
    const { open: panelOpen, handleCloseDetails, setActivePanel, returnFocusOverride, setWorkspace } = usePanels();
    const surface = useRef<TypingSurfaceHandle | null>(null);
    const frame = useRef<HTMLDivElement | null>(null);
    const width = useSettledWidth(frame);
    const [preset, setPreset] = useState<StartPreset | null>(null);
    const [targetWpm, setTargetWpm] = useState(25);
    const [boardSheet, setBoardSheet] = useState(false);

    const session = controller?.session ?? null;
    const run = controller?.run ?? null;
    const settings = controller?.settings;
    const stats = useCharacterStats(controller);

    // Closing the Lesson panel returns focus to the (still paused) typing surface (§4.1).
    useEffect(() => {
        if (!active) return;
        returnFocusOverride.current = surface.current?.textarea ?? null;
        return () => {
            if (returnFocusOverride.current === surface.current?.textarea) returnFocusOverride.current = null;
        };
    });

    const focusSurface = useCallback(() => {
        surface.current?.focus();
        controller?.resume();
    }, [controller]);

    const onFocusChange = useCallback((focused: boolean) => {
        controller?.setFocused(focused);
        if (!focused) return;
        if (layoutMode === "bottombar") {
            surface.current?.card?.scrollIntoView?.({ block: "nearest" });
        } else if (panelOpen && window.innerWidth < 1100) {
            // Side layout below 1100 px: the panel covers the page, so typing closes it (§4.1).
            handleCloseDetails();
        }
    }, [controller, layoutMode, panelOpen, handleCloseDetails]);

    const openPanelAt = useCallback((section: string) => {
        controller?.requestPanelSection(section);
        setActivePanel("practice");
    }, [controller, setActivePanel]);

    const loadExample = useCallback(async () => {
        const response = await fetch(demoLayoutUrl);
        if (!response.ok) return;
        const file = new File([await response.blob()], "sval-default.svil", { type: "application/json" });
        await loadFromFile(file, "demo");
    }, [loadFromFile]);

    // First run: the board previews the chosen preset's first lesson (§5.4).
    const preview = useMemo(() => {
        if (!session?.firstRun || !preset || !controller?.content) return null;
        const lesson = new PracticeGuidedLesson(toKeybrSettings({ ...session.settings, ...START_PRESETS[preset] }), session.keyboard, controller.content.model, controller.content.words);
        const keys = lesson.update(session.keyStatsMap);
        return {
            included: new Set(keys.findIncludedKeys().map((k) => k.letter.codePoint)),
            locked: new Set(keys.findExcludedKeys().map((k) => k.letter.codePoint)),
        };
    }, [session, preset, controller?.content]);

    const lessonKeys = session?.lessonKeys ?? null;
    const included = useMemo(() => new Set(lessonKeys?.findIncludedKeys().map((k) => k.letter.codePoint) ?? []), [lessonKeys]);
    const locked = useMemo(() => new Set(lessonKeys?.findExcludedKeys().map((k) => k.letter.codePoint) ?? []), [lessonKeys]);

    const board = session?.keymap.board ?? keyboard;
    const units = board ? boardSize(board).width : 25;
    const fit = fitBoard(width, units);
    const defaultLayer = session?.keymap.defaultLayer ?? 0;
    const next = run?.expected ?? null;
    const noLesson = !session || session.noLetters || controller?.loadState === "content-error";
    const view = useMemo(() => {
        if (!board) return null;
        const resolution = session?.resolution ?? null;
        const firstRun = !!session?.firstRun;
        return boardView({
            keyboard: board,
            resolution,
            layoutId: session?.keymap.layoutId ?? "us",
            defaultLayer,
            displayedLayer: displayedLayerFor(resolution, next, !!run?.started, defaultLayer),
            included: firstRun ? preview?.included ?? EMPTY : included,
            locked: firstRun ? preview?.locked ?? locked : locked,
            next: firstRun ? null : settings?.hints === "off" ? null : next,
            hints: settings?.hints ?? "next-cluster",
            legends: settings?.legends ?? true,
            noLesson,
        });
    }, [board, session, defaultLayer, next, run?.started, preview, included, locked, settings?.hints, settings?.legends, noLesson]);

    const layerColorOf = useCallback((codePoint: number) => {
        const path = session?.resolution.primary(codePoint);
        return layerColorName(board, path?.layer ?? defaultLayer);
    }, [session, board, defaultLayer]);

    const statusPill = controller && session && !session.firstRun ? <InputStatus controller={controller} onConnect={() => void connect()} /> : null;
    const narrow = width > 0 && width < 480;
    const boardHidden = !settings?.showBoard;

    const boardBlock = view && !boardHidden && (
        fit.hidden ? (
            boardSheet && (
                <div className="fixed inset-x-2 bottom-2 z-40 overflow-x-auto rounded-2xl bg-kb-surface p-4 shadow-xl border border-gray-200 dark:border-neutral-700" data-practice-board-sheet>
                    <PracticeKeyboard view={view} fit={{ ...fit, hidden: false }} dimmed={controller?.paused} pulse={controller?.justUnlocked ?? null} onActivate={focusSurface} />
                </div>
            )
        ) : (
            <PracticeKeyboard view={view} fit={fit} dimmed={!!run && controller?.paused} pulse={controller?.justUnlocked ?? null} onActivate={focusSurface} />
        )
    );

    let body: React.ReactNode;
    if (!controller || controller.loadState === "loading" || (!session && controller.loadState !== "content-error")) {
        body = (
            <>
                <div className="flex gap-1.5" aria-hidden="true" data-practice-skeleton>
                    {Array.from({ length: 10 }, (_, i) => <span key={i} className="size-[30px] rounded-[5px] bg-muted motion-safe:animate-pulse" />)}
                </div>
                <MetricsRow skeleton last={null} unit="wpm" keys={{ included: 0, alphabet: 0 }} today={{ minutes: 0, goal: 0 }} />
                <div className="bg-kb-surface rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 px-10 py-8 flex flex-col gap-4" aria-hidden="true">
                    {[0, 1, 2].map((i) => <span key={i} className="h-6 rounded bg-muted motion-safe:animate-pulse" />)}
                </div>
                {boardBlock}
            </>
        );
    } else if (controller.loadState === "content-error") {
        body = (
            <>
                <Well title="Practice words didn't load">
                    <button type="button" className={PILL_INK} onClick={() => controller.retry()}>Retry</button>
                </Well>
                {boardBlock}
            </>
        );
    } else if (session!.noLetters) {
        body = (
            <>
                <Well title="No letters to practice on this keymap">
                    <button type="button" className={PILL_QUIET} onClick={() => void loadExample()}>QWERTY example</button>
                    <button type="button" className={PILL_QUIET} onClick={() => { setWorkspace("editor"); setActivePanel("layouts"); }}>Layouts</button>
                </Well>
                {boardBlock}
            </>
        );
    } else if (session!.firstRun) {
        body = (
            <>
                <StartView
                    preset={preset}
                    onPreset={(p) => { setPreset(p); setTargetWpm(presetWpm(p)); }}
                    targetWpm={targetWpm}
                    onTarget={setTargetWpm}
                    sourceName={controller.sourceName}
                    onStart={() => {
                        if (!preset) return;
                        void controller.startPractice(preset, targetWpm * 5).then(() => focusSurface());
                    }}
                />
                {boardBlock}
            </>
        );
    } else {
        const s = session!;
        const nextPath = next != null ? s.resolution.primary(next) : null;
        body = (
            <>
                <KeyStrip
                    keys={stripKeys(s.lessonKeys)}
                    stats={stats}
                    resolution={s.resolution}
                    cols={s.keymap.board.cols}
                    unit={settings!.speedUnit}
                    layerColorOf={layerColorOf}
                    justUnlocked={controller.justUnlocked}
                />
                <MetricsRow
                    last={s.lastLesson()}
                    unit={settings!.speedUnit}
                    keys={{ included: included.size, alphabet: s.lesson.letters.length }}
                    today={{ minutes: s.minutesToday(), goal: settings!.dailyGoal }}
                    fresh={!run?.started}
                />
                <TypeRow
                    type={effectiveLessonType(settings!.type)}
                    scope={settings!.order === "center-first" ? "Center first" : "Frequency"}
                    onType={(type, source) => {
                        controller.update({ type });
                        if (source === "pointer") focusSurface();
                    }}
                    onScope={() => openPanelAt("guided")}
                    onEnter={focusSurface}
                    status={
                        <StatusSlotItem item={controller.status} resolution={s.resolution} cols={s.keymap.board.cols}
                            unit={settings!.speedUnit} layerColorOf={layerColorOf} />
                    }
                />
                {run && (
                    <TypingSurface
                        ref={surface}
                        run={run}
                        version={controller.version}
                        paused={controller.paused}
                        showSpaces={settings!.showSpaces}
                        layerUnderlines={settings!.layerUnderlines}
                        resolution={s.resolution}
                        defaultLayer={defaultLayer}
                        layerHex={(layer) => layerColorHex(board, layer)}
                        compact={narrow}
                        onKey={(event) => controller.onKey(event)}
                        onInput={(event) => controller.onInput(event)}
                        onFocusChange={onFocusChange}
                        onTogglePause={() => controller.togglePause()}
                        onResume={() => controller.resume()}
                    />
                )}
                {settings!.announceNextKey && nextPath && (
                    <p className="sr-only" aria-live="polite">
                        {`Next: ${String.fromCodePoint(nextPath.char)}, ${spokenPlace(placeOf(nextPath.index, s.keymap.board.cols))}, layer ${nextPath.layer}`}
                    </p>
                )}
                {boardBlock}
                {/* In the page flow at its bottom-left, not floating over it: the page scrolls, and in
                    bottom-bar layout a floating group would sit on the metrics above the docked panel. */}
                <div className="mt-auto pt-2">
                    <FloatingTools
                        className="w-fit"
                        hints={settings!.hints}
                        onHints={(hints) => controller.update({ hints })}
                        onRestart={() => { controller.regenerate(); focusSurface(); }}
                        onBoard={fit.hidden && !boardHidden ? () => setBoardSheet((v) => !v) : undefined}
                        boardShown={boardSheet}
                    />
                </div>
            </>
        );
    }

    return (
        <div ref={frame} className={cn(PAGE_FRAME, narrow && "pb-24")} data-practice-page="lessons">
            <PracticeHeader right={statusPill} />
            {body}
            <div className="sr-only" aria-live="polite" data-practice-announce>{controller?.announcement}</div>
        </div>
    );
}
