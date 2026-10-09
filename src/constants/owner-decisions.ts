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
 * Recommended: AGPL-3.0-or-later. Applied on branch feat/practice-engine in its own
 * commit ("License Keybard as AGPL-3.0-or-later (OWNER_Q2)": package.json `license`
 * and the root LICENSE file), so it can be dropped or changed on its own. About's
 * "Source code" line and the Paranoid file's notice read it (constants/license.ts,
 * build/paranoid.ts via package.json); tests/build/license.test.ts keeps them in step.
 * NEEDS OWNER SIGN-OFF before merging to svalboard/keybard: -or-later vs -only.
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

/**
 * Q11 (raised by the M1b review; not in spec rev 3). Caps Lock is on outranks the
 * persistent Storage off and Newer schema notices in the status slot. Under the
 * spec's §5.2 order those two never clear, so in a private window Caps Lock would
 * drop every keystroke with no visible reason. Recommended: yes. false restores
 * the spec's order exactly.
 */
export const OWNER_Q11_CAPS_LOCK_OUTRANKS_STORAGE = true;

/**
 * Q12 (raised by M2; not in spec rev 3). While **Layer N is locked on** shows (§5.3,
 * Live · USB), keystrokes are dropped like Caps Lock's: not saved and the lesson
 * doesn't advance. The spec says only "excluded from stats"; with a layer stuck on,
 * nearly every character typed is wrong, so counting the lesson on would fill it
 * with misses the user can't fix until the layer is off. Recommended: yes. false
 * keeps the notice but counts the keystrokes normally.
 */
export const OWNER_Q12_LAYER_LOCK_DROPS_KEYSTROKES = true;
