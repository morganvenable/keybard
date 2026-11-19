import { describe, expect, it } from "vitest";

import { layoutSidebarItemsFor } from "@/layout/Sidebar";
import { getPanelTitle } from "@/layout/PanelContent";

describe("App Layers rail item", () => {
    it("shows only on firmware with app rules, between Layouts and Overlay", () => {
        expect(layoutSidebarItemsFor(false).map((i) => i.title)).toEqual(["Layouts", "Overlay"]);
        expect(layoutSidebarItemsFor(true).map((i) => [i.title, i.url])).toEqual([["Layouts", "layouts"], ["App Layers", "app-layers"], ["Overlay", "trainer"]]);
    });

    it("opens a panel titled App Layers", () => {
        expect(getPanelTitle("app-layers")).toBe("App Layers");
    });
});
