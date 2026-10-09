import { useState } from "react";
import { Dumbbell, Hash, Layers, Target, Type, type LucideIcon } from "lucide-react";

import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { ToggleChipGroup } from "@/components/shared/ToggleChipGroup";
import OnOffToggle from "@/components/ui/OnOffToggle";
import { cn } from "@/lib/utils";
import { boardGeometry } from "../keymap/geometry";
import { drillGroupLabel, hasDoubleSouth, MIN_DRILL_SCOPE } from "../lessons/scope";
import type { PracticeController } from "../state/controller";
import {
    DRILL_DIRECTIONS, DRILL_GROUPS, type DrillDirection, type DrillGroup, type DrillHands, effectiveLessonType, WORD_LIST_MAX, WORD_LIST_MIN,
} from "../state/settings";
import type { LessonType } from "../types";
import { CharCap } from "./CharCap";
import { CustomTextDialog } from "./CustomTextDialog";
import { layerColorHex, layerColorName, layerName } from "./format";
import { ClickRow, GroupLabel, Row, SliderRow } from "./panelRows";

// The current lesson type's section of the Lesson panel (docs/practice/spec.md §5.5): Guided's rows stay in
// LessonPanel; this file holds Drill (layer pills, group tiles, direction chips, hands, thumbs, Benford and
// the In scope row), Words (word list size, long words only) and Custom (the text row that opens P6, and
// Lowercase, Letters only, Randomize).

const GROUP_ICONS: Record<DrillGroup, LucideIcon> = { all: Layers, letters: Type, numbers: Hash, symbols: Dumbbell, weakest: Target };
const DIRECTION_NAMES: Record<DrillDirection, string> = { C: "Center", N: "North", S: "South", E: "East", W: "West", "2S": "Double south" };
/** In scope shows this many caps, then `+ n` (§5.5). */
const SCOPE_CAPS = 12;

const LAYER_PILL = "inline-flex items-center gap-1.5 px-4 py-1 rounded-full transition-colors text-sm font-medium cursor-pointer border-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap";
const LAYER_PILL_ON = "bg-gray-800 text-white dark:bg-neutral-200 dark:text-neutral-900 shadow-md scale-105";
const LAYER_PILL_OFF = "bg-transparent text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700";

/** The directions a board offers: 2S only when some finger uses a 6-key cluster (§5.5). */
export function boardDirections(controller: PracticeController): DrillDirection[] {
    const board = controller.session?.keymap.board ?? controller.keymap?.board;
    const double = board ? hasDoubleSouth(boardGeometry(board)) : false;
    return DRILL_DIRECTIONS.filter((d) => d !== "2S" || double);
}

interface SectionProps {
    controller: PracticeController;
    group: string;
}

export function TypeSection({ controller, group, type }: SectionProps & { type: LessonType }) {
    switch (effectiveLessonType(type)) {
        case "drill":
            return <DrillSection controller={controller} group={group} />;
        case "words":
            return <WordsSection controller={controller} group={group} />;
        case "custom":
            return <CustomSection controller={controller} group={group} />;
        default:
            return null;
    }
}

function DrillSection({ controller: c, group }: SectionProps) {
    const d = c.settings.drill;
    const board = c.keymap?.board ?? c.session?.keymap.board;
    const resolution = c.session?.resolution ?? null;
    const layers = resolution ? [...resolution.layers.keys()].sort((a, b) => a - b) : [0];
    const directions = boardDirections(c);
    const keysMode = !!d.keys;
    // The scope as the session runs it (it follows the settings once rebuilt).
    const scope = c.session?.type === "drill" ? c.session.lessonKeys.findIncludedKeys().map((k) => k.letter.codePoint) : [];
    const pill = (value: number | null, label: string, color: string | null) => {
        const on = !keysMode && d.layer === value;
        return (
            <button key={label} type="button" aria-pressed={on} onClick={() => c.updateDrill({ layer: value })} className={cn(LAYER_PILL, on ? LAYER_PILL_ON : LAYER_PILL_OFF)}>
                {color && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
                {label}
            </button>
        );
    };
    return (
        <section aria-labelledby="lesson-drill" data-lesson-section="drill">
            <GroupLabel id="lesson-drill">Drill</GroupLabel>
            <div className={group}>
                <div className="flex flex-col gap-3 p-3 panel-layer-item">
                    <span id="lesson-drill-layer" className="text-md">Layer</span>
                    <div role="group" aria-labelledby="lesson-drill-layer" className="flex flex-wrap items-center gap-2">
                        {layers.map((layer) => pill(layer, layerName(board, layer), layerColorHex(board, layer)))}
                        {pill(null, "All", null)}
                    </div>
                </div>
                <div className="flex flex-col gap-3 p-3 panel-layer-item">
                    <span id="lesson-drill-group" className="text-md">Group</span>
                    <div role="group" aria-labelledby="lesson-drill-group" className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {DRILL_GROUPS.map((g) => {
                            const Icon = GROUP_ICONS[g];
                            const on = !keysMode && d.group === g;
                            return (
                                <button
                                    key={g}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => c.updateDrill({ group: g })}
                                    className={cn(
                                        "min-w-0 flex items-center gap-2 flex-col cursor-pointer py-3 px-1 rounded-lg transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                                        on ? "bg-kb-active text-kb-active-fg hover:bg-kb-active/80 hover:text-kb-active-fg" : "text-muted-foreground hover:bg-muted bg-muted/60",
                                    )}
                                >
                                    <Icon aria-hidden="true" className="h-4 w-4" />
                                    <span className="text-xs font-medium text-center break-words">{drillGroupLabel(g)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <Row title="Directions">
                    <ToggleChipGroup
                        label="Directions"
                        value={keysMode ? [] : d.dirs.filter((x) => directions.includes(x))}
                        onChange={(dirs) => c.updateDrill({ dirs: [...dirs, ...d.dirs.filter((x) => !directions.includes(x))] })}
                        options={directions.map((x) => ({ value: x, label: x, ariaLabel: DIRECTION_NAMES[x] }))}
                    />
                </Row>
                <Row title="Hands">
                    <SegmentedControl<DrillHands> label="Hands" value={d.hands} onChange={(hands) => c.updateDrill({ hands })}
                        options={[{ value: "both", label: "Both" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
                </Row>
                <Row title="Thumbs"><OnOffToggle label="Thumbs" value={d.thumbs} onToggle={(thumbs) => c.updateDrill({ thumbs })} /></Row>
                {d.group === "numbers" && !keysMode && (
                    <Row title="Number format">
                        <OnOffToggle label="Benford" value={d.benford} onToggle={(benford) => c.updateDrill({ benford })} />
                    </Row>
                )}
                <InScopeRow scope={scope} layerColorOf={(cp) => layerColorName(board, resolution?.primary(cp)?.layer ?? 0)} />
            </div>
        </section>
    );
}

function InScopeRow({ scope, layerColorOf }: { scope: number[]; layerColorOf: (codePoint: number) => string }) {
    const few = scope.length < MIN_DRILL_SCOPE;
    return (
        <Row
            title="In scope"
            value={few ? <span className="text-red-700 dark:text-red-400" data-drill-too-few>Too few characters ({scope.length} of {MIN_DRILL_SCOPE})</span> : undefined}
        >
            <span className="flex flex-wrap items-center gap-1" data-drill-in-scope={scope.length}>
                {scope.slice(0, SCOPE_CAPS).map((cp) => <CharCap key={cp} codePoint={cp} layerColor={layerColorOf(cp)} />)}
                {scope.length > SCOPE_CAPS && <span className="text-xs text-muted-foreground whitespace-nowrap">+ {scope.length - SCOPE_CAPS}</span>}
                <span className="ml-1.5 text-sm tabular-nums text-muted-foreground">{scope.length}</span>
            </span>
        </Row>
    );
}

function WordsSection({ controller: c, group }: SectionProps) {
    const w = c.settings.words;
    return (
        <section aria-labelledby="lesson-words" data-lesson-section="words">
            <GroupLabel id="lesson-words">Words</GroupLabel>
            <div className={group}>
                <SliderRow title="Word list size" display={String(w.size)} value={w.size} min={WORD_LIST_MIN} max={WORD_LIST_MAX} step={10}
                    onChange={(size) => c.update({ words: { ...w, size } }, { debounce: true })} />
                <Row title="Long words only"><OnOffToggle label="Long words only" value={w.longOnly} onToggle={(longOnly) => c.update({ words: { ...w, longOnly } })} /></Row>
            </div>
        </section>
    );
}

/** The first `n` characters of a text on one line, as the Text row and the scope button show it. */
export function textPreview(text: string, n: number): string {
    const line = text.replace(/\s+/g, " ").trim();
    const chars = [...line];
    return chars.length > n ? `${chars.slice(0, n).join("")}…` : line;
}

function CustomSection({ controller: c, group }: SectionProps) {
    const t = c.settings.customText;
    const [editing, setEditing] = useState(false);
    const set = (patch: Partial<typeof t>) => c.update({ customText: { ...t, ...patch } });
    return (
        <section aria-labelledby="lesson-custom" data-lesson-section="custom">
            <GroupLabel id="lesson-custom">Custom</GroupLabel>
            <div className={group}>
                <ClickRow title="Text" value={textPreview(t.content, 40) || "Empty"} onClick={() => setEditing(true)} />
                <Row title="Lowercase"><OnOffToggle label="Lowercase" value={t.lowercase} onToggle={(lowercase) => set({ lowercase })} /></Row>
                <Row title="Letters only"><OnOffToggle label="Letters only" value={t.lettersOnly} onToggle={(lettersOnly) => set({ lettersOnly })} /></Row>
                <Row title="Randomize"><OnOffToggle label="Randomize" value={t.randomize} onToggle={(randomize) => set({ randomize })} /></Row>
            </div>
            <CustomTextDialog open={editing} onOpenChange={setEditing} text={t.content} resolution={c.session?.resolution ?? null}
                onUse={(content) => set({ content })} />
        </section>
    );
}
