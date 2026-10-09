// The M0 measurement lab's numbers (spec §12 M0, §9.3): what the owner measures on the Mule before the
// correlator's ε and the sample-rate target are fixed. Pure, so the summaries are tested without a board.
//
// For each typed character the lab keeps the DOM times (keydown and input) and the correlator's
// attribution, and from them:
//   - samples/s and the request round trip (p50, p95), from the sampler;
//   - DOM-to-edge skew: matched press edge − input event, ms (its distribution sets ε);
//   - taps caught: observed / typed characters (the §12 M2 bar is 95 %);
//   - LT rolls: characters reached under a tap-hold layer key, with the time from the target key's
//     release to the input (permissive hold types on release, §6.7) and from its press;
//   - debounced vs raw: press edge − keydown. A matrix read after debouncing can't show a press before
//     the keyboard reported it, so edges whose whole uncertainty lies before their keydown are
//     evidence of a raw (pre-debounce) read (§10);
//   - presses with no character: character-producing press edges no character used (dropped
//     keystrokes on the board while sampling, or genuine stray presses).
import type { Attribution } from './correlate';
import type { SamplerStats } from './usbSampler';

export interface LabStep {
    /** Code point typed. */
    typed: number;
    tInput: number;
    /** The keydown just before the input, if any. */
    tKeydown: number | null;
    attribution: Attribution;
    /** The target's press edge uncertainty (sample interval), ms. */
    edgeDt: number | null;
    /** A character reached under a tap-hold (LT) layer key: its target's release edge, if seen. */
    ltRelease: number | null;
    ltRoll: boolean;
}

export interface Distribution {
    n: number;
    min: number | null;
    p5: number | null;
    p50: number | null;
    p95: number | null;
    max: number | null;
}

export interface LabSummary {
    typed: number;
    observed: number;
    /** observed / typed, or null before anything is typed. */
    caught: number | null;
    rate: number;
    rttP50: number | null;
    rttP95: number | null;
    failures: number;
    skew: Distribution;
    /** Skew in 10 ms buckets: [bucket start, count]. */
    skewHistogram: [number, number][];
    ltRolls: number;
    ltReleaseToInput: Distribution;
    ltPressToInput: Distribution;
    edgeMinusKeydown: Distribution;
    /** Edges whose uncertainty interval lies wholly before the keydown. */
    edgesBeforeKeydown: number;
    strays: number;
}

export function distribution(values: readonly number[]): Distribution {
    if (!values.length) return { n: 0, min: null, p5: null, p50: null, p95: null, max: null };
    const sorted = [...values].sort((a, b) => a - b);
    const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    return { n: sorted.length, min: sorted[0], p5: at(0.05), p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] };
}

export function histogram(values: readonly number[], bucket = 10): [number, number][] {
    const counts = new Map<number, number>();
    for (const v of values) {
        const start = Math.floor(v / bucket) * bucket;
        counts.set(start, (counts.get(start) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => a[0] - b[0]);
}

export function summarizeLab(steps: readonly LabStep[], sampler: SamplerStats | null, strays: number): LabSummary {
    const observed = steps.filter((s) => s.attribution.confidence === 'observed');
    const skews = observed.map((s) => s.attribution.skew).filter((v): v is number => v != null);
    const rolls = observed.filter((s) => s.ltRoll);
    const edgeKeydown = observed.filter((s) => s.tKeydown != null && s.attribution.targetEdge != null && !s.attribution.delayed);
    return {
        typed: steps.length,
        observed: observed.length,
        caught: steps.length ? observed.length / steps.length : null,
        rate: sampler?.rate ?? 0,
        rttP50: sampler?.rttP50 ?? null,
        rttP95: sampler?.rttP95 ?? null,
        failures: sampler?.failures ?? 0,
        skew: distribution(skews),
        skewHistogram: histogram(skews),
        ltRolls: rolls.length,
        ltReleaseToInput: distribution(rolls.filter((s) => s.ltRelease != null).map((s) => s.tInput - s.ltRelease!)),
        ltPressToInput: distribution(rolls.map((s) => s.tInput - s.attribution.targetEdge!)),
        edgeMinusKeydown: distribution(edgeKeydown.map((s) => s.attribution.targetEdge! - s.tKeydown!)),
        edgesBeforeKeydown: edgeKeydown.filter((s) => s.attribution.targetEdge! < s.tKeydown!).length,
        strays,
    };
}

const ms = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)} ms`);
const dist = (d: Distribution) => (d.n ? `${ms(d.p50)} (p5 ${ms(d.p5)}, p95 ${ms(d.p95)}, n ${d.n})` : '—');

/** The numbers table for the PR (§12 M0 acceptance), as Markdown. */
export function labMarkdown(summary: LabSummary, meta: { board: string; keybard: string; date: string }): string {
    const pct = summary.caught == null ? '—' : `${(summary.caught * 100).toFixed(1)} % (${summary.observed} / ${summary.typed})`;
    const rows: [string, string][] = [
        ['Samples per second', String(summary.rate)],
        ['Round trip p50 / p95', `${ms(summary.rttP50)} / ${ms(summary.rttP95)}`],
        ['Failed reads', String(summary.failures)],
        ['Taps caught (observed)', pct],
        ['Skew, press edge − input', dist(summary.skew)],
        ['LT rolls', String(summary.ltRolls)],
        ['LT roll: target release → input', dist(summary.ltReleaseToInput)],
        ['LT roll: target press → input', dist(summary.ltPressToInput)],
        ['Press edge − keydown', dist(summary.edgeMinusKeydown)],
        ['Edges wholly before their keydown (raw-read evidence)', String(summary.edgesBeforeKeydown)],
        ['Presses with no character', String(summary.strays)],
    ];
    return [
        `M0 measurements · ${meta.board} · Keybard ${meta.keybard} · ${meta.date}`,
        '',
        '| Measure | Value |',
        '|---|---|',
        ...rows.map(([k, v]) => `| ${k} | ${v} |`),
        '',
        'Skew histogram (10 ms buckets): ' + (summary.skewHistogram.map(([start, n]) => `${start}: ${n}`).join(', ') || '—'),
    ].join('\n');
}
