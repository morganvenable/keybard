// Practice's bundle budgets (docs/practice/spec.md §9.8): after `vite build`, this plugin writes what
// tests/build/bundle-size.test.ts checks. It measures Practice's own share of each output, so growth
// elsewhere in Keybard never trips it:
// - the editor's initial chunk: gzip of the Practice modules rendered into the entry chunk;
// - the practice lazy chunks (engine + UI): gzip of every non-entry chunk holding Practice modules;
// - the English content: gzip of the word list chunk and the model asset;
// - Paranoid: uncompressed length of the Practice modules (and their inlined content) in the one file.
// The stats go to node_modules/.cache, never into the deployed dist.
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import type { Plugin } from "vite";
import { gzipSync } from "zlib";

export const PRACTICE_DIR = "/src/features/practice/";
export const CONTENT_MODULES = /(words-en\.json|model-en\.data|virtual:practice-content)/;

export interface BundleStats {
    mode: string;
    /** gzip bytes of Practice code in the entry chunk. */
    practiceInEntry: number;
    /** gzip bytes of the lazy chunks that hold Practice code (content excluded). */
    practiceLazy: number;
    /** gzip bytes of the English content (word list chunk + model asset). */
    contentEn: number;
    /** Uncompressed bytes of Practice code (minified share) and content across all chunks (the Paranoid file growth). */
    practiceRaw: number;
    chunks: { file: string; entry: boolean; gzip: number; practice: boolean; content: boolean }[];
}

export function statsFile(root: string, mode: string): string {
    return path.join(root, "node_modules", ".cache", "keybard", `bundle-stats-${mode}.json`);
}

const normalize = (id: string) => id.replace(/\\/g, "/");
const gzip = (text: string | Uint8Array) => gzipSync(typeof text === "string" ? Buffer.from(text) : Buffer.from(text)).length;

export function bundleStatsPlugin(mode: string, root = process.cwd()): Plugin {
    return {
        name: "keybard-practice-bundle-stats",
        apply: "build",
        generateBundle(_options, bundle) {
            const stats: BundleStats = { mode, practiceInEntry: 0, practiceLazy: 0, contentEn: 0, practiceRaw: 0, chunks: [] };
            for (const output of Object.values(bundle)) {
                if (output.type === "asset") {
                    if (/model-en.*\.data$/.test(output.fileName)) {
                        const bytes = typeof output.source === "string" ? Buffer.from(output.source) : output.source;
                        stats.contentEn += gzip(bytes);
                        stats.chunks.push({ file: output.fileName, entry: false, gzip: gzip(bytes), practice: false, content: true });
                    }
                    continue;
                }
                const ids = Object.keys(output.modules).map(normalize);
                const practiceIds = ids.filter((id) => id.includes(PRACTICE_DIR) || id.includes("virtual:practice-content"));
                const contentIds = practiceIds.filter((id) => CONTENT_MODULES.test(id));
                const codeOf = (list: string[]) => list.map((id) => {
                    const key = Object.keys(output.modules).find((k) => normalize(k) === id)!;
                    return output.modules[key].code ?? "";
                }).join("\n");
                const practiceCode = codeOf(practiceIds.filter((id) => !CONTENT_MODULES.test(id)));
                const contentCode = codeOf(contentIds);
                // Module code is measured before minification; scale code by the chunk's minified share.
                // Content (the word list, the base64 model) barely minifies, so it counts as it is.
                const rendered = Object.values(output.modules).reduce((sum, m) => sum + (m.code?.length ?? 0), 0);
                const minified = rendered > 0 ? Math.min(1, output.code.length / rendered) : 1;
                stats.practiceRaw += Math.round(practiceCode.length * minified) + contentCode.length;
                const isContent = contentIds.length > 0 && contentIds.length === practiceIds.length;
                const isPractice = practiceIds.length > 0 && !isContent;
                const size = gzip(output.code);
                if (output.isEntry) stats.practiceInEntry += practiceCode ? gzip(practiceCode) : 0;
                else if (isContent) stats.contentEn += size;
                else if (isPractice) stats.practiceLazy += size;
                stats.chunks.push({ file: output.fileName, entry: output.isEntry, gzip: size, practice: isPractice, content: isContent });
            }
            const file = statsFile(root, mode);
            mkdirSync(path.dirname(file), { recursive: true });
            writeFileSync(file, JSON.stringify(stats, null, 2));
        },
    };
}
