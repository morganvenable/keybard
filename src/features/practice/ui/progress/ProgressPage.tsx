import { useCallback, useMemo, type ReactNode } from "react";

import { Notice } from "@/components/shared/Notice";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { PILL_BRAND, PILL_INK } from "@/components/shared/pills";
import { usePanels } from "@/contexts/PanelsContext";
import { PAGE_FRAME } from "../../PracticeWorkspace";
import { PracticeHeader } from "../../PracticeHeader";
import { usePractice } from "../../PracticeProvider";
import { NOTICE_TEXT } from "../../state/controller";
import { chartPoints, periodLabel, periodView } from "../../state/progressView";
import { formatDuration, formatSpeed, layerColorName } from "../format";
import { StatCell } from "../StatCell";
import { Well } from "../Wells";
import { CharTable } from "./CharTable";
import { SpeedChart } from "./SpeedChart";

// G1 Progress (docs/practice/spec.md §5.8), as M1b ships it: Summary, Speed and Characters for the active
// profile in the chosen period (set in the Progress panel and echoed in the header).
// TODO(practice): M4 adds the Keyboard heatmap, Fingers, Thumbs, Layers and History sections.

function Section({ title, children, tools }: { title: string; children: ReactNode; tools?: ReactNode }) {
    const id = `progress-${title.toLowerCase()}`;
    return (
        <section aria-labelledby={id} className="flex flex-col gap-3" data-progress-section={title}>
            <div className="flex flex-wrap items-center gap-3">
                <h2 id={id} className="text-lg font-semibold text-kb-ink">{title}</h2>
                {tools && <div className="ml-auto flex items-center gap-2">{tools}</div>}
            </div>
            {children}
        </section>
    );
}

export default function ProgressPage({ active = true }: { active?: boolean }) {
    const controller = usePractice();
    const { setPracticePage } = usePanels();
    const session = controller?.session ?? null;
    const settings = controller?.settings;
    const period = settings?.period ?? "30";
    const records = session?.records;
    const count = records?.length ?? 0;

    const view = useMemo(() => {
        if (!session) return null;
        // Every character the keymap types: the language letters always, the others once practiced (M3).
        return periodView(session.lesson, session.records, session.target, (c) => session.resolution.primary(c), period, Date.now(), {
            tracked: session.trackedLetters,
            always: new Set(session.languageLetters.map((l) => l.codePoint)),
        });
        // A new lesson appends to the same records array, so its length is part of the key.
    }, [session, period, count]);

    const layerColorOf = useCallback((codePoint: number) => {
        const path = session?.resolution.primary(codePoint);
        return layerColorName(controller?.keymap?.board ?? session?.keymap.board, path?.layer ?? 0);
    }, [session, controller?.keymap?.board]);

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

    if (!controller || !session || !view || !settings) {
        return (
            <div className={PAGE_FRAME} data-practice-page="progress" data-active={active}>
                {header}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => <StatCell key={i} label="" value="" skeleton />)}
                </div>
                <div className="h-[240px] rounded-xl bg-muted motion-safe:animate-pulse" aria-hidden="true" />
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
                <div className="bg-kb-surface rounded-2xl border border-gray-200 dark:border-neutral-700 p-4">
                    {points.length ? (
                        <SpeedChart points={points} unit={unit} target={settings.targetSpeed} axis={settings.chartAxis} />
                    ) : (
                        <p className="text-sm text-muted-foreground">No lessons in this period</p>
                    )}
                </div>
            </Section>
            <Section title="Characters">
                <div className="bg-kb-surface rounded-2xl border border-gray-200 dark:border-neutral-700 p-2">
                    <CharTable rows={view.characters} resolution={session.resolution} cols={session.keymap.board.cols} unit={unit} layerColorOf={layerColorOf} />
                </div>
            </Section>
        </div>
    );
}
