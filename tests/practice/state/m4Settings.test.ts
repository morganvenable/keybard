import { afterEach, describe, expect, it, vi } from 'vitest';
import { drillScopeLabel } from '@/features/practice/lessons/scope';
import { DEFAULT_DRILL, practiceSettings } from '@/features/practice/state/settings';
import { resetHarness, startController } from '../ui/harness';

// M4 settings (spec §5.7, §5.8, §5.9): the heatmap metric, Include keystrokes, and the Drill this group name.

const cp = (s: string) => s.codePointAt(0)!;

afterEach(() => resetHarness());

describe('M4 settings', () => {
    it('validates the heatmap metric, Include keystrokes and a drill group name', () => {
        expect(practiceSettings({}).heatMetric).toBe('speed');
        expect(practiceSettings({ heatMetric: 'usage' }).heatMetric).toBe('usage');
        expect(practiceSettings({ heatMetric: 'heat' }).heatMetric).toBe('speed');
        expect(practiceSettings({}).exportKeystrokes).toBe(true);
        expect(practiceSettings({ exportKeystrokes: false }).exportKeystrokes).toBe(false);
        expect(practiceSettings({ drill: { keys: [97, 115, 100], name: 'L-pinky' } }).drill.name).toBe('L-pinky');
        // A name needs its keys; it is cut to 60 characters.
        expect(practiceSettings({ drill: { name: 'L-pinky' } }).drill.name).toBeNull();
        expect(practiceSettings({ drill: { keys: [97], name: 'x'.repeat(80) } }).drill.name).toHaveLength(60);
    });

    it('the type row names a drilled group', () => {
        expect(drillScopeLabel({ ...DEFAULT_DRILL, keys: [97, 115], name: 'L-middle · N' }, (l) => `Layer ${l}`, ['C', 'N'])).toBe('L-middle · N');
        expect(drillScopeLabel({ ...DEFAULT_DRILL, keys: [97, 115], focus: 97 }, (l) => `Layer ${l}`, ['C', 'N'])).toBe('a and its cluster');
    });

    it('Drill this group drills the group’s characters, focus on the weakest; a panel change ends it', async () => {
        const c = await startController();
        c.drillGroup([cp('a'), cp('A'), cp('1'), cp('q'), cp(' ')], 'L-pinky');
        expect(c.settings.type).toBe('drill');
        expect(c.settings.drill).toMatchObject({ name: 'L-pinky', focus: null });
        // A capital drills its letter; Space has nothing to drill.
        expect([...c.settings.drill.keys!].sort()).toEqual([cp('1'), cp('a'), cp('q')].sort());
        await vi.waitFor(() => expect(c.session?.type).toBe('drill'));
        expect(c.session!.lessonKeys.findIncludedKeys().map((k) => k.letter.codePoint).sort()).toEqual([cp('1'), cp('a'), cp('q')].sort());
        c.updateDrill({ group: 'letters' });
        expect(c.settings.drill).toMatchObject({ keys: null, name: null });
        // Drill this key clears a group's name.
        c.drillGroup([cp('a'), cp('s'), cp('d')], 'L-ring');
        c.drillKey(cp('a'));
        expect(c.settings.drill.name).toBeNull();
        expect(c.drillableOf([cp(' '), cp('\n')])).toEqual([]);
    });
});
