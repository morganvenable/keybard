import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChannelBanner, { STABLE_URL } from '../../src/components/ChannelBanner';

describe('ChannelBanner', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('marks the bleeding-edge build and links to the stable site', () => {
        vi.stubEnv('VITE_CHANNEL', 'next');
        render(<ChannelBanner />);
        expect(screen.getByRole('note').textContent).toContain('Bleeding edge: may break.');
        expect(screen.getByRole('link', { name: 'Use the stable version' }).getAttribute('href')).toBe(STABLE_URL);
    });

    it('shows nothing on other builds', () => {
        vi.stubEnv('VITE_CHANNEL', '');
        const { container } = render(<ChannelBanner />);
        expect(container.innerHTML).toBe('');
    });
});
