// Workspaces: the page that fills the area right of the nav rail (docs/practice/spec.md §4.1, D1, D12).
//
// The editor is the default workspace. Practice and Overlay are the other two; each is opened from its
// own nav item and has its own detail panel id ("practice", "overlay"). The workspace is independent
// of the detail panel: closing the panel never changes it.

import { OWNER_Q7_LAB_VIEW_ENABLED } from "@/constants/owner-decisions";

export type Workspace = "editor" | "practice" | "overlay";
/** A workspace other than the editor. Its id is also its nav item url and its detail panel id. */
export type PageWorkspace = Exclude<Workspace, "editor">;
/** Practice pages behind the Lessons · Progress pills. "lab" is the hidden M0 view (§4.2, Q7). */
export type PracticePage = "lessons" | "progress" | "lab";

export const PAGE_WORKSPACES: readonly PageWorkspace[] = ["practice", "overlay"];

export const isPageWorkspace = (id: string | null | undefined): id is PageWorkspace =>
    id === "practice" || id === "overlay";

/** The Practice nav item shows in every build since M1b shipped the Lessons and Progress pages (§12). */
export const PRACTICE_NAV_VISIBLE = true;

export interface WorkspaceRoute {
    workspace: Workspace;
    practicePage: PracticePage;
}

export const EDITOR_ROUTE: WorkspaceRoute = { workspace: "editor", practicePage: "lessons" };

/**
 * Reads a location hash (§4.2). Returns null for any hash that is not a workspace route, so
 * unrelated hashes are left alone. `#trainer` is an alias of `#overlay`.
 */
export function parseWorkspaceHash(hash: string, search = ""): WorkspaceRoute | null {
    const path = hash.replace(/^#/, "").toLowerCase();
    switch (path) {
        case "overlay":
        case "trainer":
            return { workspace: "overlay", practicePage: "lessons" };
        case "practice":
            return { workspace: "practice", practicePage: "lessons" };
        case "practice/progress":
            return { workspace: "practice", practicePage: "progress" };
        case "practice/lab":
            // Without ?practiceLab=1 (or where Q7 keeps the lab out) the hash opens Practice.
            return { workspace: "practice", practicePage: labAllowed(search) ? "lab" : "lessons" };
        default:
            return null;
    }
}

export function labAllowed(search: string): boolean {
    return OWNER_Q7_LAB_VIEW_ENABLED && new URLSearchParams(search).get("practiceLab") === "1";
}

/** The canonical hash for a route; "" for the editor. */
export function workspaceHash(route: WorkspaceRoute): string {
    if (route.workspace === "overlay") return "#overlay";
    if (route.workspace === "practice") {
        return route.practicePage === "lessons" ? "#practice" : `#practice/${route.practicePage}`;
    }
    return "";
}

/**
 * Brings the address bar in line with the route without adding a history entry. Returning to the
 * editor clears a workspace hash, so a reload doesn't reopen Practice or Overlay; other hashes stay.
 */
export function syncWorkspaceHash(route: WorkspaceRoute, location: Location = window.location, history: History = window.history): void {
    const wanted = workspaceHash(route);
    if (location.hash === wanted) return;
    if (!wanted && !parseWorkspaceHash(location.hash, location.search)) return;
    if (!wanted && !location.hash) return;
    try {
        history.replaceState(history.state, "", `${location.pathname}${location.search}${wanted}`);
    } catch {
        // Some embedded contexts refuse replaceState; the route still works for this session.
    }
}
