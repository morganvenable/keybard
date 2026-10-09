/**
 * App-wide color roles (docs/practice/spec.md D13, §5.0.1, §5.17).
 *
 * Each hue has one meaning on every Keybard screen:
 * - select (kb-select*): "this is the one you picked" — a selected key, a
 *   selected row, a drop target, a held key in Matrix Tester (strong form);
 * - pending (kb-pending): "changed, not yet sent or saved" — always dashed,
 *   so it reads on any key face, never only by hue;
 * - red: errors, destructive actions and wrong keys only. The theme guard's
 *   red-reserved rule (tests/theme) fails on any other red utility.
 *
 * The tokens are defined in src/index.css. OWNER_Q10_NEW_COLOR_ROLES
 * (constants/owner-decisions.ts) records the owner's decision to keep these
 * roles after the trial on next.keybard; nothing switches on it, because
 * going back to red selection means reverting milestone MC.
 */

/**
 * Selected key (and a key under a drag that will drop on it): light tint face,
 * ink legend, 2 px ring outside the key with a 1 px gap. z-10 so the ring paints
 * over the neighbors, because editor keys are drawn edge to edge.
 */
export const SELECTED_KEY_CLASSES =
    "z-10 bg-kb-select-tint text-kb-ink border-kb-key-border ring-2 ring-kb-select ring-offset-1 ring-offset-background";

/**
 * Header and footer strips on a selected key: replaces the dark bg-black/30 strip,
 * which would put white text on a light face. The group-hover partner overrides the
 * layer's hover strip (colors.ts hoverHeaderClasses), so hovering a selected key keeps it light.
 */
export const SELECTED_STRIP_CLASSES = "bg-kb-select-strip text-kb-ink group-hover:bg-kb-select-strip";

/**
 * Selected binding-editor slot (combo, tap dance, leader...; mockup M-37 `.slotk.n-sel`):
 * a 2 px select border on the tint and no ring. Passed as Key's className on top of
 * SELECTED_KEY_CLASSES, so it also cancels that ring and its offset: the slot sits in a
 * labelled column, and a ring around the border would draw a double outline.
 */
export const SELECTED_SLOT_CLASSES = "border-2 border-kb-select bg-kb-select-tint ring-0 ring-offset-0";

/** Default key hover: the selection ring it previews, outside the key. Rings are box-shadows, so nothing shifts. */
export const HOVER_RING_CLASSES =
    "hover:z-10 hover:ring-2 hover:ring-kb-select hover:ring-offset-1 hover:ring-offset-background";

/** Key with an unsent edit. Shown on selected keys too: the ring sits outside, the dashed border on the key's edge. */
export const PENDING_KEY_CLASSES = "border-2 border-dashed border-kb-pending";

/**
 * Matrix Tester held key (strong select): a mid-blue face that clears 3:1 against
 * both the white "never pressed" and the black "was pressed" faces, under a 3 px ring.
 */
export const HELD_KEY_CLASSES =
    "z-10 bg-kb-select-strong ring-[3px] ring-kb-select ring-offset-2 ring-offset-background";

/** Selected list row (Leaders, Alt-Repeat). */
export const SELECTED_ROW_CLASSES = "ring-2 ring-kb-select";

/** A button waiting on pending edits (Apply N Changes): dashed amber outline around the pill. */
export const PENDING_OUTLINE_CLASSES = "outline-2 outline-dashed outline-kb-pending outline-offset-2";
