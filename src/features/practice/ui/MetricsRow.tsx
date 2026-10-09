import type { LastLessonMetrics } from "../state/session";
import type { SpeedUnit } from "../state/settings";
import { formatSpeed, speedValue } from "./format";
import { StatCell, TodayRing } from "./StatCell";

// Metrics row (docs/practice/spec.md §5.2): the last completed lesson's speed, accuracy and score with
// deltas against the previous 10 lessons, the keys in the lesson, and today's minutes against the daily
// goal. Container widths wrap it 3 + 2 under 900 px and 2 + 2 + 1 under 480 px.

interface MetricsRowProps {
    last: LastLessonMetrics | null;
    unit: SpeedUnit;
    /** Keys in the lesson; Drill: keys at target out of the scope, labelled At target (§5.2). */
    keys: { included: number; alphabet: number; label?: string };
    today: { minutes: number; goal: number };
    /** A lesson just completed: deltas fade in. */
    fresh?: boolean;
    skeleton?: boolean;
}

const score = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function MetricsRow({ last, unit, keys, today, fresh = false, skeleton = false }: MetricsRowProps) {
    const minutes = Math.floor(today.minutes);
    return (
        <div className="@container" data-practice-metrics>
            <div className="grid grid-cols-2 @min-[480px]:grid-cols-3 @min-[900px]:grid-cols-5 gap-4">
                <StatCell label="Speed" skeleton={skeleton} value={formatSpeed(last?.speed, unit)} unit={unit}
                    delta={last?.deltas ? speedValue(last.deltas.speed, unit) : null} formatDelta={(v) => (unit === "wpm" ? v.toFixed(1) : String(Math.round(v)))} fresh={fresh} />
                <StatCell label="Accuracy" skeleton={skeleton} value={last ? (last.accuracy * 100).toFixed(1) : "—"} unit="%"
                    delta={last?.deltas ? last.deltas.accuracy * 100 : null} fresh={fresh} />
                <StatCell label="Score" skeleton={skeleton} value={last ? score.format(last.score) : "—"}
                    delta={last?.deltas ? last.deltas.score : null} formatDelta={(v) => score.format(v)} fresh={fresh} />
                <StatCell label={keys.label ?? "Keys"} skeleton={skeleton} value={keys.included} unit={`/ ${keys.alphabet}`} />
                <StatCell label="Today" skeleton={skeleton} lead={<TodayRing fraction={today.goal > 0 ? today.minutes / today.goal : 0} />}
                    value={minutes} unit={today.goal > 0 ? `/ ${today.goal} min` : "min"} />
            </div>
        </div>
    );
}

export default MetricsRow;
