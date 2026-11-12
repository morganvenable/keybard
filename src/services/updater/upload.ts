// Sending the staged image: the one part of an update whose speed depends on the link.
//
// The update's state machine (flow.ts) does BEGIN, waits for RECEIVING, hands the image to
// an uploader, then does END, the verify and COMMIT. The uploader only gets the bytes from
// `from` to the end into the board's slot, in order; the board's END (SHA-512 over the whole
// image) is the check, never the uploader. So another link can bring its own uploader (a
// WebUSB bulk endpoint, say) without any change to the update itself.
//
// - stopAndWait: one CHUNK, its reply, the next. Every board takes it.
// - windowed: up to the board's window of CHUNKs back to back (INFO UPLOAD_CHUNK_WINDOW),
//   then their replies. A board that misses one answers OUT_OF_ORDER with its offset for the
//   rest, and the uploader goes back to that offset; a reply that never comes is a timeout,
//   and the uploader asks STATUS where the board is and goes on from there.

import { UpdaterStatusError, type UpdaterClient } from "./client";
import { CHUNK_PIECE_MAX, State, Status, UPLOAD_CHUNK_WINDOW, type Hand } from "./protocol";
import { ReplyTimeoutError } from "./transport";

export interface UploadJob {
    client: UpdaterClient;
    hand: Hand;
    image: Uint8Array;
    /** The board already holds [0, from): STATUS's staged count after BEGIN. */
    from: number;
    /** Bytes the board has taken so far. */
    onProgress(staged: number): void;
    /** Throws to stop (the user cancelled). Called between round trips. */
    checkCancel(): void;
}

export interface ImageUploader {
    /** For measurements and the trace: "stop-and-wait", "window-16", ... */
    readonly name: string;
    upload(job: UploadJob): Promise<void>;
}

/** Board figures the choice depends on (INFO page 0 of the half with USB). */
export interface UploadCaps {
    uploadFlags: number;
    chunkWindow: number;
}

/** A reply lost on the way back, at most this many times in a row, before the update stops. */
const TIMEOUT_RESYNCS = 3;

function piece(image: Uint8Array, off: number): Uint8Array {
    return image.subarray(off, Math.min(off + CHUNK_PIECE_MAX, image.length));
}

/** Today's upload: one CHUNK per round trip. */
export const stopAndWait: ImageUploader = {
    name: "stop-and-wait",
    async upload({ client, hand, image, from, onProgress, checkCancel }) {
        let off = from;
        while (off < image.length) {
            const { status, next } = await client.chunk(hand, off, piece(image, off));
            if (status === Status.OK) off = next;
            else if (status === Status.OUT_OF_ORDER && next <= image.length) off = next;
            else throw new UpdaterStatusError("CHUNK", status);
            checkCancel();
            onProgress(off);
        }
    },
};

/**
 * Up to `window` CHUNKs in flight, sliding: the next goes out as each reply comes back. One
 * call to the transport carries BATCH_WINDOWS windows, so progress and Cancel are checked
 * every few tens of ms. Resend from the board's offset when one is missed.
 */
const BATCH_WINDOWS = 4;

export function windowed(window: number): ImageUploader {
    const size = Math.max(1, Math.floor(window));
    const batch = size * BATCH_WINDOWS;
    return {
        name: `window-${size}`,
        async upload({ client, hand, image, from, onProgress, checkCancel }) {
            let off = from;
            let lost = 0;
            while (off < image.length) {
                const pieces: Array<[number, Uint8Array]> = [];
                for (let o = off; o < image.length && pieces.length < batch; o += CHUNK_PIECE_MAX) pieces.push([o, piece(image, o)]);
                let replies: Array<{ status: number; next: number }>;
                try {
                    replies = await client.chunks(hand, pieces, size);
                    lost = 0;
                } catch (error) {
                    if (!(error instanceof ReplyTimeoutError) || ++lost > TIMEOUT_RESYNCS) throw error;
                    // A reply went missing: the board says where it is, and the upload goes on from there.
                    // That STATUS may time out too (the board briefly busy): it counts against the same
                    // budget, and the next batch starts from the last offset known.
                    let st;
                    try {
                        st = await client.status(hand);
                    } catch (statusError) {
                        if (!(statusError instanceof ReplyTimeoutError) || ++lost > TIMEOUT_RESYNCS) throw statusError;
                        continue;
                    }
                    if (st.state !== State.RECEIVING) throw new UpdaterStatusError("STATUS", st.lastError || Status.INVALID, st.state);
                    off = st.staged;
                    checkCancel();
                    onProgress(off);
                    continue;
                }
                for (const { status, next } of replies) {
                    if (status === Status.OK) { off = Math.max(off, next); continue; }
                    // The board missed one: everything after it is OUT_OF_ORDER with its offset.
                    if (status === Status.OUT_OF_ORDER && next <= image.length) { off = next; break; }
                    throw new UpdaterStatusError("CHUNK", status);
                }
                checkCancel();
                onProgress(off);
            }
        },
    };
}

/**
 * The fastest uploader this board and this link both take. A board that doesn't report the
 * window (any build before it) always gets stopAndWait: Keybard never sends it a burst.
 */
export function chooseUploader(caps: UploadCaps | null | undefined, canBurst: boolean): ImageUploader {
    if (caps && canBurst && caps.uploadFlags & UPLOAD_CHUNK_WINDOW && caps.chunkWindow > 1) return windowed(caps.chunkWindow);
    return stopAndWait;
}
