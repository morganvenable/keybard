/**
 * Exemptions for tests/theme/no-hardcoded-chrome-colors.test.ts.
 *
 * Keep this list short. Every entry needs a reason. Prefer fixing the call
 * site (a token, or a dark: partner next to the existing class) over adding
 * an entry here. Paths are repo-relative with forward slashes.
 */

export type GuardRule = "hardcoded-chrome" | "svg-attr" | "gray-no-dark" | "header-themed" | "red-reserved";

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

// ---------------------------------------------------------------------------
// red-reserved (docs/practice/spec.md §5.17)
// ---------------------------------------------------------------------------

/** Why a red utility is allowed. Selection, hover, drop targets and pending edits are never red. */
export type RedReason = "destructive" | "error" | "wrong-key" | "layer-data";

export interface RedAllowed {
    file: string;
    /** Substring of, or RegExp tested against, the literal that holds the red utility. */
    literal: string | RegExp;
    /**
     * The exact red utilities this entry allows in that literal. A red utility the
     * literal also holds but this list doesn't name is still a finding, so a selection
     * red added next to an allowed trash hover can't ride on the entry.
     */
    tokens: string[];
    reason: RedReason;
    /** What the red marks, for the reader. */
    note: string;
}

/**
 * The only places a (bg|ring|border|outline)-red-N or ...-kb-red utility may appear in
 * src/. Unlike ALLOWED_FILES, this rule scans every file, including src/components/ui,
 * the ProofSheet pages and ScanLab. Unused entries fail the test.
 * Practice's wrong-key border and badge and its error tint are added with the Practice code.
 */
export const RED_ALLOWED: RedAllowed[] = [
    // Destructive: delete and trash buttons (hover) and destructive confirm buttons.
    { file: "src/components/LayerRow.tsx", literal: "transition-all hover:bg-red-500 hover:text-white focus:outline-none cursor-pointer bg-kb-gray-medium", tokens: ["hover:bg-red-500"], reason: "destructive", note: "Delete-layer buttons (two sizes)." },
    { file: "src/components/LayerRow.tsx", literal: "bg-red-600 hover:bg-red-700", tokens: ["bg-red-600", "hover:bg-red-700"], reason: "destructive", note: "Confirm delete layer." },
    { file: "src/components/LayoutCard.tsx", literal: "hover:bg-red-50 dark:hover:bg-red-950/40", tokens: ["hover:bg-red-50", "dark:hover:bg-red-950/40"], reason: "destructive", note: "Delete layer from a saved layout." },
    { file: "src/components/LayoutGroupCard.tsx", literal: "hover:bg-red-500 hover:text-white", tokens: ["hover:bg-red-500"], reason: "destructive", note: "Delete layout button." },
    { file: "src/components/LayoutGroupCard.tsx", literal: "bg-red-600 hover:bg-red-700", tokens: ["bg-red-600", "hover:bg-red-700"], reason: "destructive", note: "Confirm delete layout." },
    { file: "src/layout/SecondarySidebar/components/BindingEditor/BindingEditorContainer.tsx", literal: "hover:bg-red-500 hover:text-white", tokens: ["hover:bg-red-500"], reason: "destructive", note: "Clear binding (trash)." },
    { file: "src/layout/SecondarySidebar/components/BindingEditor/BindingEditorContainer.tsx", literal: "bg-red-600 hover:bg-red-700", tokens: ["bg-red-600", "hover:bg-red-700", "dark:bg-red-600", "dark:hover:bg-red-700"], reason: "destructive", note: "Confirm clear binding." },
    { file: "src/layout/SecondarySidebar/components/BindingEditor/EditorKey.tsx", literal: "hover:bg-red-500 hover:text-white", tokens: ["hover:bg-red-500"], reason: "destructive", note: "Clear slot (trash)." },
    { file: "src/layout/SecondarySidebar/components/BindingEditor/MacroEditorText.tsx", literal: "hover:bg-red-500 hover:text-white", tokens: ["hover:bg-red-500"], reason: "destructive", note: "Delete macro text action (trash)." },
    { file: "src/layout/SecondarySidebar/components/SidebarItemRow.tsx", literal: "hover:bg-red-500 dark:hover:bg-red-500", tokens: ["hover:bg-red-500", "dark:hover:bg-red-500"], reason: "destructive", note: "Delete list item." },

    // Errors: error boxes and notices.
    { file: "src/components/EditingTargetStatus.tsx", literal: "border-red-200 dark:border-red-900", tokens: ["border-red-200", "dark:border-red-900"], reason: "error", note: "Connection error notice." },
    { file: "src/layout/SecondarySidebar/Panels/LayoutsPanel.tsx", literal: "bg-red-50 dark:bg-red-950/40", tokens: ["bg-red-50", "dark:bg-red-950/40"], reason: "error", note: "Layout load error box." },
    { file: "src/pages/ExploreLayoutsPage.tsx", literal: "bg-red-50 text-red-600 dark:bg-red-950/40", tokens: ["bg-red-50", "dark:bg-red-950/40"], reason: "error", note: "Layout load error box." },
    { file: "src/components/shared/Notice.tsx", literal: "border-red-200 dark:border-red-900", tokens: ["border-red-200", "dark:border-red-900"], reason: "error", note: "Error notice (Overlay: Host connection lost, can't reach Host, Host command failed)." },

    // Layer color data: a layer the user colors red still has red faces. (.ts, scanned by this rule only)
    { file: "src/utils/colors.ts", literal: /^(hover:)?(bg|border)-kb-red( text-white)?$/, tokens: ["bg-kb-red", "hover:border-kb-red", "hover:bg-kb-red"], reason: "layer-data", note: "Red layer color: face, hover border and hover face." },
];
