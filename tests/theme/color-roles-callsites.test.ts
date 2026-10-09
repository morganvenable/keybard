/**
 * Color roles at the §5.17 call sites (docs/practice/spec.md). The red-reserved
 * rule in no-hardcoded-chrome-colors.test.ts catches red coming back; this file
 * pins the sites that used an ad-hoc blue or amber, which that rule can't see.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf-8");

const SITES: { file: string; uses: string[]; not: string[] }[] = [
    { file: "src/layout/SecondarySidebar/Panels/LeadersPanel.tsx", uses: ['isSelected && "ring-2 ring-kb-select"'], not: ["ring-blue-500"] },
    { file: "src/layout/SecondarySidebar/Panels/AltRepeatPanel.tsx", uses: ['isSelected && "ring-2 ring-kb-select"'], not: ["ring-blue-500"] },
    { file: "src/layout/EditorLayout.tsx", uses: ["ring-4 ring-inset ring-kb-select/50"], not: ["ring-blue-400", "ring-opacity-50"] },
    { file: "src/layout/SecondarySidebar/Panels/BoardIdentitySection.tsx", uses: ['dirty ? "border-kb-pending"'], not: ["border-amber-500"] },
    { file: "src/layout/SecondarySidebar/Panels/LayoutsPanel.tsx", uses: ["bg-kb-select-tint/40 border-2 border-solid border-kb-select"], not: ["border-dashed border-blue-500", "text-blue-500"] },
    { file: "src/components/LayoutGroupCard.tsx", uses: ["bg-kb-gray-medium text-kb-ink rounded"], not: ["bg-blue-100"] },
    { file: "src/layout/LayerSelector.tsx", uses: ["PENDING_OUTLINE_CLASSES", "hover:bg-kb-active/80"], not: ["ring-red-500"] },
    { file: "src/layout/KeyboardViewInstance.tsx", uses: ["bg-kb-select-tint text-kb-ink shadow-md scale-105 ring-2 ring-kb-select"], not: [] },
    { file: "src/components/MatrixTester.tsx", uses: ["selectedStrong={isPressed}", "dark:border-kb-gray-border"], not: ["selected={isPressed}"] },
    { file: "src/layout/SecondarySidebar/components/EditorKey.tsx", uses: ["hover:border-kb-select", "!bg-kb-select-tint border-2 border-kb-select text-kb-ink", "!bg-kb-select-tint !border-2 text-kb-ink"], not: [] },
    { file: "src/layout/SecondarySidebar/components/BindingEditor/EditorKey.tsx", uses: ["SELECTED_SLOT_CLASSES", "selected={selected || isDropTarget}"], not: ["headerClass = SELECTED_STRIP_CLASSES"] },
    { file: "src/layout/SecondarySidebar/components/BindingsList.tsx", uses: ["hover:border-kb-select"], not: [] },
    { file: "src/components/DragOverlay.tsx", uses: ["border-kb-select"], not: [] },
];

describe("color roles at the §5.17 call sites", () => {
    it.each(SITES)("$file", ({ file, uses, not }) => {
        const src = read(file);
        for (const u of uses) expect(src, `${file} should use ${u}`).toContain(u);
        for (const n of not) expect(src, `${file} should not use ${n}`).not.toContain(n);
    });

    it("the dead pending-change-styles constants are gone", () => {
        expect(existsSync(resolve(process.cwd(), "src/constants/pending-change-styles.ts"))).toBe(false);
    });
});
