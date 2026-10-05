export interface PendingChange {
    desc: string;
    writeKey?: string;
    deferCommit?: boolean;
    cb: () => Promise<void>;
    timestamp: number;
    // Metadata for UI display and tracking
    type: "key" | "macro" | "combo" | "tapdance" | "override" | "setting" | "label" | "custom_ui";
    layer?: number;
    row?: number;
    col?: number;
    keycode?: number;
    comboId?: number;
    comboSlot?: number;
    tapdanceId?: number;
    tapdanceSlot?: "tap" | "hold" | "doubletap" | "taphold";
    previousValue?: number | string;
}

// Simple utility functions for the changes queue - no class or listeners needed
export const changesUtils = {
    /**
     * Execute a change immediately or return it for queueing
     */
    async processChange(desc: string, cb: () => Promise<void>, metadata: Partial<PendingChange>, instant: boolean): Promise<PendingChange | null> {
        if (instant) {
            await cb();
            return null; // No need to queue
        } else {
            return {
                desc,
                cb,
                timestamp: Date.now(),
                type: metadata?.type || "key",
                ...metadata,
            };
        }
    },

    /**
     * Commit all pending changes
     */
    async commitChanges(todo: Record<string, PendingChange>): Promise<void> {
        for (const [, change] of Object.entries(todo)) {
            if (change && change.cb) {
                await change.cb();
            }
        }
    },

    /**
     * Helper functions for querying changes
     */
    getChangesForLayer(todo: Record<string, PendingChange>, layer: number): PendingChange[] {
        return Object.values(todo).filter((change) => change.layer === layer);
    },

    getChangesByType(todo: Record<string, PendingChange>, type: PendingChange["type"]): PendingChange[] {
        return Object.values(todo).filter((change) => change.type === type);
    },

    hasPendingChangeForKey(todo: Record<string, PendingChange>, layer: number, row: number, col: number): boolean {
        return Object.values(todo).some((change) => change.type === "key" && change.layer === layer && change.row === row && change.col === col);
    },

    getPendingChangeForKey(todo: Record<string, PendingChange>, layer: number, row: number, col: number): PendingChange | null {
        return Object.values(todo).find((change) => change.type === "key" && change.layer === layer && change.row === row && change.col === col) || null;
    },
};

/** Serial, revision-aware write queue. Failed entries and later edits remain retryable. */
export class ChangeQueue {
    pending: Record<string, PendingChange> = {};
    isSaving = false;
    error: string | null = null;
    private generation = 0;
    private suspended = false;
    private active: Promise<boolean> | null = null;
    constructor(private notify: () => void, private canWrite: () => boolean = () => true, private captureSave?: () => (() => void)) {}

    add(desc: string, cb: () => Promise<void>, metadata: Partial<PendingChange> = {}) {
        const key = metadata.writeKey || desc;
        this.pending = { ...this.pending, [key]: { ...metadata, desc, cb, timestamp: Date.now(), type: metadata.type || "key" } };
        this.notify();
    }
    clear(key: string) {
        if (this.isSaving) return;
        const next = { ...this.pending };
        delete next[key];
        this.pending = next;
        this.notify();
    }
    reset() {
        this.generation++;
        this.pending = {};
        this.error = null;
        this.notify();
    }
    async suspendAndDrain(): Promise<(discardPending?: boolean) => void> {
        this.suspended = true;
        if (this.active) await this.active;
        return (discardPending = false) => {
            if (discardPending) this.reset();
            this.suspended = false;
        };
    }
    commit(): Promise<boolean> {
        if (this.suspended) return Promise.resolve(false);
        if (this.active) return this.active;
        if (!Object.keys(this.pending).length) return Promise.resolve(true);
        this.isSaving = true;
        this.error = null;
        const generation = this.generation;
        this.notify();
        this.active = Promise.resolve().then(async () => {
            let acknowledge: (() => void) | undefined;
            try {
                while (generation === this.generation && Object.keys(this.pending).length) {
                    if (this.suspended) return false;
                    if (!this.canWrite()) throw new Error("Keyboard disconnected. Reconnect before applying changes.");
                    const [key, change] = Object.entries(this.pending)[0];
                    acknowledge = this.captureSave?.();
                    await change.cb();
                    if (!this.canWrite()) throw new Error("Keyboard disconnected before the save could be confirmed.");
                    if (generation !== this.generation) return false;
                    // Do not erase a newer edit queued while this write was in flight.
                    if (this.pending[key] === change) {
                        const next = { ...this.pending };
                        delete next[key];
                        this.pending = next;
                    }
                    this.notify();
                }
                if (generation === this.generation) acknowledge?.();
                return generation === this.generation;
            } catch (error) {
                if (generation === this.generation) {
                    this.error = error instanceof Error ? error.message : String(error);
                }
                return false;
            } finally {
                this.isSaving = false;
                this.active = null;
                this.notify();
            }
        });
        return this.active;
    }
}
