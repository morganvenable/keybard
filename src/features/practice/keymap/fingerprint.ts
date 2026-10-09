// Keymap fingerprint (spec §9.4): SHA-256 of the resolved paths, the default
// layer and the OS layout. A snapshot is used only while the fingerprint matches
// (§6.8). Momentary layer state is not part of it.
import type { KeymapResolution } from './resolver';

/** The canonical text the fingerprint hashes. Stable across runs. */
export function fingerprintSource(resolution: KeymapResolution): string {
    const lines = [`v1|default=${resolution.defaultLayer}|layout=${resolution.layoutId}`];
    for (const [char, paths] of resolution.paths) {
        lines.push(`${char}=${paths.map((p) => `${p.key}<${p.prereqs.map((q) => `${q.kind[0]}${q.index}`).join('+')}`).join(',')}`);
    }
    return lines.join('\n');
}

/** Hex SHA-256 of fingerprintSource(). */
export async function keymapFingerprint(resolution: KeymapResolution): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintSource(resolution)));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The 4-hex-digit form shown in the UI. */
export function shortFingerprint(fingerprint: string): string {
    return fingerprint.slice(0, 4);
}
