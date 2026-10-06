/**
 * Exemptions for tests/theme/no-hardcoded-chrome-colors.test.ts.
 *
 * Keep this list short. Every entry needs a reason. Prefer fixing the call
 * site (a token, or a dark: partner next to the existing class) over adding
 * an entry here. Paths are repo-relative with forward slashes.
 */

export type GuardRule = "hardcoded-chrome" | "svg-attr" | "gray-no-dark" | "header-themed";

export interface AllowedFile {
    /** Exact file, a directory prefix, or a RegExp tested against the repo-relative path. */
    path: string | RegExp;
    reason: string;
}

export interface AllowedLiteral {
    file: string;
    /** Substring of, or RegExp tested against, the offending literal's text. */
    literal: string | RegExp;
    /** Limit the exemption to one rule. */
    rule?: GuardRule;
    reason: string;
}

/** Whole files that are not scanned. Each string path must exist (the test checks). */
export const ALLOWED_FILES: AllowedFile[] = [
    // Layer colour DATA. It is a .ts file, so the .tsx scan never reads it;
    // listed so the exemption is explicit if the scan is ever widened.
    { path: "src/utils/colors.ts", reason: "Layer colour data: never themed." },

    // Printed output stays light.
    { path: /^src\/components\/PrintableKeymap[^/]*$/, reason: "Printed output stays light." },

    // Dead code, not mounted anywhere. Not edited by the dark-mode work.
    { path: "src/components/KeyboardConnector.tsx", reason: "Dead code." },
    { path: "src/components/Keyboards/InternationalKeyboard.tsx", reason: "Dead code." },
    { path: "src/components/Keyboards/NumpadKeyboard.tsx", reason: "Dead code." },
    { path: "src/components/Keyboards/SpecialKeyboard.tsx", reason: "Dead code." },
    { path: "src/components/Keyboards/SvalboardKeyboard.tsx", reason: "Dead code." },

    // Developer-only tools (settings 'developer' category). Only obvious chrome was tokenised.
    // TODO(dark-mode): full dark mapping of the ProofSheet pages.
    { path: "src/pages/ProofSheet", reason: "Developer-only; full dark mapping deferred (TODO)." },
    // TODO(dark-mode): dark variants for the ScanLab SVG series colours.
    { path: "src/layout/SecondarySidebar/Panels/ScanLabPanel.tsx", reason: "Developer-only; SVG series dark variants deferred (TODO)." },

    // shadcn/radix stock primitives use the shadcn CSS variables (--background,
    // --popover, ...) that .dark already redefines. Custom primitives in this
    // folder (OnOffToggle, slider, sidebar) were migrated in WP1.
    { path: "src/components/ui", reason: "shadcn ui stock, themed through shadcn CSS variables." },
];

/** Individual literals that are exempt. Unused entries fail the test, so remove them when the code goes. */
export const ALLOWED_LITERALS: AllowedLiteral[] = [
    {
        file: "src/components/Keyboard.tsx",
        literal: /^text-(black|gray-200)$/,
        reason: "TEXT_CLASS_TO_HEX keys and comparisons against layer text-colour classes (layer data lookups, not styling).",
    },
    {
        file: "src/components/DragOverlay.tsx",
        literal: "border-2 border-white",
        rule: "hardcoded-chrome",
        reason: "Layer drag ghost: the white ring sits on the layer's own colour and stays as is.",
    },
    {
        file: "src/layout/SecondarySidebar/components/OneShotModifierSelector.tsx",
        literal: "rounded-full bg-white flex items-center justify-center text-[8px] font-bold text-black",
        rule: "hardcoded-chrome",
        reason: "L/R toggle thumb: a white knob with black lettering on the gray track, legible in both themes.",
    },
];
