import { describe, expect, it } from 'vitest';
import { contentWidth, fitBoard } from '@/features/practice/ui/boardFit';

// Board size rule (docs/practice/spec.md §5.1): the container is the page's content box, so the frame's
// px-6 padding is left out before the 32 px gutter.

describe('Board fit (§5.1)', () => {
    it('measures the content box: clientWidth less horizontal padding', () => {
        const el = document.createElement('div');
        el.style.paddingLeft = '24px';
        el.style.paddingRight = '24px';
        Object.defineProperty(el, 'clientWidth', { configurable: true, value: 1157 });
        expect(contentWidth(el)).toBe(1109);
    });

    it('a 1157 px frame with px-6 no longer picks the 1125 px medium board for a 1109 px content box', () => {
        // 25 units: medium is 25 × 45 = 1125 px, + 32 px gutter.
        expect(fitBoard(1157, 25).variant).toBe('medium');
        expect(fitBoard(1109, 25).variant).toBe('small');
        expect(fitBoard(1125 + 32, 25).variant).toBe('medium');
    });
});
