// Keybard Paranoid: a single self-contained HTML file meant to be opened from
// disk. Everything is inlined, and a Content Security Policy written into the
// page forbids network access entirely, so even buggy or hostile code cannot
// send anything anywhere. See docs/paranoid.md.
import { createHash } from "crypto";
import { readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import type { Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const LAYERS = "virtual:bundled-layers";
const FONTS = "virtual:paranoid-fonts";
export const PARANOID_FILE = "keybard-paranoid.html";

/** The layer library: fetched from public/ normally, compiled in for Paranoid. */
export function bundledLayersPlugin(paranoid: boolean, root = process.cwd()): Plugin {
    return {
        name: "keybard-bundled-layers",
        resolveId(id) {
            if (id === LAYERS || id === FONTS) return "\0" + id;
        },
        load(id) {
            if (id === "\0" + LAYERS) {
                if (!paranoid) return "export default null;";
                const json = readFileSync(path.join(root, "public/layer-library/layers.json"), "utf8");
                JSON.parse(json);
                return `export default ${json};`;
            }
            if (id === "\0" + FONTS) {
                return paranoid ? `import ${JSON.stringify(path.join(root, "src/paranoid/fonts.css").replace(/\\/g, "/"))};` : "";
            }
        },
    };
}

/** Policy for the finished file. Only data embedded in the page may be read. */
export function contentSecurityPolicy(scriptHashes: string[]): string {
    return [
        "default-src 'none'",
        `script-src ${scriptHashes.map(h => `'sha256-${h}'`).join(" ")}`,
        "style-src 'unsafe-inline'",
        "img-src data: blob:",
        "font-src data:",
        // 'self' is Keybard Host when it serves this page; opened from disk it reaches nothing.
        "connect-src 'self' data: blob:",
        "media-src 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "manifest-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ].join("; ");
}

const URL_ATTRS = /\s(src|href|srcset|poster|data|action|formaction|ping|background|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const BANNED = [
    /<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i,
    /<link\b[^>]*\brel\s*=\s*["']?[^"'>]*\b(prerender|prefetch|preconnect|dns-prefetch|preload|modulepreload)\b/i,
    /<script\b[^>]*\btype\s*=\s*["']?speculationrules/i,
];

/**
 * Everything in the static page that could load or navigate somewhere other than
 * embedded data. Script bodies are skipped (the CSP governs what they do); style
 * bodies are checked for url() and @import.
 */
export function staticReferences(html: string): string[] {
    const problems: string[] = [];
    const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
    const markup = html.replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2>)/gi, "$1$3");
    for (const tag of markup.match(/<[a-zA-Z][^>]*>/g) || []) {
        if (BANNED.some(rule => rule.test(tag))) { problems.push(tag); continue; }
        for (const [, name, quoted] of tag.matchAll(URL_ATTRS)) {
            const value = quoted.replace(/^["']|["']$/g, "").trim();
            const values = name.toLowerCase() === "srcset" ? value.split(",").map(v => v.trim().split(/\s+/)[0]) : [value];
            if (values.some(v => v && !v.startsWith("data:") && !v.startsWith("#"))) { problems.push(tag); break; }
        }
    }
    for (const css of styles) {
        if (/@import\b/i.test(css)) problems.push("CSS @import");
        for (const [, , ref] of css.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/gi)) {
            if (!ref.trim().startsWith("data:") && !ref.trim().startsWith("#")) problems.push(`CSS url(${ref})`);
        }
    }
    return problems;
}

/** Add the CSP to a built page, refusing anything that would load from elsewhere. */
export function lockDown(source: string): string {
    // Browsers hash script text after turning CRLF into LF, so hash (and ship) LF text.
    const html = source.replace(/\r\n?/g, "\n");
    const problems = staticReferences(html);
    if (problems.length) throw new Error(`Paranoid build still references external resources:\n${problems.join("\n")}`);
    const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
        .map(m => createHash("sha256").update(m[1], "utf8").digest("base64"));
    if (!hashes.length) throw new Error("Paranoid build has no inline scripts");
    const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(hashes)}">`;
    const charset = /<meta\s+charset=["']?utf-8["']?\s*\/?>/i;
    if (!charset.test(html)) throw new Error("Paranoid build lost its charset meta");
    return html.replace(charset, m => `${m}\n${meta}`);
}

export function paranoidPlugins(root: string): Plugin[] {
    const outDir = path.join(root, "dist-paranoid");
    return [
        viteSingleFile({ removeViteModuleLoader: true }),
        {
            name: "keybard-paranoid-html",
            transformIndexHtml: {
                order: "pre",
                handler(html) {
                    const icon = readFileSync(path.join(root, "public/favicon.png")).toString("base64");
                    return html
                        .replace(/^\s*<link\b[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*$/gim, "")
                        .replace(/(<link\b[^>]*rel=["']icon["'][^>]*href=)["'][^"']*["']/i, `$1"data:image/png;base64,${icon}"`);
                },
            },
            closeBundle() {
                const built = path.join(outDir, "index.html");
                writeFileSync(built, lockDown(readFileSync(built, "utf8")));
                const final = path.join(outDir, PARANOID_FILE);
                renameSync(built, final);
                const digest = createHash("sha256").update(readFileSync(final)).digest("hex");
                writeFileSync(path.join(outDir, "SHA256SUMS.txt"), `${digest}  ${PARANOID_FILE}\n`);
            },
        },
    ];
}
