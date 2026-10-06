// @vitest-environment node
import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, lockDown } from '../../build/paranoid';

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('base64');
const page = (body: string) => `<!doctype html>\r\n<html lang="en"><head><meta charset="UTF-8" />\r\n<script>\r\nwindow.a = 1;\r\n</script></head><body>${body}<script type="module">console.log(2)</script></body></html>`;

describe('Keybard Paranoid lockdown', () => {
    it('adds a no-network policy right after the charset, hashing scripts as browsers see them (LF)', () => {
        const out = lockDown(page(''));
        expect(out).not.toContain('\r');
        const meta = out.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
        expect(meta).not.toBeNull();
        expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<script'));
        expect(meta![1]).toContain(`'sha256-${sha('\nwindow.a = 1;\n')}'`);
        expect(meta![1]).toContain(`'sha256-${sha('console.log(2)')}'`);
        expect(meta![1]).toContain("default-src 'none'");
        expect(meta![1]).not.toMatch(/unsafe-eval|https?:/);
    });

    it('refuses pages that still load anything from elsewhere', () => {
        for (const bad of ['<script src="https://cdn.example/x.js"></script>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2">', '<img src="/favicon.png">', '<link rel="icon" href="/favicon.png">']) {
            expect(() => lockDown(page(bad))).toThrow(/external resources/);
        }
        expect(() => lockDown(page('<img src="data:image/png;base64,AA==">'))).not.toThrow();
    });

    it('only lets the page reach itself (the Keybard Host that serves it) or embedded data', () => {
        const policy = contentSecurityPolicy(['x']);
        expect(policy).toMatch(/connect-src 'self' data: blob:;/);
        expect(policy).toMatch(/form-action 'none'/);
        expect(policy).toMatch(/base-uri 'none'/);
    });
});
