import { describe, expect, it, vi } from "vitest";

import { OWNER_Q7_LAB_VIEW_ENABLED } from "@/constants/owner-decisions";
import {
    isPageWorkspace,
    parseWorkspaceHash,
    syncWorkspaceHash,
    WORKSPACE_HAS_PANEL,
    workspaceHash,
} from "@/layout/workspaces";

// docs/practice/spec.md §4.2 deep links.

describe("parseWorkspaceHash", () => {
    it.each([
        ["#practice", { workspace: "practice", practicePage: "lessons" }],
        ["#practice/progress", { workspace: "practice", practicePage: "progress" }],
        ["#overlay", { workspace: "overlay", practicePage: "lessons" }],
        ["#trainer", { workspace: "overlay", practicePage: "lessons" }],
        ["#Trainer", { workspace: "overlay", practicePage: "lessons" }],
    ])("reads %s", (hash, route) => {
        expect(parseWorkspaceHash(hash)).toEqual(route);
    });

    it("leaves other hashes alone", () => {
        expect(parseWorkspaceHash("")).toBeNull();
        expect(parseWorkspaceHash("#")).toBeNull();
        expect(parseWorkspaceHash("#layouts")).toBeNull();
        expect(parseWorkspaceHash("#practice/unknown")).toBeNull();
    });

    it("opens the lab only with ?practiceLab=1 and where Q7 allows it, else Practice", () => {
        expect(parseWorkspaceHash("#practice/lab")).toEqual({ workspace: "practice", practicePage: "lessons" });
        expect(parseWorkspaceHash("#practice/lab", "?practiceLab=0")).toEqual({ workspace: "practice", practicePage: "lessons" });
        expect(parseWorkspaceHash("#practice/lab", "?practiceLab=1")).toEqual({
            workspace: "practice",
            practicePage: OWNER_Q7_LAB_VIEW_ENABLED ? "lab" : "lessons",
        });
    });
});

describe("workspaceHash", () => {
    it("writes the canonical hash; #trainer becomes #overlay", () => {
        expect(workspaceHash(parseWorkspaceHash("#trainer")!)).toBe("#overlay");
        expect(workspaceHash({ workspace: "practice", practicePage: "lessons" })).toBe("#practice");
        expect(workspaceHash({ workspace: "practice", practicePage: "progress" })).toBe("#practice/progress");
        expect(workspaceHash({ workspace: "practice", practicePage: "lab" })).toBe("#practice/lab");
        expect(workspaceHash({ workspace: "editor", practicePage: "progress" })).toBe("");
    });
});

describe("syncWorkspaceHash", () => {
    const fakeLocation = (hash: string, search = "") => ({ pathname: "/keybard/", search, hash }) as Location;
    const fakeHistory = () => ({ state: { kept: true }, replaceState: vi.fn() }) as unknown as History & { replaceState: ReturnType<typeof vi.fn> };

    it("replaces the entry instead of pushing one, keeping the query", () => {
        const history = fakeHistory();
        syncWorkspaceHash({ workspace: "practice", practicePage: "progress" }, fakeLocation("", "?practiceLab=1"), history);
        expect(history.replaceState).toHaveBeenCalledWith({ kept: true }, "", "/keybard/?practiceLab=1#practice/progress");
    });

    it("rewrites #trainer to #overlay", () => {
        const history = fakeHistory();
        syncWorkspaceHash({ workspace: "overlay", practicePage: "lessons" }, fakeLocation("#trainer"), history);
        expect(history.replaceState).toHaveBeenCalledWith({ kept: true }, "", "/keybard/#overlay");
    });

    it("clears a workspace hash on return to the editor, and leaves other hashes", () => {
        const history = fakeHistory();
        syncWorkspaceHash({ workspace: "editor", practicePage: "lessons" }, fakeLocation("#practice"), history);
        expect(history.replaceState).toHaveBeenCalledWith({ kept: true }, "", "/keybard/");
        const other = fakeHistory();
        syncWorkspaceHash({ workspace: "editor", practicePage: "lessons" }, fakeLocation("#something-else"), other);
        syncWorkspaceHash({ workspace: "editor", practicePage: "lessons" }, fakeLocation(""), other);
        expect(other.replaceState).not.toHaveBeenCalled();
    });

    it("does nothing when the hash already matches", () => {
        const history = fakeHistory();
        syncWorkspaceHash({ workspace: "overlay", practicePage: "lessons" }, fakeLocation("#overlay"), history);
        expect(history.replaceState).not.toHaveBeenCalled();
    });
});

describe("workspace ids", () => {
    it("knows the two page workspaces", () => {
        expect(isPageWorkspace("practice")).toBe(true);
        expect(isPageWorkspace("overlay")).toBe(true);
        expect(isPageWorkspace("trainer")).toBe(false);
        expect(isPageWorkspace("matrixtester")).toBe(false);
        expect(isPageWorkspace(null)).toBe(false);
    });

    it("keeps Overlay out of the panel auto-open until MO", () => {
        expect(WORKSPACE_HAS_PANEL).toEqual({ practice: true, overlay: false });
    });
});
