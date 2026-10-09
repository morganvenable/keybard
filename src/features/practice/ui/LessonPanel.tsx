import { useEffect, useRef } from "react";

import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { LAYOUTS } from "@/components/Keyboards/layouts";
import OnOffToggle from "@/components/ui/OnOffToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePanels } from "@/contexts/PanelsContext";
import { cn } from "@/lib/utils";
import { usePractice } from "../PracticeProvider";
import type { PracticeController } from "../state/controller";
import type { Hints, PracticeSettings } from "../state/settings";
import { InputDot, inputPillState, PILL_TEXT } from "./InputStatus";
import { AboutRow, ClickRow, GroupLabel, PanelFooter, Row, SliderRow } from "./panelRows";

// P3 Lesson panel (docs/practice/spec.md §5.5), the detail panel content while the Lessons page shows.
// The current type's section first (Guided until M3), then Targets, Typing, Board, Input, Keymap and
// About. Lesson-shaping changes regenerate the lesson (sliders after 300 ms); display settings apply at
// once and keep it. Esc closes the panel (SecondarySidebar, useWorkspacePanelEscape).

const HINTS: { value: Hints; label: string }[] = [
    { value: "next-cluster", label: "Next key + cluster" },
    { value: "next", label: "Next key" },
    { value: "off", label: "Off" },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function LessonPanel({ horizontal = false }: { horizontal?: boolean }) {
    const controller = usePractice();
    if (!controller) return null;
    return <LessonRows controller={controller} horizontal={horizontal} />;
}

function LessonRows({ controller: c, horizontal }: { controller: PracticeController; horizontal: boolean }) {
    const { setActivePanel } = usePanels();
    const root = useRef<HTMLDivElement | null>(null);
    const s = c.settings;
    const set = (patch: Partial<PracticeSettings>) => c.update(patch);
    const slide = (patch: Partial<PracticeSettings>) => c.update(patch, { debounce: true });
    const wpm = s.speedUnit === "wpm";
    const pill = inputPillState(c);

    // The type row's scope button opens the panel at the current type's section (§5.2).
    const section = c.panelSection;
    useEffect(() => {
        if (!section) return;
        const target = root.current?.querySelector(`[data-lesson-section="${c.takePanelSection()}"]`);
        target?.scrollIntoView?.({ block: "start" });
    }, [section, c]);

    const group = horizontal ? "grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-x-4 items-start" : "flex flex-col";
    return (
        <div ref={root} data-practice-panel="lessons" className="flex flex-col pb-2">
            <section aria-labelledby="lesson-guided" data-lesson-section="guided">
                <GroupLabel id="lesson-guided">Guided</GroupLabel>
                <div className={group}>
                    <Row title="Start order">
                        <SegmentedControl label="Start order" value={s.order} onChange={(order) => set({ order })}
                            options={[{ value: "center-first", label: "Center first" }, { value: "frequency", label: "Frequency" }]} />
                    </Row>
                    <SliderRow title="Included letters" display={pct(s.alphabetSize)} value={Math.round(s.alphabetSize * 100)} min={0} max={100}
                        onChange={(v) => slide({ alphabetSize: v / 100 })} />
                    <Row title="Real words"><OnOffToggle label="Real words" value={s.naturalWords} onToggle={(naturalWords) => set({ naturalWords })} /></Row>
                    <Row title="Re-check slow keys"><OnOffToggle label="Re-check slow keys" value={s.recoverKeys} onToggle={(recoverKeys) => set({ recoverKeys })} /></Row>
                    <SliderRow title="Capitals" display={pct(s.capitals)} value={Math.round(s.capitals * 100)} min={0} max={100} onChange={(v) => slide({ capitals: v / 100 })} />
                    <SliderRow title="Punctuation" display={pct(s.punctuators)} value={Math.round(s.punctuators * 100)} min={0} max={100} onChange={(v) => slide({ punctuators: v / 100 })} />
                </div>
            </section>
            <section aria-labelledby="lesson-targets" data-lesson-section="targets">
                <GroupLabel id="lesson-targets">Targets</GroupLabel>
                <div className={group}>
                    <SliderRow
                        title="Target speed"
                        display={wpm ? `${Math.round(s.targetSpeed / 5)} wpm` : `${s.targetSpeed} cpm`}
                        value={wpm ? Math.round(s.targetSpeed / 5) : s.targetSpeed}
                        min={wpm ? 15 : 75}
                        max={wpm ? 150 : 750}
                        step={wpm ? 1 : 5}
                        onChange={(v) => slide({ targetSpeed: wpm ? v * 5 : v })}
                    />
                    <Row title="Speed unit">
                        <SegmentedControl label="Speed unit" value={s.speedUnit} onChange={(speedUnit) => set({ speedUnit })}
                            options={[{ value: "wpm", label: "WPM" }, { value: "cpm", label: "CPM" }]} />
                    </Row>
                    <SliderRow title="Lesson length" display={pct(s.length)} value={Math.round(s.length * 100)} min={0} max={100} onChange={(v) => slide({ length: v / 100 })} />
                    <SliderRow title="Daily goal" display={s.dailyGoal ? `${s.dailyGoal} min` : "Off"} value={s.dailyGoal} min={0} max={120} step={5} onChange={(dailyGoal) => set({ dailyGoal })} />
                </div>
            </section>
            <section aria-labelledby="lesson-typing" data-lesson-section="typing">
                <GroupLabel id="lesson-typing">Typing</GroupLabel>
                <div className={group}>
                    <Row title="Stop on error"><OnOffToggle label="Stop on error" value={s.stopOnError} onToggle={(stopOnError) => set({ stopOnError })} /></Row>
                    <Row title="Forgive errors"><OnOffToggle label="Forgive errors" value={s.forgiveErrors} onToggle={(forgiveErrors) => set({ forgiveErrors })} /></Row>
                    <Row title="Show spaces"><OnOffToggle label="Show spaces" value={s.showSpaces} onToggle={(showSpaces) => set({ showSpaces })} /></Row>
                    <Row title="Layer underlines"><OnOffToggle label="Layer underlines" value={s.layerUnderlines} onToggle={(layerUnderlines) => set({ layerUnderlines })} /></Row>
                    <Row title="Announce next key"><OnOffToggle label="Announce next key" value={s.announceNextKey} onToggle={(announceNextKey) => set({ announceNextKey })} /></Row>
                </div>
            </section>
            <section aria-labelledby="lesson-board" data-lesson-section="board">
                <GroupLabel id="lesson-board">Board</GroupLabel>
                <div className={group}>
                    <Row title="Hints"><SegmentedControl label="Hints" value={s.hints} onChange={(hints) => set({ hints })} options={HINTS} /></Row>
                    <Row title="Legends">
                        <SegmentedControl label="Legends" value={s.legends ? "show" : "hide"} onChange={(v) => set({ legends: v === "show" })}
                            options={[{ value: "show", label: "Show" }, { value: "hide", label: "Hide" }]} />
                    </Row>
                    <Row title="Board">
                        <SegmentedControl label="Board" value={s.showBoard ? "show" : "hide"} onChange={(v) => set({ showBoard: v === "show" })}
                            options={[{ value: "show", label: "Show" }, { value: "hide", label: "Hide" }]} />
                    </Row>
                </div>
            </section>
            <section aria-labelledby="lesson-input" data-lesson-section="input">
                <GroupLabel id="lesson-input">Input</GroupLabel>
                <div className={group}>
                    <Row title="Input">
                        <span className="flex items-center gap-2 text-sm" data-lesson-input={pill}><InputDot state={pill} />{PILL_TEXT[pill]}</span>
                    </Row>
                    <Row title="Read key presses"><OnOffToggle label="Read key presses" value={s.readKeyPresses} onToggle={(readKeyPresses) => set({ readKeyPresses })} /></Row>
                </div>
            </section>
            <section aria-labelledby="lesson-keymap" data-lesson-section="keymap">
                <GroupLabel id="lesson-keymap">Keymap</GroupLabel>
                <div className={group}>
                    <Row title="Source" titleId="lesson-keymap-source" value={c.keymap?.sourceLabel && c.keymap.source !== "example" ? c.keymap.sourceLabel : undefined}>
                        {/* Only the sources that exist: Keybard edits one target at a time (§5.4). */}
                        <Select value="current">
                            <SelectTrigger aria-labelledby="lesson-keymap-source" className="min-w-40 max-w-full bg-kb-surface"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="current">{c.sourceName}</SelectItem></SelectContent>
                        </Select>
                    </Row>
                    <ClickRow title="OS layout" value={LAYOUTS[c.keymap?.layoutId ?? "us"]?.label ?? c.keymap?.layoutId} onClick={() => setActivePanel("settings")} />
                </div>
            </section>
            <section aria-labelledby="lesson-about" className={cn(horizontal && "max-w-md")}>
                <GroupLabel id="lesson-about">About</GroupLabel>
                <AboutRow />
            </section>
            <PanelFooter saving={c.saving} error={c.settingsError} />
        </div>
    );
}
