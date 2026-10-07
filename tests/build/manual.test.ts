// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyManual, MANUAL_FILES } from '../../build/manual';

const source = path.resolve(__dirname, '../../docs/manual');
let out: string | null = null;
afterEach(() => { if (out) rmSync(out, { recursive: true, force: true }); out = null; });

describe('published user manual', () => {
    it('copies the reader-facing files into manual/, without the capture tools, evidence or README', () => {
        out = mkdtempSync(path.join(tmpdir(), 'keybard-manual-'));
        copyManual(source, out);
        for (const name of MANUAL_FILES) expect(existsSync(path.join(out, 'manual', name))).toBe(true);
        expect(existsSync(path.join(out, 'manual', 'assets', 'opening-drag.gif'))).toBe(true);
        for (const name of ['tools', 'evidence', 'README.md']) expect(existsSync(path.join(out, 'manual', name))).toBe(false);
    });

    it('only links to files that are published, so it works under any base path', () => {
        const html = readFileSync(path.join(source, 'index.html'), 'utf8');
        const local = [...html.matchAll(/(?:src|href)="([^"#]+)/g)].map((m) => m[1]).filter((u) => !/^(https?:|data:|mailto:)/.test(u));
        expect(local.length).toBeGreaterThan(10);
        for (const url of local) {
            expect(url.startsWith('/'), url).toBe(false);
            expect(MANUAL_FILES).toContain(url.split('?')[0].split('/')[0]);
        }
    });
});
