import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnyKeyButton, AnyKeyTile } from '../../src/layout/SecondarySidebar/components/AnyKey';
import { keyService } from '../../src/services/key.service';

const assignKeycode = vi.fn();
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode }) }));

const type = (v: string) => fireEvent.change(screen.getByTestId('any-key-input'), { target: { value: v } });

beforeEach(() => assignKeycode.mockClear());

describe('Custom keycode', () => {
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

    it('uses the Custom keycode wording everywhere', () => {
        render(<><AnyKeyButton /><AnyKeyTile /></>);
        const button = screen.getByTestId('any-key-button');
        expect(button.textContent).toBe('Custom keycode');
        expect(button.getAttribute('aria-label')).toBe('Custom keycode');
        expect(button.getAttribute('title')).toBe('Custom keycode');
        expect(screen.getByText('Custom keycode', { selector: 'span' })).toBeTruthy();
        expect(screen.getByTestId('any-key-tile').textContent).toBe('Enter keycode');
        fireEvent.click(screen.getByTestId('any-key-tile'));
        expect(screen.getByText('Enter a custom keycode')).toBeTruthy();
        expect(screen.getByText('Hex, decimal or QMK name, for example LCTL(KC_A)')).toBeTruthy();
        expect(document.body.textContent).not.toMatch(/Any key/);
    });

    it('draws the tile with the key tokens, not a solid black square', () => {
        render(<AnyKeyTile />);
        const cls = screen.getByTestId('any-key-tile').className;
        expect(cls).toContain('bg-kb-sidebar-base');
        expect(cls).not.toContain('bg-kb-sidebar-dark');
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
