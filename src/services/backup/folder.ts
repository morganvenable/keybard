// Writes backups into a user-chosen folder (File System Access API).
//
// Layout: "<board name> (<serial>)/latest.svil" plus "YYYY-MM-DD.svil" per day
// with changes. Only files recorded in the manifest (files this writer created)
// are ever deleted.

import { dayKey, datedFilesToKeep, isDailyWindow } from "./retention";
import type { SnapshotMeta } from "./store";

export interface FolderWritable {
    write(data: string): Promise<void>;
    close(): Promise<void>;
}

export interface FolderFileHandle {
    createWritable(): Promise<FolderWritable>;
}

export type FolderPermission = "granted" | "denied" | "prompt";

/** The subset of FileSystemDirectoryHandle backups use. */
export interface FolderDirectoryHandle {
    name: string;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FolderDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FolderFileHandle>;
    removeEntry(name: string): Promise<void>;
    queryPermission?(descriptor: { mode: "readwrite" }): Promise<FolderPermission>;
    requestPermission?(descriptor: { mode: "readwrite" }): Promise<FolderPermission>;
}

export interface BoardManifest {
    /** Directory name under the backup folder. */
    dir: string;
    /** File name -> fingerprint of the snapshot written there. */
    files: Record<string, string>;
}

export interface FolderManifest {
    boards: Record<string, BoardManifest>;
}

export const emptyManifest = (): FolderManifest => ({ boards: {} });

export const LATEST_FILE = "latest.svil";
const DATED_FILE = /^(\d{4}-\d{2}-\d{2})\.svil$/;

/** Thrown when the chosen folder no longer exists (moved or deleted). */
export class FolderGoneError extends Error {
    constructor() { super("The backup folder is no longer available."); }
}

const errorName = (error: unknown) => (error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "");

export function isPermissionError(error: unknown): boolean {
    return errorName(error) === "NotAllowedError" || errorName(error) === "SecurityError";
}

function safeName(text: string): string {
    // Windows, macOS and Linux all accept the result.
    return text.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").trim();
}

export function boardFolderName(boardName: string, boardKey: string): string {
    const name = safeName(boardName) || "Keyboard";
    return `${name} (${safeName(boardKey)})`;
}

export class FolderBackupWriter {
    constructor(private root: FolderDirectoryHandle) {}

    /**
     * Bring one board's directory up to date with its snapshots: latest.svil,
     * and one file per day (within the daily window) holding that day's latest
     * snapshot. Updates `manifest` in place. Days already written are skipped,
     * so calling this after a pause writes out exactly what the folder missed.
     */
    async syncBoard(
        boardKey: string,
        snapshots: SnapshotMeta[],
        loadSvil: (id: string) => Promise<string>,
        manifest: FolderManifest,
        now: number,
    ): Promise<number> {
        const own = snapshots.filter((s) => s.boardKey === boardKey).sort((a, b) => b.savedAt - a.savedAt);
        if (!own.length) return 0;
        const latest = own[0];
        const dirName = boardFolderName(latest.boardName, boardKey);
        let entry = manifest.boards[boardKey];
        if (!entry || entry.dir !== dirName) {
            // A renamed board gets a new directory; the old one is left alone.
            entry = { dir: dirName, files: {} };
            manifest.boards[boardKey] = entry;
        }

        const wanted = new Map<string, SnapshotMeta>();
        wanted.set(LATEST_FILE, latest);
        for (const snap of own) {
            const day = dayKey(snap.savedAt);
            const name = `${day}.svil`;
            if (!wanted.has(name) && isDailyWindow(day, now)) wanted.set(name, snap);
        }

        let dir: FolderDirectoryHandle | null = null;
        const openDir = async () => {
            if (!dir) dir = await this.call(() => this.root.getDirectoryHandle(dirName, { create: true }));
            return dir;
        };

        let written = 0;
        for (const [name, snap] of wanted) {
            if (entry.files[name] === snap.fingerprint) continue;
            const content = await loadSvil(snap.id);
            const d = await openDir();
            const file = await this.call(() => d.getFileHandle(name, { create: true }));
            const writable = await this.call(() => file.createWritable());
            await this.call(() => writable.write(content));
            await this.call(() => writable.close());
            entry.files[name] = snap.fingerprint;
            written++;
        }

        // Retention: only files listed in the manifest are candidates.
        const dated = Object.keys(entry.files).map((n) => DATED_FILE.exec(n)?.[1]).filter((d): d is string => !!d);
        const keep = datedFilesToKeep(dated, now);
        for (const day of dated) {
            if (keep.has(day)) continue;
            const name = `${day}.svil`;
            const d = await openDir();
            try {
                await d.removeEntry(name);
            } catch (error) {
                if (errorName(error) !== "NotFoundError") throw this.translate(error);
            }
            delete entry.files[name];
        }
        return written;
    }

    private async call<T>(op: () => Promise<T>): Promise<T> {
        try {
            return await op();
        } catch (error) {
            throw this.translate(error);
        }
    }

    private translate(error: unknown): unknown {
        return errorName(error) === "NotFoundError" ? new FolderGoneError() : error;
    }
}
