// Modified for Keybard: angleMod and angleWideMod depend on the ANSI/ISO zone
// tables, which are not vendored; only nullMod (used by Layout.custom) is kept.
import { type Geometry, type ZoneModDict } from "./geometry.ts";
import { type GeometryDict } from "./types.ts";

export type Mod = (geometry: Geometry, dict: GeometryDict) => GeometryDict;

export const nullMod: Mod = (_geometry: Geometry, dict: GeometryDict) => dict;

export function remapZones(dict: GeometryDict, mod: ZoneModDict): GeometryDict {
  return Object.fromEntries(
    Object.entries(dict).map(
      ([id, { x, y, w, h, labels, shape, zones, homing }]) => [
        id,
        { x, y, w, h, labels, shape, zones: mod[id] ?? zones, homing },
      ],
    ),
  );
}
