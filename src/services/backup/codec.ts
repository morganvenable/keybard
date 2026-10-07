// Snapshot encoding: gzip for storage, SHA-256 for change detection.

async function pipeBytes(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
    const writer = stream.writable.getWriter();
    const written = writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close());
    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    await written;
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    return out;
}

export async function gzipText(text: string): Promise<Uint8Array> {
    return pipeBytes(new TextEncoder().encode(text), new CompressionStream("gzip"));
}

export async function gunzipText(bytes: Uint8Array): Promise<string> {
    return new TextDecoder().decode(await pipeBytes(bytes, new DecompressionStream("gzip")));
}

/**
 * Fields of a .svil that can differ between two saves of the same configuration.
 * kbinfoToSvil writes no timestamps today; anything added here is ignored when
 * deciding whether a board changed.
 */
const VOLATILE_SVIL_FIELDS: string[] = [];

/** The part of a .svil that identifies the configuration. */
export function fingerprintSource(svil: string): string {
    if (!VOLATILE_SVIL_FIELDS.length) return svil;
    const pattern = new RegExp(`^\\s*"(${VOLATILE_SVIL_FIELDS.join("|")})"\\s*:.*$`, "gm");
    return svil.replace(pattern, "");
}

export async function fingerprintSvil(svil: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintSource(svil)));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
