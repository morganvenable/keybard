// A scripted board for Live · USB tests: pollMatrix() waits until the test hands it the next matrix
// frame, so every sampler iteration is driven step by step on a manual clock. Nothing talks to WebHID.
import { vi } from 'vitest';
import type { LayerMasks } from '@/features/practice/input/usbSampler';

export const ROWS = 10;
export const COLS = 6;

/** A pollMatrix() reply with these matrix indices held. */
export function frame(down: readonly number[], rows = ROWS, cols = COLS): boolean[][] {
    const matrix = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
    for (const index of down) matrix[Math.floor(index / cols)][index % cols] = true;
    return matrix;
}

export class FakeBoard {
    now = 0;
    masks: LayerMasks = { active: 1, default: 1 };
    readonly pollMatrix = vi.fn(() => new Promise<boolean[][]>((resolve, reject) => { this.#waiting = { resolve, reject }; }));
    readonly getLayerMasks = vi.fn(async () => {
        if (this.masksFail) throw new Error('masks failed');
        return { ...this.masks };
    });
    masksFail = false;
    readonly sleeps: number[] = [];
    #waiting: { resolve: (m: boolean[][]) => void; reject: (e: Error) => void } | null = null;
    #sleepers: (() => void)[] = [];

    readonly clock = () => this.now;

    /** Sleeps resolve when the test calls wake(); a 0 ms yield resolves at once. */
    readonly sleep = (ms: number) => {
        this.sleeps.push(ms);
        if (ms === 0) return Promise.resolve();
        return new Promise<void>((resolve) => this.#sleepers.push(resolve));
    };

    get waiting(): boolean {
        return this.#waiting != null;
    }

    /** Waits for the sampler's request, then answers it at `t1` with these keys down. */
    async reply(down: readonly number[], t1: number) {
        await vi.waitFor(() => { if (!this.#waiting) throw new Error('no request in flight'); });
        const waiting = this.#waiting!;
        this.#waiting = null;
        this.now = t1;
        waiting.resolve(frame(down));
        await settle();
    }

    async fail(t1: number) {
        await vi.waitFor(() => { if (!this.#waiting) throw new Error('no request in flight'); });
        const waiting = this.#waiting!;
        this.#waiting = null;
        this.now = t1;
        waiting.reject(new Error('USB timeout'));
        await settle();
    }

    /** Ends every pending sleep (the retry and gate waits). */
    async wake() {
        const sleepers = this.#sleepers;
        this.#sleepers = [];
        for (const wake of sleepers) wake();
        await settle();
    }
}

/** Lets pending promise chains run. */
export async function settle() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}
