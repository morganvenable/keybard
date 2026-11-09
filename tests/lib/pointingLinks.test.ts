import { describe, expect, it } from 'vitest';
import { fakeBoardFromSearch, tuneFromSearch, tuneKindFromSearch } from '../../src/lib/deepLinks';
import { panelPositionFromSearch } from '../../src/lib/appearance-settings';

describe('review links for the Pointing Devices panel', () => {
    it('names a fake board for each pointing layout', () => {
        expect(fakeBoardFromSearch('?fakeBoard=pointing')).toBe('pointing');
        expect(fakeBoardFromSearch('?fakeBoard=two-balls')).toBe('two-balls');
        expect(fakeBoardFromSearch('?fakeBoard=ball-trackpoint')).toBe('ball-trackpoint');
        expect(fakeBoardFromSearch('?fakeBoard=no-module')).toBe('no-module');
    });

    it('opens a tuner modal with ?tune=', () => {
        expect(tuneKindFromSearch('?tune=touchpad')).toBe('touchpad');
        expect(tuneKindFromSearch('?panel=pointing&tune=Trackball')).toBe('trackball');
        expect(tuneKindFromSearch('?tune=other')).toBeNull();
        expect(tuneKindFromSearch('')).toBeNull();
        expect(tuneFromSearch('?tune=touchpad')).toBe(true);
        expect(tuneFromSearch('?tune=trackball')).toBe(false);
    });

    it('puts the panel in the tray or the sidebar for one load with ?panelPosition=', () => {
        expect(panelPositionFromSearch('?panelPosition=bottombar')).toBe('bottombar');
        expect(panelPositionFromSearch('?panelPosition=tray')).toBe('bottombar');
        expect(panelPositionFromSearch('?panelPosition=sidebar')).toBe('sidebar');
        expect(panelPositionFromSearch('?panelPosition=auto')).toBeNull();
        expect(panelPositionFromSearch('')).toBeNull();
    });
});
