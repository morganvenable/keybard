// The firmware file this deploy carries, fetched from the same origin and checked by
// the sheet against its pin. One pair UF2 per release serves both halves.
// Keybard Paranoid fetches nothing: Install a firmware file only.

import { carriedFileUrl, type FirmwareReleasePin } from "@/constants/firmware-releases";
import { PARANOID } from "@/lib/paranoid";
import { PADTEST } from "@/lib/padtest";
import { PADTEST_FILES } from "@/generated/padtest-firmware";
import type { SvupFile } from "@/services/updater/svup";
import { loadFirmwareFile } from "@/services/updater/uf2";
import type { Hand } from "@/services/updater/protocol";

export async function loadCarriedRelease(release: FirmwareReleasePin, fetcher: typeof fetch = fetch): Promise<Record<Hand, SvupFile>> {
    if (PADTEST) {
        // The file is inside this page (the policy allows data: only): no request.
        const b64 = PADTEST_FILES[release.tag];
        if (!b64) throw new Error(`This test build doesn't carry ${release.tag}.`);
        const bin = atob(b64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        const file = await loadFirmwareFile(bytes);
        return { 0: file, 1: file } as Record<Hand, SvupFile>;
    }
    if (PARANOID) throw new Error("Keybard Paranoid installs only a file you choose.");
    const name = release.file.uf2;
    const res = await fetcher(carriedFileUrl(release, name), { cache: "no-store" });
    if (!res.ok) throw new Error(`Couldn't load ${name} (${res.status}).`);
    const file = await loadFirmwareFile(new Uint8Array(await res.arrayBuffer()));
    return { 0: file, 1: file } as Record<Hand, SvupFile>;
}
