import { ArrowRightLeft, Sprout, Target, type LucideIcon } from "lucide-react";

import { PILL_BRAND } from "@/components/shared/pills";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { START_PRESETS, type StartPreset } from "../state/settings";

// P2 Start (docs/practice/spec.md §5.4): shown once per profile. Three goal tiles on a floating card, the
// keymap source and the target speed, and the brand-green Start pill, the screen's only green action.
// The board below previews the first lesson (LessonsPage draws it).

export const START_TILES: { preset: StartPreset; title: string; icon: LucideIcon }[] = [
    { preset: "learn", title: "Learn from the center keys", icon: Sprout },
    { preset: "qwerty", title: "Coming from QWERTY", icon: ArrowRightLeft },
    { preset: "drill", title: "Drill my keymap", icon: Target },
];

/** The preset's target speed in WPM (keybr stores CPM). */
export const presetWpm = (preset: StartPreset) => START_PRESETS[preset].targetSpeed / 5;

interface StartViewProps {
    preset: StartPreset | null;
    onPreset: (preset: StartPreset) => void;
    /** Target speed, WPM (15–150). */
    targetWpm: number;
    onTarget: (wpm: number) => void;
    sourceName: string;
    onStart: () => void;
}

export function StartView({ preset, onPreset, targetWpm, onTarget, sourceName, onStart }: StartViewProps) {
    return (
        <section aria-labelledby="practice-start-title" className="w-full max-w-3xl mx-auto bg-kb-surface rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-6 flex flex-col gap-6" data-practice-start>
            <h2 id="practice-start-title" className="text-[22px] font-semibold leading-none text-kb-ink">Start practicing</h2>
            <div role="group" aria-label="Goal" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {START_TILES.map(({ preset: id, title, icon: Icon }) => (
                    <button
                        type="button"
                        key={id}
                        aria-pressed={preset === id}
                        onClick={() => onPreset(id)}
                        className={cn(
                            "flex flex-col items-center gap-2 py-5 px-3 rounded-lg cursor-pointer transition-all text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                            preset === id ? "bg-kb-active text-kb-active-fg hover:bg-kb-active/80" : "text-muted-foreground hover:bg-muted bg-muted/60",
                        )}
                    >
                        <Icon aria-hidden="true" className="h-5 w-5" />
                        <span className="text-sm font-medium">{title}</span>
                    </button>
                ))}
            </div>
            <div className="flex flex-col">
                <div className="flex flex-row flex-wrap items-center justify-between p-3 gap-3 panel-layer-item">
                    <span id="practice-start-keymap" className="text-md">Keymap</span>
                    <Select value="current">
                        <SelectTrigger aria-labelledby="practice-start-keymap" className="min-w-44 max-w-full bg-kb-surface"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="current">{sourceName}</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-3 p-3 panel-layer-item">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-md">Target speed</span>
                        <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">{targetWpm} wpm</span>
                    </div>
                    <Slider aria-label="Target speed" value={[targetWpm]} min={15} max={150} step={1} onValueChange={([v]) => onTarget(v)} />
                </div>
            </div>
            <div className="flex justify-end">
                <button type="button" className={cn(PILL_BRAND, "disabled:opacity-50 disabled:cursor-not-allowed")} disabled={!preset} onClick={onStart}>
                    Start
                </button>
            </div>
        </section>
    );
}

export default StartView;
