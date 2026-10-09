import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Overlay ships no chrome colors outside Tailwind tokens (docs/practice/spec.md §5.0, §12 MO acceptance):
// trainer.css is gone, overlay-surface.css holds only the surface's layout and fade, and the Overlay .tsx
// files hold no color literals (the desktop stand-in backgrounds are data in preview-backgrounds.ts).

const DIR = resolve(process.cwd(), 'src/features/trainer');
const COLOR = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|color-mix)\(|\b(?:white|black|transparent)\b(?!-)/i;

describe('Overlay styles', () => {
    it('keeps one stylesheet, overlay-surface.css, with no colors', () => {
        const sheets = readdirSync(DIR).filter(f => f.endsWith('.css'));
        expect(sheets).toEqual(['overlay-surface.css']);
        const css = readFileSync(join(DIR, 'overlay-surface.css'), 'utf-8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // The Host window must stay see-through; that is not a color choice.
            .replace(/background:transparent/g, '');
        expect(css).not.toMatch(COLOR);
    });

    it('has no color literals in the Overlay components', () => {
        for (const file of readdirSync(DIR).filter(f => f.endsWith('.tsx'))) {
            const source = readFileSync(join(DIR, file), 'utf-8');
            expect(source.match(/['"`]#[\da-f]{3,8}['"`]/gi) ?? [], file).toEqual([]);
        }
    });

    it('no longer has TrainerPage or trainer.css', () => {
        expect(readdirSync(DIR)).not.toContain('TrainerPage.tsx');
        expect(readdirSync(DIR)).not.toContain('trainer.css');
    });
});
