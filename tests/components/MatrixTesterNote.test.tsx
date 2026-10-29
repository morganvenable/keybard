import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MatrixTesterNote } from '../../src/components/MatrixTesterNote';

const lines = () => [...document.querySelectorAll('[data-tester-note-line]')].map((l) => l.textContent);

describe('MatrixTesterNote', () => {
    it('says typing is paused in two short lines, naming Esc', () => {
        render(<MatrixTesterNote kind="paused" exitName="Esc" />);
        expect(lines()).toEqual(['Typing paused while testing', 'Leave this screen to type again · Hold Esc 2 s to leave']);
        expect(screen.getByRole('status').textContent).not.toMatch(/Windows|Tab|Ctrl|media/);
    });

    it('names the real exit key when it is not Esc', () => {
        render(<MatrixTesterNote kind="paused" exitName="Left Thumb Down + Right Thumb Down" />);
        expect(lines()[1]).toBe('Leave this screen to type again · Hold Left Thumb Down + Right Thumb Down 2 s to leave');
    });

    it('on older firmware is one line with the update link', () => {
        const update = vi.fn();
        render(<MatrixTesterNote kind="unsupported" exitName="Esc" onUpdateFirmware={update} />);
        expect(lines()).toEqual(["Your firmware can't pause typing. Update to block keys while testing."]);
        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('has one look: no style choice', () => {
        render(<MatrixTesterNote kind="paused" exitName="Esc" />);
        expect(document.querySelector('[data-tester-note-style]')).toBeNull();
    });
});
