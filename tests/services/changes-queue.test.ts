import { describe, expect, it, vi } from 'vitest';
import { ChangeQueue } from '../../src/services/changes.service';

const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(r => { resolve = r; });
    return { promise, resolve };
};

describe('ChangeQueue', () => {
    it('stages without writing, and coalesces the whole write unit using the latest callback', async () => {
        const queue = new ChangeQueue(() => {});
        const first = vi.fn(async () => {}), latest = vi.fn(async () => {});
        queue.add('A', first, { writeKey: 'macros' });
        queue.add('B', latest, { writeKey: 'macros' });
        expect(first).not.toHaveBeenCalled();
        expect(latest).not.toHaveBeenCalled();
        expect(await queue.commit()).toBe(true);
        expect(first).not.toHaveBeenCalled();
        expect(latest).toHaveBeenCalledOnce();
    });
    it('serializes writes and preserves a newer edit to the in-flight key', async () => {
        const queue = new ChangeQueue(() => {});
        const gate = deferred();
        const writes: string[] = [];
        queue.add('A', async () => { writes.push('start'); await gate.promise; writes.push('end'); });
        const saving = queue.commit();
        await Promise.resolve();
        queue.add('A', async () => { writes.push('new'); });
        queue.add('B', async () => { writes.push('B'); });
        expect(queue.commit()).toBe(saving);
        expect(writes).toEqual(['start']);
        gate.resolve();
        expect(await saving).toBe(true);
        expect(writes).toEqual(['start', 'end', 'new', 'B']);
        expect(queue.pending).toEqual({});
    });
    it('retains failed and not-yet-written changes without acknowledging success; retries them', async () => {
        const acknowledge = vi.fn();
        const queue = new ChangeQueue(() => {}, () => true, () => acknowledge);
        const fail = vi.fn().mockRejectedValueOnce(new Error('USB failed')).mockResolvedValue(undefined);
        const last = vi.fn(async () => {});
        queue.add('A', async () => {});
        queue.add('B', fail);
        queue.add('C', last);
        expect(await queue.commit()).toBe(false);
        expect(queue.error).toBe('USB failed');
        expect(Object.keys(queue.pending)).toEqual(['B', 'C']);
        expect(last).not.toHaveBeenCalled();
        expect(acknowledge).not.toHaveBeenCalled();
        expect(await queue.commit()).toBe(true);
        expect(queue.error).toBeNull();
        expect(acknowledge).toHaveBeenCalledOnce();
    });
    it('does not write while disconnected and stops remaining writes after disconnect', async () => {
        let connected = false;
        const queue = new ChangeQueue(() => {}, () => connected);
        const first = vi.fn(async () => { connected = false; });
        const next = vi.fn(async () => {});
        queue.add('A', first); queue.add('B', next);
        expect(await queue.commit()).toBe(false);
        expect(first).not.toHaveBeenCalled();
        connected = true;
        expect(await queue.commit()).toBe(false);
        expect(first).toHaveBeenCalledOnce();
        expect(next).not.toHaveBeenCalled();
    });
    it('invalidates old session writes and acknowledgements even if a write was in flight', async () => {
        const acknowledged = vi.fn();
        const queue = new ChangeQueue(() => {}, () => true, () => acknowledged);
        const gate = deferred();
        const oldNext = vi.fn(async () => {});
        queue.add('A', () => gate.promise); queue.add('B', oldNext);
        const saving = queue.commit();
        await Promise.resolve();
        queue.reset();
        gate.resolve();
        expect(await saving).toBe(false);
        expect(oldNext).not.toHaveBeenCalled();
        expect(acknowledged).not.toHaveBeenCalled();
        expect(queue.pending).toEqual({});
    });
    it('suspends before a target switch, drains only the active write and resumes safely on cancellation', async () => {
        const queue = new ChangeQueue(() => {});
        const gate = deferred();
        const next = vi.fn(async () => {});
        queue.add('A', () => gate.promise); queue.add('B', next);
        const saving = queue.commit();
        await Promise.resolve();
        const suspending = queue.suspendAndDrain();
        gate.resolve();
        const release = await suspending;
        expect(await saving).toBe(false);
        expect(next).not.toHaveBeenCalled();
        expect(await queue.commit()).toBe(false);
        release(false);
        expect(await queue.commit()).toBe(true);
        expect(next).toHaveBeenCalledOnce();
    });
    it('discards old pending callbacks synchronously when a new target succeeds', async () => {
        const queue = new ChangeQueue(() => {});
        const old = vi.fn(async () => {});
        queue.add('A', old);
        const release = await queue.suspendAndDrain();
        release(true);
        expect(await queue.commit()).toBe(true);
        expect(old).not.toHaveBeenCalled();
    });

});
