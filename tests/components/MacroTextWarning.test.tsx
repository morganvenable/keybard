import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MacroEditorText from '@/layout/SecondarySidebar/components/BindingEditor/MacroEditorText';
import MacroTextWarning from '@/layout/SecondarySidebar/components/BindingEditor/MacroTextWarning';

describe('MacroTextWarning', () => {
    it('shows nothing for text the keyboard can type', () => {
        const { container } = render(<MacroTextWarning text={'Hello, world!\n\t'} />);
        expect(container).toBeEmptyDOMElement();
    });
    it('names one character', () => {
        render(<MacroTextWarning text="5µs" />);
        expect(screen.getByRole('status').textContent).toBe("The keyboard can't type µ. It will skip it.");
    });
    it('names several characters', () => {
        render(<MacroTextWarning text={'“µ” '} />);
        expect(screen.getByRole('status').textContent).toBe("The keyboard can't type “, µ, ” and U+00A0. It will skip them.");
    });
    it('uses the warning color tokens', () => {
        render(<MacroTextWarning text="é" />);
        expect(screen.getByRole('status').className).toMatch(/text-kb-warn-ink/);
        expect(screen.getByRole('status').className).toMatch(/bg-kb-warn-bg/);
    });
});

describe('macro text editor', () => {
    it('warns under a text action and not under a delay', () => {
        const { rerender } = render(<MacroEditorText type="text" value="café" onChange={vi.fn()} />);
        expect(screen.getByRole('status').textContent).toContain('é');
        rerender(<MacroEditorText type="text" value="cafe" onChange={vi.fn()} />);
        expect(screen.queryByRole('status')).toBeNull();
        rerender(<MacroEditorText type="delay" value={100} onChange={vi.fn()} />);
        expect(screen.queryByRole('status')).toBeNull();
    });
});

describe('macro text warning contrast', () => {
    it('meets WCAG AA in light and dark', async () => {
        const { readFileSync } = await import('node:fs');
        const { contrastRatio } = await import('@/lib/theme');
        const css = readFileSync('src/index.css', 'utf8');
        const values = (name: string) => [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map(m => m[1]);
        const ink = values('kb-warn-ink');
        const bg = values('kb-warn-bg');
        expect(ink.length).toBeGreaterThanOrEqual(2);
        expect(ink.length).toBe(bg.length);
        ink.forEach((c, i) => expect(contrastRatio(c, bg[i])).toBeGreaterThanOrEqual(4.5));
    });
});
