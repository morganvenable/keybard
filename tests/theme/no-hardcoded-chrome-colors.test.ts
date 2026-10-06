/**
 * Dark-mode guard: keeps editor chrome on theme tokens.
 *
 * Scans every string literal, template literal and JSX attribute in
 * src/**\/*.tsx and fails when a chrome colour is hard-coded in a way that
 * would break dark mode. See the "Theming" section of README.md for the
 * rules this enforces, and tests/theme/allowlist.ts for the exemptions.
 *
 * Rules (each finding names its rule):
 * - hardcoded-chrome: bg-white, border-white, text-black, border-black,
 *   fill-black, ring-black or bg-[#hex] (any variant, e.g. hover:) with no
 *   dark: class for the same property and variants in that literal. Prefer the tokens
 *   bg-kb-surface, border-kb-surface, text-kb-ink, border-kb-ink,
 *   fill-kb-ink or ring-kb-ink.
 * - svg-attr: fill="black" / stroke="#000" style JSX attributes. Use the
 *   fill-kb-ink / stroke-kb-ink classes instead.
 * - gray-no-dark: a (bg|text|border|divide|ring)-(gray|slate)-N utility in a
 *   literal with no dark: class for the same property and variants (so
 *   hover:bg-gray-100 needs dark:hover:bg-*) in that literal.
 * - header-themed: a headerClassName value containing kb-active or
 *   kb-header. Key headers are layer data and are never themed, so the
 *   colour rules above are not applied inside headerClassName values.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ALLOWED_FILES, ALLOWED_LITERALS, type AllowedLiteral, type GuardRule } from "./allowlist";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");

type Rule = GuardRule;

export interface Finding {
    file: string;
    line: number;
    rule: Rule;
    token: string;
    literal: string;
}

// ---------------------------------------------------------------------------
// Class-string analysis (pure, exported for the self-test below)
// ---------------------------------------------------------------------------

/** Split a class string into its variant chain and utility, e.g. "dark:hover:bg-x". */
function parseClass(cls: string): { variants: string[]; utility: string } {
    // Variants are separated by ':' outside of [...] arbitrary values.
    const parts: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of cls) {
        if (ch === "[") depth++;
        if (ch === "]") depth = Math.max(0, depth - 1);
        if (ch === ":" && depth === 0) {
            parts.push(cur);
            cur = "";
        } else {
            cur += ch;
        }
    }
    parts.push(cur);
    const utility = (parts.pop() ?? "").replace(/^!/, "");
    return { variants: parts, utility };
}

const CHROME_PATTERNS: RegExp[] = [
    /^bg-white(\/\d+)?$/,
    /^text-black(\/\d+)?$/,
    /^border(-[xytrbl])?-(black|white)(\/\d+)?$/,
    /^fill-black$/,
    /^ring-black(\/\d+)?$/,
    /^bg-\[#[0-9a-fA-F]{3,8}\](\/\d+)?$/,
];

const GRAY_RE = /^(bg|text|border|divide|ring)(-[xytrbl])?-(gray|slate)-\d{2,3}(\/\d+)?$/;
const PROP_RE = /^(bg|text|border|divide|ring)(?:-|$)/;

/** Returns findings (rule + offending class) for one class-like string. */
export function analyzeClassString(text: string): { rule: Rule; token: string }[] {
    const out: { rule: Rule; token: string }[] = [];
    const classes = text.split(/\s+/).filter(Boolean);
    // A dark: partner must match the property AND the other variants, so
    // hover:text-black needs a dark:hover:text-* class, not just dark:text-*.
    const partnerKey = (prop: string, variants: string[]) =>
        [prop, ...variants.filter((v) => v !== "dark").sort()].join("|");
    const darkPartners = new Set<string>();
    for (const cls of classes) {
        const { variants, utility } = parseClass(cls);
        if (variants.includes("dark")) {
            const m = PROP_RE.exec(utility);
            if (m) darkPartners.add(partnerKey(m[1], variants));
        }
    }
    for (const cls of classes) {
        const { variants, utility } = parseClass(cls);
        if (variants.includes("dark") || variants.includes("print")) continue;
        const prop = PROP_RE.exec(utility)?.[1];
        const hasDarkPartner = prop !== undefined && darkPartners.has(partnerKey(prop, variants));
        if (CHROME_PATTERNS.some((re) => re.test(utility))) {
            if (!hasDarkPartner) out.push({ rule: "hardcoded-chrome", token: cls });
            continue;
        }
        if (GRAY_RE.test(utility) && !hasDarkPartner) out.push({ rule: "gray-no-dark", token: cls });
    }
    return out;
}

const BLACK_VALUES = new Set(["black", "#000", "#000000"]);

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

function walk(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, acc);
        else if (full.endsWith(".tsx")) acc.push(full);
    }
    return acc;
}

const toPosix = (p: string) => p.split("\\").join("/");

/** Text of a literal node, with template substitutions replaced by a space. */
function literalText(node: ts.Node): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) {
        return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" ");
    }
    return null;
}

export function scanSource(file: string, source: string): Finding[] {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const findings: Finding[] = [];
    const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const push = (n: ts.Node, rule: Rule, token: string, literal: string) =>
        findings.push({ file, line: lineOf(n), rule, token, literal });

    const visit = (node: ts.Node) => {
        // fill="black" / stroke="#000" as JSX attributes or style-like object props.
        if (ts.isJsxAttribute(node) && node.initializer) {
            const name = node.name.getText(sf);
            const init = node.initializer;
            if ((name === "fill" || name === "stroke") && ts.isStringLiteral(init) && BLACK_VALUES.has(init.text.toLowerCase())) {
                push(node, "svg-attr", `${name}="${init.text}"`, node.getText(sf));
            }
        }

        // headerClassName must never carry theme tokens.
        const isHeaderProp =
            (ts.isJsxAttribute(node) && node.name.getText(sf) === "headerClassName") ||
            (ts.isPropertyAssignment(node) && node.name.getText(sf) === "headerClassName");
        if (isHeaderProp) {
            const text = node.getText(sf);
            const m = /kb-(active|header)[\w-]*/.exec(text);
            if (m) push(node, "header-themed", m[0], text);
            // Key headers are layer data, never themed: skip the chrome rules inside.
            return;
        }

        const text = literalText(node);
        if (text !== null) {
            for (const f of analyzeClassString(text)) push(node, f.rule, f.token, text);
            if (ts.isTemplateExpression(node)) return; // spans' literals already covered
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return findings;
}

function matchesAllowedLiteral(f: Finding, a: AllowedLiteral): boolean {
    if (f.file !== a.file) return false;
    if (a.rule && a.rule !== f.rule) return false;
    return typeof a.literal === "string" ? f.literal.includes(a.literal) : a.literal.test(f.literal);
}

function isAllowedFile(rel: string): boolean {
    return ALLOWED_FILES.some((a) => (typeof a.path === "string" ? rel === a.path || rel.startsWith(a.path.endsWith("/") ? a.path : `${a.path}/`) : a.path.test(rel)));
}

function scanRepo(): { findings: Finding[]; unusedLiteralAllows: AllowedLiteral[] } {
    const used = new Set<AllowedLiteral>();
    const findings: Finding[] = [];
    for (const full of walk(SRC)) {
        const rel = toPosix(relative(ROOT, full));
        if (isAllowedFile(rel)) continue;
        for (const f of scanSource(rel, readFileSync(full, "utf-8"))) {
            const allow = ALLOWED_LITERALS.find((a) => matchesAllowedLiteral(f, a));
            if (allow) used.add(allow);
            else findings.push(f);
        }
    }
    return { findings, unusedLiteralAllows: ALLOWED_LITERALS.filter((a) => !used.has(a)) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("theme guard: analyzer self-test", () => {
    it("flags hard-coded chrome colours", () => {
        const rules = (s: string) => analyzeClassString(s).map((f) => f.token);
        expect(rules("p-2 bg-white text-sm")).toEqual(["bg-white"]);
        expect(rules("hover:text-black")).toEqual(["hover:text-black"]);
        expect(rules("focus-visible:ring-black ring-2")).toEqual(["focus-visible:ring-black"]);
        expect(rules("bg-[#EEEEEE] border-black fill-black")).toEqual(["bg-[#EEEEEE]", "border-black", "fill-black"]);
    });

    it("accepts tokens, dark: partners and unrelated black uses", () => {
        expect(analyzeClassString("bg-kb-surface text-kb-ink ring-kb-ink fill-kb-ink")).toEqual([]);
        expect(analyzeClassString("bg-black/50 text-white bg-kb-sidebar-dark")).toEqual([]);
        expect(analyzeClassString("text-gray-500 dark:text-neutral-400")).toEqual([]);
        expect(analyzeClassString("hover:bg-gray-100 dark:hover:bg-neutral-800")).toEqual([]);
        expect(analyzeClassString("print:bg-white")).toEqual([]);
        expect(analyzeClassString("hover:bg-white/50 dark:hover:bg-neutral-700")).toEqual([]);
    });

    it("requires a dark: partner for the same property", () => {
        expect(analyzeClassString("bg-gray-100 text-gray-500 dark:bg-neutral-800").map((f) => f.token)).toEqual(["text-gray-500"]);
        expect(analyzeClassString("border-slate-200 border-t-gray-300").map((f) => f.token)).toEqual(["border-slate-200", "border-t-gray-300"]);
        expect(analyzeClassString("divide-gray-200 dark:divide-neutral-700")).toEqual([]);
        // The partner must cover the same variant chain.
        expect(analyzeClassString("text-gray-500 dark:text-neutral-400 hover:text-black").map((f) => f.token)).toEqual(["hover:text-black"]);
        expect(analyzeClassString("hover:bg-gray-100 dark:bg-neutral-800").map((f) => f.token)).toEqual(["hover:bg-gray-100"]);
    });

    it("scans JSX attributes, template literals and headerClassName", () => {
        const src = [
            'const a = <path fill="black" />;',
            'const b = <g stroke="#000" />;',
            "const c = `px-2 ${x} bg-white`;",
            'const d = <Key headerClassName="bg-kb-active" />;',
            'const e = { headerClassName: "bg-kb-sidebar-dark" };',
            'const f = <div className="bg-kb-surface" />;',
            'const g = <Key headerClassName={on ? "bg-kb-sidebar-dark" : "text-black"} />;',
        ].join("\n");
        const found = scanSource("x.tsx", src).map((f) => `${f.line}:${f.rule}`);
        expect(found).toEqual(["1:svg-attr", "2:svg-attr", "3:hardcoded-chrome", "4:header-themed"]);
    });
});

describe("theme guard: src/**/*.tsx", () => {
    const { findings, unusedLiteralAllows } = scanRepo();

    it("has no hard-coded chrome colours outside the allowlist", () => {
        const report = findings.map((f) => `${f.file}:${f.line} [${f.rule}] ${f.token}`);
        expect(report, "Use theme tokens or add a dark: partner (see README Theming). Allowlist: tests/theme/allowlist.ts").toEqual([]);
    });

    it("has no stale literal allowlist entries", () => {
        expect(unusedLiteralAllows.map((a) => `${a.file} ${String(a.literal)}`)).toEqual([]);
    });

    it("every allowlisted file still exists", () => {
        const missing = ALLOWED_FILES.filter((a) => typeof a.path === "string").filter((a) => {
            try {
                statSync(resolve(ROOT, a.path as string));
                return false;
            } catch {
                return true;
            }
        });
        expect(missing.map((a) => a.path)).toEqual([]);
    });
});
