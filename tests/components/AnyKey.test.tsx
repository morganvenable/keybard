import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnyKeyButton, AnyKeyTile } from '../../src/layout/SecondarySidebar/components/AnyKey';
import { keyService } from '../../src/services/key.service';

const assignKeycode = vi.fn();
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode }) }));

const type = (v: string) => fireEvent.change(screen.getByTestId('any-key-input'), { target: { value: v } });

beforeEach(() => assignKeycode.mockClear());

describe('Any key', () => {
    it('opens from the header button and assigns a name', () => {
        render(<AnyKeyButton />);
        expect(screen.queryByTestId('any-key-dialog')).toBeNull();
        fireEvent.click(screen.getByTestId('any-key-button'));
        type('LCTL(KC_A)');
        expect(screen.getByTestId('any-key-result').textContent).toContain('LCTL(KC_A)');
        fireEvent.click(screen.getByTestId('any-key-assign'));
        expect(assignKeycode).toHaveBeenCalledWith(0x0104);
        expect(screen.queryByTestId('any-key-dialog')).toBeNull();
    });

    it('opens from the More tile', () => {
        render(<AnyKeyTile />);
        fireEvent.click(screen.getByTestId('any-key-tile'));
        type('MO(3)');
        fireEvent.click(screen.getByTestId('any-key-assign'));
        expect(assignKeycode).toHaveBeenCalledWith(0x5223);
    });

    it('disables Assign for invalid input', () => {
        render(<AnyKeyTile />);
        fireEvent.click(screen.getByTestId('any-key-tile'));
        type('nonsense');
        expect(screen.getByTestId('any-key-assign')).toBeDisabled();
        type('0x10000');
        expect(screen.getByTestId('any-key-assign')).toBeDisabled();
        expect(assignKeycode).not.toHaveBeenCalled();
    });

    it('warns on an unknown code and assigns it only through Assign anyway', () => {
        render(<AnyKeyTile />);
        fireEvent.click(screen.getByTestId('any-key-tile'));
        type('0x9999');
        expect(screen.getByTestId('any-key-result').dataset.status).toBe('unknown');
        expect(screen.getByTestId('any-key-assign').textContent).toBe('Assign anyway');
        fireEvent.click(screen.getByTestId('any-key-assign'));
        expect(assignKeycode).toHaveBeenCalledWith(0x9999);
    });

    it('shows an unknown code as 0xNNNN', () => {
        expect(keyService.stringify(0x9999)).toBe('0x9999');
    });
});
