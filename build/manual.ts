// Publishes the user manual (docs/manual) beside the app at <base>/manual/.
// Only the reader-facing files are copied; the capture tools, their evidence
// and the maintenance README stay in the repository. The manual uses relative
// links only, so it works under any base path.
import { cpSync, createReadStream, existsSync, mkdirSync, statSync } from "fs";
import path from "path";
import type { Plugin } from "vite";

export const MANUAL_FILES = ["index.html", "manual.css", "manual.js", "keybard-user-manual.pdf", "content", "assets"];

const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
};

/** Copy the manual into `outDir/manual`. Exported for tests. */
export function copyManual(source: string, outDir: string): void {
    const target = path.join(outDir, "manual");
    mkdirSync(target, { recursive: true });
    for (const name of MANUAL_FILES) {
        const from = path.join(source, name);
        if (!existsSync(from)) throw new Error(`Manual file missing: ${from}`);
        cpSync(from, path.join(target, name), { recursive: true });
    }
}

export function manualPlugin(enabled: boolean, root: string): Plugin {
    const source = path.join(root, "docs/manual");
    let outDir = "";
    let base = "/";
    return {
        name: "keybard-manual",
        configResolved(config) {
            outDir = path.resolve(config.root, config.build.outDir);
            base = config.base;
        },
        configureServer(server) {
            if (!enabled) return;
            const prefix = `${base}manual`;
            server.middlewares.use((req, res, next) => {
                const url = (req.url ?? "").split(/[?#]/)[0];
                if (url === prefix) {
                    res.statusCode = 301;
                    res.setHeader("Location", `${prefix}/`);
                    res.end();
                    return;
                }
                if (!url.startsWith(`${prefix}/`)) return next();
                const rel = decodeURIComponent(url.slice(prefix.length + 1)) || "index.html";
                const file = path.resolve(source, rel);
                const top = rel.split("/")[0];
                if (!file.startsWith(source + path.sep) || !MANUAL_FILES.includes(top) || !existsSync(file) || !statSync(file).isFile()) return next();
                res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
                createReadStream(file).pipe(res);
            });
        },
        closeBundle() {
            if (enabled) copyManual(source, outDir);
        },
    };
}
