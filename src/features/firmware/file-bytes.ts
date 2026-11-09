// The bytes of a carried firmware file, for a download from the Install by hand screen.
// Order: already in memory (embedded in the page, or fetched and checked before), then
// fetched from the usual URL (hosted builds). The SHA-256 is checked against the pin
// before the bytes are offered. A page that can't fetch (Keybard Paranoid) and has no
// embedded copy returns null: the caller then uses the plain link.

import { carriedFileUrl, type FirmwareReleasePin } from "@/constants/firmware-releases";
import { PARANOID } from "@/lib/paranoid";
import { sha256Hex } from "@/services/updater/svup";
import { EMBEDDED_FILES } from "./embedded";

const verified = new Map<string, Uint8Array>();
const key = (r: FirmwareReleasePin) => `${r.tag}/${r.file.sha256}`;

/** Remember bytes that already matched their pin (the updater does this after loading). */
export function rememberVerified(release: FirmwareReleasePin, bytes: Uint8Array): void {
    verified.set(key(release), bytes);
}

export function forgetVerified(): void {
    verified.clear();
}

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export class FileCheckError extends Error {}

/** The file's bytes after the pin check; null when there is no way to get them here. */
export async function carriedBytes(
    release: FirmwareReleasePin,
    opts: { fetcher?: typeof fetch; embedded?: Record<string, string>; paranoid?: boolean } = {},
): Promise<Uint8Array | null> {
    const { fetcher = fetch, embedded = EMBEDDED_FILES, paranoid = PARANOID } = opts;
    let bytes: Uint8Array | undefined = verified.get(key(release));
    if (bytes) return bytes;
    const b64 = embedded[release.tag];
    if (b64) bytes = fromBase64(b64);
    else if (!paranoid) {
        const res = await fetcher(carriedFileUrl(release, release.file.uf2), { cache: "no-store" });
        if (!res.ok) throw new FileCheckError(`Couldn't load ${release.file.uf2} (${res.status}).`);
        bytes = new Uint8Array(await res.arrayBuffer());
    } else return null;
    if ((await sha256Hex(bytes)) !== release.file.sha256.toLowerCase()) {
        throw new FileCheckError(`${release.file.uf2} doesn't match its checksum, so Keybard won't offer it.`);
    }
    verified.set(key(release), bytes);
    return bytes;
}

/** Save bytes as a file with this name. */
export function saveBytes(bytes: Uint8Array, name: string): void {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
