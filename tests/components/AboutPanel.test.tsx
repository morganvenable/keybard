import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AboutPanel from '../../src/layout/SecondarySidebar/Panels/AboutPanel';
import { KEYBARD_SOURCE_URL, KEYBR_SOURCE_URL, SVALBR_URL } from '../../src/constants/license';
import { OWNER_Q2_LICENSE } from '../../src/constants/owner-decisions';

describe('AboutPanel', () => {
    it('offers the source code and names the license (AGPL §13, spec §11)', () => {
        render(<AboutPanel />);
        expect(screen.getByText(new RegExp(`Licensed ${OWNER_Q2_LICENSE}`))).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Source code' })).toHaveAttribute('href', KEYBARD_SOURCE_URL);
    });

    it('credits keybr.com and svalbr', () => {
        render(<AboutPanel />);
        expect(screen.getByRole('link', { name: 'keybr.com' })).toHaveAttribute('href', KEYBR_SOURCE_URL);
        expect(screen.getByRole('link', { name: 'svalbr' })).toHaveAttribute('href', SVALBR_URL);
        expect(screen.getByText(/aradzie/)).toBeInTheDocument();
        expect(screen.getByText(/r-tae/)).toBeInTheDocument();
    });
});
