// Owner decisions for Practice, Overlay and the color roles.
//
// Each open question in docs/practice/spec.md §13.2 is stubbed here with the
// spec's recommended answer, so it can be changed in one place later. Code
// that depends on a question must read it from this file, never hard-code it.
// Search for `OWNER_Q` to find every place a question is used.

/** Q1. Default unlock order for new "Learn" profiles (§6.3). Recommended: center first. */
export const OWNER_Q1_DEFAULT_UNLOCK_ORDER: 'center-first' | 'frequency' = 'center-first';

/**
 * Q2. Keybard's license identifier, needed before the vendored keybr engine merges.
 * Recommended: AGPL-3.0-or-later. Not applied to package.json/LICENSE yet; that
 * change is a separate, owner-approved commit.
 */
export const OWNER_Q2_LICENSE = 'AGPL-3.0-or-later';

/** Q3. Keybard Host as a live input source for Practice (M5). Recommended: no for now. */
export const OWNER_Q3_HOST_INPUT_SOURCE = false;

/** Q4. Paranoid build: Practice may read key presses while open and focused. Recommended: yes. */
export const OWNER_Q4_PARANOID_READS_KEYS = true;

/** Q5. Per-keystroke event retention, in lessons per profile. Results and aggregates are kept forever. */
export const OWNER_Q5_EVENT_RETENTION_LESSONS = 1000;

/** Q6. Profile scope. Recommended: one local profile chosen by the user, never by the board. */
export const OWNER_Q6_PROFILE_SCOPE: 'user' | 'per-board' = 'user';

/** Q7. The M0 lab view (`?practiceLab=1#practice/lab`) is reachable. Recommended: not in production. */
export const OWNER_Q7_LAB_VIEW_ENABLED = import.meta.env.MODE !== 'svalboard';

/** Q8. The 16 new components in §5.0.3 are approved as a whole. Informational; no code switch. */
export const OWNER_Q8_NEW_COMPONENTS_APPROVED = true;

/** Q9. Color-blind heat palette setting. Recommended: not in v1. */
export const OWNER_Q9_COLORBLIND_HEAT_SETTING = false;

/** Q10. Keep the new color roles (selected blue, pending amber, red for errors) after the trial. */
export const OWNER_Q10_NEW_COLOR_ROLES = true;
