import { describe, it, expect } from 'vitest';
import * as groups from '../../src/constants/special-key-groups';
import { isUnbuiltKeycode } from '../../src/constants/unbuilt-keycodes';
import { keyService } from '../../src/services/key.service';
import { applyKeycodeNumbering, LATEST_KEYCODE_VERSION } from '../../src/constants/keycode-numbering';

type Def = { keycode: string };
const all: Def[] = [];
for (const v of Object.values(groups)) {
    if (!Array.isArray(v)) continue;
    for (const item of v as unknown[]) {
        const g = item as { keys?: Def[]; keycode?: string };
        if (g.keys) all.push(...g.keys);
        else if (g.keycode) all.push(g as Def);
    }
}

describe('special key groups', () => {
    it('every keycode resolves to a real code', () => {
        applyKeycodeNumbering(LATEST_KEYCODE_VERSION);
        const bad = all.filter((d) => {
            const n = keyService.parse(d.keycode);
            return !Number.isFinite(n) || n === 0xff && d.keycode !== 'KC_NO';
        }).map((d) => d.keycode);
        expect(bad).toEqual([]);
    });

    it('lists no keycode twice', () => {
        const names = all.map((d) => d.keycode);
        expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
        const codes = all.map((d) => keyService.parse(d.keycode));
        const dupCodes = all.filter((d, i) => codes.indexOf(codes[i]) !== i).map((d) => d.keycode);
        expect(dupCodes).toEqual([]);
    });

    it('lists nothing from a feature the firmware does not build', () => {
        expect(all.length).toBeGreaterThan(80);
        expect(all.map((d) => d.keycode).filter(isUnbuiltKeycode)).toEqual([]);
    });
});
