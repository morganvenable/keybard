import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Notice } from "@/components/shared/Notice";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { PILL_BRAND, PILL_INK } from "@/components/shared/pills";
import { usePanels } from "@/contexts/PanelsContext";
import { PAGE_FRAME } from "../../PracticeWorkspace";
import { PracticeHeader } from "../../PracticeHeader";
import { usePractice } from "../../PracticeProvider";
import { boardGeometry } from "../../keymap/geometry";
import { hasDoubleSouth } from "../../lessons/scope";
import { NOTICE_TEXT, type PracticeController } from "../../state/controller";
import type { EventStats } from "../../state/eventStats";
import {
    fingersGrid, heatmapKeys, inferredOnlyChars, layerRows, metricValue, mostlyInferred, physicalTotals, thumbRows, usageQuartiles,
} from "../../state/progressAggregates";
import { chartPoints, periodLabel, periodView } from "../../state/progressView";
import type { StoredResult } from "../../store/db";
import { keyService } from "@/services/key.service";
import { formatDuration, formatSpeed, layerColorName } from "../format";
import { InferredChip } from "../KeyPopover";
import { StatCell } from "../StatCell";
import { Well } from "../Wells";
import { CharTable } from "./CharTable";
import { FingersGridView, thumbAction, ThumbsView } from "./FingersThumbs";
import { HeatmapBoard, HeatScale, HeatToolbar } from "./Heatmap";
import { HistoryTable, LayersTable } from "./LayersHistory";
import type { ProgressP5 } from "./p5";
import { SpeedChart } from "./SpeedChart";

// G1 Progress (docs/practice/spec.md §5.8): Summary, Speed, the Keyboard heatmap, Fingers, Thumbs,
// Layers, Characters and History for the active profile in the chosen period (set in the Progress panel
// and echoed in the header). The heatmap's metric drives the Fingers and Thumbs faces too. Sections
// whose samples are mostly inferred from the keymap get the Inferred chip. Every heatmap key, grid cell,
// Layers row and Characters row opens P5.

function Section({ title, children, tools, suffix, scale }: { title: string; children: ReactNode; tools?: ReactNode; suffix?: ReactNode; scale?: ReactNode }) {
    const id = `progress-${title.toLowerCase()}`;
    return (
        <section aria-labelledby={id} className="flex flex-col gap-3 min-w-0" data-progress-section={title}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h2 id={id} className="text-lg font-semibold text-kb-ink">{title}</h2>
                {suffix}
                {scale}
                {tools && <div className="ml-auto flex items-center gap-2">{tools}</div>}
            </div>
            {children}
        </section>
    );
}

const CARD = "bg-kb-surface rounded-2xl border border-gray-200 dark:border-neutral-700";

/** P5's Pressed instead and layer reach for the period, loaded from the stored events (null while loading). */
function useEventStats(controller: PracticeController | null, records: readonly StoredResult[] | undefined, key: string): EventStats | null {
    const [state, setState] = useState<{ key: string; stats: EventStats } | null>(null);
    useEffect(() => {
        if (!controller || !records) return;
        let live = true;
        void controller.eventStats(records).then((stats) => { if (live) setState({ key, stats }); });
        return () => { live = false; };
        // `key` names the records (profile, count, period, keymap, history revision).
    }, [controller, key]);
    return state?.key === key ? state.stats : null;
}

export default function ProgressPage({ active = true }: { active?: boolean }) {
    const controller = usePractice();
    const { setPracticePage } = usePanels();
    const session = controller?.session ?? null;
    const settings = controller?.settings;
    const period = settings?.period ?? "30";
    const records = session?.records;
    const count = records?.length ?? 0;
    const board = session?.keymap.board;

    const view = useMemo(() => {
        if (!session) return null;
        // Every character the keymap types: the language letters always, the others once practiced (M3).
        return periodView(session.lesson, session.records, session.target, (c) => session.resolution.primary(c), period, Date.now(), {
            tracked: session.trackedLetters,
            always: new Set(session.languageLetters.map((l) => l.codePoint)),
        });
        // A new lesson appends to the same records array, so its length is part of the key.
    }, [session, period, count]);

    const events = useEventStats(controller, view?.records, `${session?.profile.id}:${count}:${period}:${session?.fingerprint}:${controller?.historyRevision}`);

    const layerColorOf = useCallback((codePoint: number) => {
        const path = session?.resolution.primary(codePoint);
        return layerColorName(controller?.keymap?.board ?? board, path?.layer ?? 0);
    }, [session, controller?.keymap?.board, board]);

    // The physical sections: totals, the grids, the Inferred rules (M4).
    const physical = useMemo(() => {
        if (!session || !view || !board) return null;
        const places = boardGeometry(board);
        const totals = physicalTotals(view.records);
        const target = session.settings.targetSpeed;
        return {
            places,
            totals,
            fingers: fingersGrid(places, totals, target, session.resolution, hasDoubleSouth(places)),
            thumbs: thumbRows(places, totals, target, session.resolution),
            layers: layerRows(view.records, board.keymap ?? [], session.keymap.defaultLayer, (code) => keyService.stringify(code)),
            inferred: mostlyInferred(view.records),
            inferredChars: inferredOnlyChars(view.records),
        };
    }, [session, view, board]);

    const [chosenLayer, setChosenLayer] = useState<number | null>(null);
    const metric = settings?.heatMetric ?? "speed";
    const target = settings?.targetSpeed ?? 175;

    // The heatmap's keys on the chosen layer and the usage quartiles of what each section shows.
    const heat = useMemo(() => {
        if (!session || !view || !physical || !board) return null;
        const defaultLayer = session.keymap.defaultLayer;
        const layers = physical.totals.layers;
        const layer = chosenLayer != null && layers.includes(chosenLayer) ? chosenLayer : layers.includes(defaultLayer) ? defaultLayer : layers[0] ?? defaultLayer;
        const characters = new Map(view.characters.map((c) => [c.codePoint, c]));
        const keys = heatmapKeys({
            keymap: board.keymap ?? [], resolution: session.resolution, indices: physical.places.map((p) => p.index), layer, defaultLayer,
            totals: physical.totals, characters, targetSpeed: target,
        });
        const gridGroups = [...physical.fingers.cells.flat(), ...physical.thumbs.left.map((r) => r.group), ...physical.thumbs.right.map((r) => r.group)];
        return {
            layer, layers, characters, keys,
            keyQuartiles: usageQuartiles(keys.map((k) => (k.noData ? 0 : k.values.usage ?? 0))),
            gridQuartiles: usageQuartiles(gridGroups.map((g) => (g ? metricValue(g.values, "usage") ?? 0 : 0))),
        };
    }, [session, view, physical, board, chosenLayer, target]);

    const profileName = session?.profile.name ?? "Me";
    const header = <PracticeHeader right={<span className="text-sm text-muted-foreground whitespace-nowrap truncate">{profileName} · {periodLabel(period)}</span>} />;
    const storageOff = controller?.storageOff ? <Notice>{NOTICE_TEXT["storage-off"]}</Notice> : null;

    // Without the content there is no lesson to replay the history through: the Lessons page's well and Retry.
    if (controller?.loadState === "content-error") {
        return (
            <div className={PAGE_FRAME} data-practice-page="progress" data-active={active}>
                {header}
                {storageOff}
                <Well title="Practice words didn't load">
                    <button type="button" className={PILL_INK} onClick={() => controller.retry()}>Retry</button>
                </Well>
            </div>
        );
    }

    if (!controller || !session || !view || !settings || !physical || !board || !heat) {
        return (
            <div className={PAGE_FRAME} data-practice-page="progress" data-active={active}>
                {header}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => <StatCell key={i} label="" value="" skeleton />)}
                </div>
                <div className="h-[240px] rounded-xl bg-muted motion-safe:animate-pulse" aria-hidden="true" />
                <div className="h-[300px] rounded-xl bg-muted motion-safe:animate-pulse" aria-hidden="true" />
            </div>
        );
    }

    if (view.summary.lessons === 0 && count === 0) {
        return (
            <div className={PAGE_FRAME} data-practice-page="progress" data-active={active}>
                {header}
                {storageOff}
                <Well title="No lessons yet">
                    <button type="button" className={PILL_BRAND} onClick={() => setPracticePage("lessons")}>Start practicing</button>
                </Well>
            </div>
        );
    }

    const unit = settings.speedUnit;
    const s = view.summary;
    const points = chartPoints(view.records, view.results, settings.chartAxis);
    const defaultLayer = session.keymap.defaultLayer;
    const { layer, layers, characters, keys: heatKeys, keyQuartiles, gridQuartiles } = heat;
    const inferred = physical.inferred ? <InferredChip /> : null;
    const p5: ProgressP5 = {
        resolution: session.resolution,
        cols: board.cols,
        unit,
        targetSpeed: target,
        records: view.records,
        characters,
        events,
        inferredChars: physical.inferredChars,
        inferred: physical.inferred,
        layerColor: (l) => layerColorName(board, l),
        charColor: layerColorOf,
        onDrillKey: (codePoint) => { controller.drillKey(codePoint); setPracticePage("lessons"); },
        canDrillKey: (codePoint) => controller.canDrillKey(codePoint),
        onDrillGroup: (codePoints, name) => { controller.drillGroup(codePoints, name); setPracticePage("lessons"); },
        drillable: (codePoints) => controller.drillableOf(codePoints).length,
    };
    return (
        <div className={PAGE_FRAME} data-practice-page="progress" data-active={active}>
            {header}
            {storageOff}
            <Section title="Summary">
                <div className="@container">
                    <div className="grid grid-cols-2 @min-[480px]:grid-cols-3 @min-[900px]:grid-cols-5 gap-4">
                        <StatCell label="Lessons" value={s.lessons} />
                        <StatCell label="Time" value={formatDuration(s.time)} />
                        <StatCell label="Top speed" value={formatSpeed(s.lessons ? s.topSpeed : null, unit)} unit={unit} />
                        <StatCell label="Accuracy" value={s.accuracy != null ? (s.accuracy * 100).toFixed(1) : "—"} unit="%" />
                        <StatCell label="Keys at target" value={s.keysAtTarget} unit={`/ ${s.alphabet}`} />
                    </div>
                </div>
            </Section>
            <Section
                title="Speed"
                tools={<SegmentedControl label="Speed chart by" value={settings.chartAxis} onChange={(chartAxis) => controller.update({ chartAxis })}
                    options={[{ value: "lessons", label: "Lessons" }, { value: "days", label: "Days" }]} />}
            >
                <div className={`${CARD} p-4`}>
                    {points.length ? (
                        <SpeedChart points={points} unit={unit} target={target} axis={settings.chartAxis} />
                    ) : (
                        <p className="text-sm text-muted-foreground">No lessons in this period</p>
                    )}
                </div>
            </Section>
            <Section title="Keyboard" suffix={inferred} scale={<HeatScale metric={metric} targetSpeed={target} unit={unit} quartiles={keyQuartiles} />}>
                <HeatToolbar metric={metric} onMetric={(heatMetric) => controller.update({ heatMetric })} layers={layers} layer={layer} onLayer={setChosenLayer} board={board} />
                <HeatmapBoard board={board} layoutId={session.keymap.layoutId} defaultLayer={defaultLayer} layer={layer} keys={heatKeys}
                    metric={metric} quartiles={keyQuartiles} physical={physical.totals} p5={p5} />
            </Section>
            <Section title="Fingers" suffix={inferred} scale={<HeatScale metric={metric} targetSpeed={target} unit={unit} quartiles={gridQuartiles} />}>
                <FingersGridView grid={physical.fingers} metric={metric} quartiles={gridQuartiles} p5={p5} />
            </Section>
            <Section title="Thumbs" suffix={inferred}>
                <ThumbsView rows={physical.thumbs} metric={metric} quartiles={gridQuartiles} p5={p5}
                    actionOf={(index) => thumbAction(board, session.resolution, index, defaultLayer, session.keymap.layoutId)} />
            </Section>
            <Section title="Layers" suffix={inferred}>
                <div className={`${CARD} p-2`}>
                    {physical.layers.length ? <LayersTable rows={physical.layers} board={board} p5={p5} /> : <p className="p-2 text-sm text-muted-foreground">No lessons in this period</p>}
                </div>
            </Section>
            <Section title="Characters">
                <div className={`${CARD} p-2`}>
                    <CharTable rows={view.characters} p5={p5} />
                </div>
            </Section>
            <Section title="History">
                <div className={`${CARD} p-2`}>
                    {view.records.length ? <HistoryTable records={view.records} board={board} unit={unit} /> : <p className="p-2 text-sm text-muted-foreground">No lessons in this period</p>}
                </div>
            </Section>
        </div>
    );
}
