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
 * - red-reserved (docs/practice/spec.md §5.17): red means error, destructive
 *   or wrong key, nothing else. A (bg|ring|border|outline)-red-N or
 *   ...-kb-red utility (any variant) in a literal is a finding unless
 *   RED_ALLOWED lists it with a reason. This rule scans every .tsx and .ts
 *   file under src/, ignoring ALLOWED_FILES, and also reads headerClassName
 *   values. Selection uses kb-select, pending edits kb-pending.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ALLOWED_FILES, ALLOWED_LITERALS, RED_ALLOWED, type AllowedLiteral, type GuardRule, type RedAllowed } from "./allowlist";

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

const RED_RE = /^(bg|ring|border|outline)(-[xytrbl]|-[xy]?[se])?-(red-\d{2,3}|kb-red)(\/\d+)?$/;

/** red-reserved: every red background, ring, border or outline utility in one class string. */
export function analyzeRedClassString(text: string): string[] {
    return text.split(/\s+/).filter(Boolean).filter((cls) => {
        const { utility } = parseClass(cls);
        return RED_RE.test(utility.replace(/!$/, ""));
    });
}

const BLACK_VALUES = new Set(["black", "#000", "#000000"]);

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

function walk(dir: string, exts: string[] = [".tsx"], acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, exts, acc);
        else if (exts.some((e) => full.endsWith(e)) && !full.endsWith(".d.ts")) acc.push(full);
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

/** red-reserved findings in one file. Visits every literal, headerClassName values and template parts included. */
export function scanRedSource(file: string, source: string): Finding[] {
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    const findings: Finding[] = [];
    const visit = (node: ts.Node) => {
        const text = literalText(node);
        if (text !== null) {
            const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
            for (const token of analyzeRedClassString(text)) findings.push({ file, line, rule: "red-reserved", token, literal: text });
        }
        // Keep descending: a template's ${...} spans can hold more literals.
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return findings;
}

/** Every file the red-reserved rule reads: all .ts and .tsx under src/, with no file exemptions. */
export function redScanFiles(): string[] {
    return walk(SRC, [".ts", ".tsx"]).map((full) => toPosix(relative(ROOT, full)));
}

/** An entry allows a finding only for the red utilities it names, in a literal it matches. */
export function matchesRedAllowed(f: Finding, a: RedAllowed): boolean {
    if (f.file !== a.file || !a.tokens.includes(f.token)) return false;
    return typeof a.literal === "string" ? f.literal.includes(a.literal) : a.literal.test(f.literal);
}

function scanRedRepo(): { findings: Finding[]; unusedRedAllows: string[] } {
    const used = new Map<RedAllowed, Set<string>>();
    const findings: Finding[] = [];
    for (const rel of redScanFiles()) {
        for (const f of scanRedSource(rel, readFileSync(resolve(ROOT, rel), "utf-8"))) {
            const allow = RED_ALLOWED.find((a) => matchesRedAllowed(f, a));
            if (allow) used.set(allow, (used.get(allow) ?? new Set()).add(f.token));
            else findings.push(f);
        }
    }
    // An entry, or a token it names, that no longer matches anything is stale.
    const unusedRedAllows = RED_ALLOWED.flatMap((a) =>
        a.tokens.filter((t) => !used.get(a)?.has(t)).map((t) => `${a.file} ${String(a.literal)} ${t}`));
    return { findings, unusedRedAllows };
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

describe("theme guard: red-reserved self-test", () => {
    it("flags red backgrounds, rings, borders and outlines in any variant", () => {
        expect(analyzeRedClassString("bg-red-500 text-white ring-2 ring-red-500 ring-offset-1")).toEqual(["bg-red-500", "ring-red-500"]);
        expect(analyzeRedClassString("hover:border-red-600 !bg-red-600 dark:!bg-red-950/40 bg-red-600!")).toEqual(["hover:border-red-600", "!bg-red-600", "dark:!bg-red-950/40", "bg-red-600!"]);
        expect(analyzeRedClassString("border-t-red-500 outline-red-500 bg-kb-red hover:ring-kb-red")).toEqual(["border-t-red-500", "outline-red-500", "bg-kb-red", "hover:ring-kb-red"]);
    });

    it("leaves red text, other hues and the role tokens alone", () => {
        expect(analyzeRedClassString("text-red-700 dark:text-red-400 text-kb-red decoration-kb-red")).toEqual([]);
        expect(analyzeRedClassString("bg-kb-select-tint ring-kb-select border-kb-pending bg-kb-surface ring-offset-1")).toEqual([]);
        expect(analyzeRedClassString("bg-kb-redirect border-reddish")).toEqual([]);
    });

    it("flags a selected-key literal that is not allowlisted", () => {
        const src = 'const c = selected ? "bg-red-500 text-white ring-2 ring-red-500 ring-offset-1 ring-offset-background" : "";';
        const found = scanRedSource("src/components/Key.tsx", src);
        expect(found.map((f) => f.token)).toEqual(["bg-red-500", "ring-red-500"]);
        expect(found.filter((f) => !RED_ALLOWED.some((a) => matchesRedAllowed(f, a)))).toHaveLength(2);
    });

    it("allows a trash-hover literal listed in RED_ALLOWED", () => {
        const src = '<button className="h-8 w-8 rounded-full flex items-center justify-center p-0 text-kb-gray-border transition-all hover:bg-red-500 hover:text-white focus:outline-none cursor-pointer bg-kb-gray-medium" />;';
        const found = scanRedSource("src/components/LayerRow.tsx", src);
        expect(found.map((f) => f.token)).toEqual(["hover:bg-red-500"]);
        expect(found.every((f) => RED_ALLOWED.some((a) => matchesRedAllowed(f, a)))).toBe(true);
    });

    it("still flags a red the entry doesn't name, inside an allowed literal", () => {
        // The trash hover is allowed; a selection ring added to the same literal is not.
        const src = '<button className="p-1.5 hover:bg-red-500 hover:text-white ring-2 ring-red-500 rounded-full" />;';
        const found = scanRedSource("src/layout/SecondarySidebar/components/BindingEditor/EditorKey.tsx", src);
        expect(found.map((f) => f.token)).toEqual(["hover:bg-red-500", "ring-red-500"]);
        const unallowed = found.filter((f) => !RED_ALLOWED.some((a) => matchesRedAllowed(f, a)));
        expect(unallowed.map((f) => f.token)).toEqual(["ring-red-500"]);
    });

    it("reads headerClassName values, template spans and .ts files", () => {
        const tsx = [
            'const a = <Key headerClassName="bg-red-600 text-white" />;',
            'const b = `px-2 ${on ? "border-red-500" : ""} ring-kb-red`;',
        ].join("\n");
        expect(scanRedSource("x.tsx", tsx).map((f) => `${f.line}:${f.token}`)).toEqual(["1:bg-red-600", "2:ring-kb-red", "2:border-red-500"]);
        const tsSrc = 'export const STYLE = <const>{ pending: "border-red-500" };';
        expect(scanRedSource("x.ts", tsSrc).map((f) => f.token)).toEqual(["border-red-500"]);
    });

    it("still scans src/components/ui and the other ALLOWED_FILES", () => {
        const files = redScanFiles();
        expect(files.some((f) => f.startsWith("src/components/ui/"))).toBe(true);
        expect(files.some((f) => f.startsWith("src/pages/ProofSheet/"))).toBe(true);
        expect(files).toContain("src/layout/SecondarySidebar/Panels/ScanLabPanel.tsx");
        expect(files).toContain("src/utils/colors.ts");
        // A red literal in a ui primitive is a finding: no RED_ALLOWED entry covers ui/.
        const found = scanRedSource("src/components/ui/button.tsx", 'const v = "bg-red-500 text-white";');
        expect(found).toHaveLength(1);
        expect(RED_ALLOWED.some((a) => matchesRedAllowed(found[0], a))).toBe(false);
    });
});

describe("theme guard: red-reserved over src/", () => {
    const { findings, unusedRedAllows } = scanRedRepo();

    it("has no red outside RED_ALLOWED (errors, destructive actions, wrong keys, layer data)", () => {
        const report = findings.map((f) => `${f.file}:${f.line} [${f.rule}] ${f.token}`);
        expect(report, "Red is reserved: use kb-select for selection, kb-pending for unsent edits (spec §5.17). Allowlist: RED_ALLOWED in tests/theme/allowlist.ts").toEqual([]);
    });

    it("has no stale RED_ALLOWED entries", () => {
        expect(unusedRedAllows).toEqual([]);
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
