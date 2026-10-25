/**
 * Prototype data: the apps the pretend Keybard Overlay has seen, the named
 * shortcut actions, and the ready-made sets. Set contents are drafts for
 * review, not a final list.
 */

/** A hold: what holding the key sends. `code` uses PRI(...) for the primary modifier
 *  (Ctrl on Windows and Linux, Cmd on a Mac). An empty code means "no hold". */
export interface HoldValue {
    code: string;
    /** Full name, for the key card ("Select all"). */
    name: string;
    /** Legend on the key, 4-6 characters ("Sel all"). */
    short: string;
}

export const NO_HOLD: HoldValue = { code: "", name: "No hold", short: "" };

type Mods = "" | "shift" | "alt";
interface ActionDef { name: string; short: string; key: string; mods?: Mods }

function primary(key: string, mods: Mods = ""): string {
    const inner = `KC_${key}`;
    if (mods === "shift") return `PRI(LSFT(${inner}))`;
    if (mods === "alt") return `PRI(LALT(${inner}))`;
    return `PRI(${inner})`;
}

export function action(a: ActionDef): HoldValue {
    return { code: primary(a.key, a.mods), name: a.name, short: a.short };
}

/** The everyday actions the key card offers as one-click holds. */
export const COMMON_ACTIONS: HoldValue[] = [
    action({ name: "Undo", short: "Undo", key: "Z" }),
    action({ name: "Cut", short: "Cut", key: "X" }),
    action({ name: "Copy", short: "Copy", key: "C" }),
    action({ name: "Paste", short: "Paste", key: "V" }),
    action({ name: "Select all", short: "Sel all", key: "A" }),
    action({ name: "Save", short: "Save", key: "S" }),
    action({ name: "Find", short: "Find", key: "F" }),
];

/** "PRI(LSFT(KC_E))" -> "Ctrl Shift E" (or "Cmd Shift E" on a Mac). */
export function shortcutText(code: string, os: "win" | "mac"): string {
    if (!code) return "";
    let s = code;
    const parts: string[] = [];
    for (;;) {
        const m = /^(PRI|LSFT|LALT|LCTL|LGUI)\((.+)\)$/.exec(s);
        if (!m) break;
        parts.push(m[1] === "PRI" ? (os === "mac" ? "Cmd" : "Ctrl") : m[1] === "LSFT" ? "Shift" : m[1] === "LALT" ? (os === "mac" ? "Option" : "Alt") : m[1] === "LCTL" ? "Ctrl" : (os === "mac" ? "Cmd" : "Win"));
        s = m[2];
    }
    const key = s.replace(/^KC_/, "");
    const named: Record<string, string> = { BSPACE: "Backspace", SLASH: "/", SCOLON: ";", ENTER: "Enter", SPACE: "Space" };
    parts.push(named[key] ?? (key.length === 1 ? key : key.charAt(0) + key.slice(1).toLowerCase()));
    return parts.join(" ");
}

export interface CatalogApp {
    id: string;
    name: string;
    /** One or two letters for the app mark. */
    mono: string;
    /** How the Overlay recognizes it: a program, or a window title (web apps in a browser). */
    program?: string;
    title?: string;
    browser?: string;
    /** The ready-made set offered for it. */
    setId?: string;
    game?: boolean;
}

/** Apps the pretend Overlay saw recently, newest first. */
export const SEEN_APPS: CatalogApp[] = [
    { id: "figma", name: "Figma", mono: "Fi", title: "Figma", browser: "Chrome", setId: "figma" },
    { id: "code", name: "VS Code", mono: "VS", program: "Code.exe", setId: "code" },
    { id: "elden", name: "Elden Ring", mono: "ER", program: "eldenring.exe", game: true },
    { id: "excel", name: "Excel", mono: "Ex", program: "EXCEL.EXE", setId: "excel" },
    { id: "chrome", name: "Chrome", mono: "Ch", program: "chrome.exe", setId: "browser" },
    { id: "slack", name: "Slack", mono: "Sl", program: "slack.exe" },
    { id: "ps", name: "Photoshop", mono: "Ps", program: "Photoshop.exe", setId: "photoshop" },
    { id: "hades", name: "Hades II", mono: "H2", program: "Hades2.exe", game: true },
];

export function catalogApp(id: string): CatalogApp | undefined {
    return SEEN_APPS.find(a => a.id === id);
}

export interface ReadySet {
    id: string;
    name: string;
    /** "all": the All-apps basics; otherwise the app it is made for. */
    forApp: string;
    /** Tap key (KC_ name) -> hold. */
    holds: { tap: string; hold: HoldValue }[];
}

const basics = (["Z", "X", "C", "V", "A", "S", "F"] as const).map((k, i) => ({ tap: `KC_${k}`, hold: COMMON_ACTIONS[i] }));

export const READY_SETS: ReadySet[] = [
    { id: "basics", name: "All-apps basics", forApp: "all", holds: basics },
    {
        id: "figma", name: "Figma", forApp: "figma", holds: [
            { tap: "KC_D", hold: action({ name: "Duplicate", short: "Dup", key: "D" }) },
            { tap: "KC_G", hold: action({ name: "Group", short: "Group", key: "G" }) },
            { tap: "KC_K", hold: action({ name: "Make component", short: "Comp", key: "K", mods: "alt" }) },
            { tap: "KC_H", hold: action({ name: "Hide", short: "Hide", key: "H", mods: "shift" }) },
            { tap: "KC_L", hold: action({ name: "Lock", short: "Lock", key: "L", mods: "shift" }) },
            { tap: "KC_E", hold: action({ name: "Export", short: "Export", key: "E", mods: "shift" }) },
            { tap: "KC_F", hold: action({ name: "Frame selection", short: "Frame", key: "G", mods: "alt" }) },
        ],
    },
    {
        id: "photoshop", name: "Photoshop", forApp: "ps", holds: [
            { tap: "KC_J", hold: action({ name: "Duplicate layer", short: "Dup", key: "J" }) },
            { tap: "KC_E", hold: action({ name: "Merge down", short: "Merge", key: "E" }) },
            { tap: "KC_T", hold: action({ name: "Free transform", short: "Xform", key: "T" }) },
            { tap: "KC_D", hold: action({ name: "Deselect", short: "Desel", key: "D" }) },
            { tap: "KC_I", hold: action({ name: "Invert", short: "Invert", key: "I" }) },
            { tap: "KC_M", hold: action({ name: "Curves", short: "Curves", key: "M" }) },
        ],
    },
    {
        id: "code", name: "VS Code", forApp: "code", holds: [
            { tap: "KC_P", hold: action({ name: "Go to file", short: "Go file", key: "P" }) },
            { tap: "KC_D", hold: action({ name: "Add next match", short: "Next", key: "D" }) },
            { tap: "KC_B", hold: action({ name: "Toggle sidebar", short: "Side", key: "B" }) },
            { tap: "KC_SLASH", hold: action({ name: "Comment line", short: "Cmnt", key: "SLASH" }) },
            { tap: "KC_G", hold: action({ name: "Go to line", short: "Line", key: "G" }) },
            { tap: "KC_J", hold: action({ name: "Toggle panel", short: "Panel", key: "J" }) },
        ],
    },
    {
        id: "excel", name: "Excel", forApp: "excel", holds: [
            { tap: "KC_D", hold: action({ name: "Fill down", short: "Fill dn", key: "D" }) },
            { tap: "KC_R", hold: action({ name: "Fill right", short: "Fill rt", key: "R" }) },
            { tap: "KC_E", hold: action({ name: "Flash fill", short: "Flash", key: "E" }) },
            { tap: "KC_T", hold: action({ name: "Make table", short: "Table", key: "T" }) },
            { tap: "KC_B", hold: action({ name: "Bold", short: "Bold", key: "B" }) },
        ],
    },
    {
        id: "browser", name: "Browser", forApp: "chrome", holds: [
            { tap: "KC_T", hold: action({ name: "New tab", short: "New tab", key: "T" }) },
            { tap: "KC_W", hold: action({ name: "Close tab", short: "Close", key: "W" }) },
            { tap: "KC_R", hold: action({ name: "Reload", short: "Reload", key: "R" }) },
            { tap: "KC_L", hold: action({ name: "Address bar", short: "Addr", key: "L" }) },
            { tap: "KC_D", hold: action({ name: "Bookmark", short: "Bkmk", key: "D" }) },
            { tap: "KC_H", hold: action({ name: "History", short: "Hist", key: "H" }) },
        ],
    },
];

export function readySet(id: string): ReadySet | undefined {
    return READY_SETS.find(s => s.id === id);
}

/** Keys where a hold takes away key repeat: holding them no longer repeats. */
export const REPEAT_KEYS = new Set([
    "KC_BSPACE", "KC_BSPC", "KC_SPACE", "KC_SPC", "KC_LEFT", "KC_RIGHT", "KC_UP", "KC_DOWN", "KC_DELETE", "KC_DEL",
]);

/** What the Type key can send after flipping to home (per app). */
export const TYPE_SENDS: { code: string; name: string }[] = [
    { code: "", name: "Nothing" },
    { code: "KC_ENTER", name: "Enter" },
    { code: "KC_T", name: "T" },
    { code: "KC_SLASH", name: "/" },
];
