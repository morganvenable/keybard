import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { englishModelFromBase64, loadEnglishModel, loadEnglishWords } from '@/features/practice/content/loader';
import { bytesToBase64 } from '@/features/practice/store/base64';
import { Language } from '@/features/practice/vendor/keybr/keyboard/index.ts';

const MODEL = resolve(__dirname, '../../../src/features/practice/content/assets/model-en.data');

describe('English content loader (§7.1, §7.5)', () => {
    it('fetches the model from its Vite asset URL', async () => {
        const urls: string[] = [];
        const model = await loadEnglishModel(async (input) => {
            urls.push(String(input));
            return new Response(readFileSync(MODEL));
        });
        expect(urls).toHaveLength(1);
        expect(urls[0]).toMatch(/model-en\.data/);
        expect(model.language).toBe(Language.EN);
        expect(model.letters.length).toBeGreaterThanOrEqual(26);
    });

    it('reports a failed fetch', async () => {
        await expect(loadEnglishModel(async () => new Response(null, { status: 404 }))).rejects.toThrow(/404/);
    });

    it('builds the same model from the base64 form Paranoid will inline', () => {
        const model = englishModelFromBase64(bytesToBase64(new Uint8Array(readFileSync(MODEL))));
        expect(model.letters.map((l) => l.codePoint)).toContain(0x65);
    });

    it('loads the English word list as a lazy chunk', async () => {
        const words = await loadEnglishWords();
        expect(words.length).toBeGreaterThan(9000);
        expect(words[0]).toBe('the');
    });
});

describe('Paranoid content (§7.5)', () => {
    it('builds the model and word list from the inlined module', async () => {
        const { inlinedContent } = await import('@/features/practice/content/loader');
        expect(inlinedContent(null)).toBeNull();
        const content = inlinedContent({ model: bytesToBase64(new Uint8Array(readFileSync(MODEL))), words: ['the', 'of'] });
        expect(content?.words).toEqual(['the', 'of']);
        expect(content?.model.language).toBe(Language.EN);
    });

});
