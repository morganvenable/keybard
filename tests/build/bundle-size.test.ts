// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type BundleStats, statsFile } from '../../build/bundle-stats';

// Practice's bundle budgets (docs/practice/spec.md §9.8). The numbers come from the last `vite build`
// (build/bundle-stats.ts), so this check is skipped until a build has run: `npm run check:bundle`
// builds both outputs and runs it, as the test workflow does.

const root = resolve(__dirname, '../..');
const KB = 1024;
const read = (mode: string): BundleStats | null => {
    const file = statsFile(root, mode);
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as BundleStats) : null;
};

const production = read('production');
const paranoid = read('paranoid');

describe.skipIf(!production)('Practice bundle budgets, production build (§9.8)', () => {
    it('adds at most 3 KB gzip to the editor\'s initial chunk', () => {
        expect(production!.practiceInEntry).toBeLessThanOrEqual(3 * KB);
    });

    it('keeps the practice lazy chunks (engine + UI) within 130 KB gzip', () => {
        expect(production!.practiceLazy).toBeGreaterThan(0);
        expect(production!.practiceLazy).toBeLessThanOrEqual(130 * KB);
    });

    it('keeps the English content within 75 KB gzip, out of the entry chunk', () => {
        expect(production!.contentEn).toBeGreaterThan(50 * KB);
        expect(production!.contentEn).toBeLessThanOrEqual(75 * KB);
        expect(production!.chunks.filter((c) => c.entry && c.content)).toEqual([]);
    });
});

describe.skipIf(!paranoid)('Practice bundle budget, Paranoid file (§9.8)', () => {
    it('grows the single file by at most 550 KB uncompressed', () => {
        expect(paranoid!.practiceRaw).toBeGreaterThan(0);
        expect(paranoid!.practiceRaw).toBeLessThanOrEqual(550 * KB);
    });
});
