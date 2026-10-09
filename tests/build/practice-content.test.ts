// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundledLayersPlugin } from '../../build/paranoid';

const root = resolve(__dirname, '../..');
const MODEL = resolve(root, 'src/features/practice/content/assets/model-en.data');

describe('virtual:practice-content (docs/practice/spec.md §7.5)', () => {
    const load = (paranoid: boolean) => {
        const plugin = bundledLayersPlugin(paranoid, root) as unknown as { resolveId: (id: string) => string; load: (id: string) => string };
        return plugin.load(plugin.resolveId('virtual:practice-content'));
    };

    it('is null outside Paranoid', () => {
        expect(load(false)).toBe('export default null;');
    });

    it('inlines the model as base64 and the word list as JSON in Paranoid', () => {
        const json = load(true).replace(/^export default /, '').replace(/;$/, '');
        const value = JSON.parse(json) as { model: string; words: string[] };
        expect(value.words.length).toBeGreaterThan(9000);
        expect(Buffer.from(value.model, 'base64').equals(readFileSync(MODEL))).toBe(true);
    });
});
