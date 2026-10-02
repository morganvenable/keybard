import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScanLabPanel from '../../src/layout/SecondarySidebar/Panels/ScanLabPanel';
import type { ProbeRow, ScanLabStatus } from '../../src/services/scanlab.service';

const vial = { isConnected: true, connect: vi.fn() };
const layoutSettings = { layoutMode: 'sidebar' as 'sidebar' | 'bottombar', keyVariant: 'default' };

vi.mock('@/contexts/VialContext', () => ({ useVial: () => vial }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => layoutSettings }));
vi.mock('@/layout/SecondarySidebar/components/DescriptionBlock', () => ({
    default: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock('@/services/custom-value.service', () => ({ customValueService: { setCached: vi.fn() } }));

const status = (over: Partial<ScanLabStatus>): ScanLabStatus => ({
    reachable: true, protoVersion: 1, hwRevision: 1, sweepState: 0, framesDone: 0, framesTarget: 0, refValid: false,
    effPrewaitUs: 200, effPostwaitUs: 200, isLeft: true, fingerPushedMask: 0b000100, thumbPushedMask: 0,
    probeValid: false, probeRow: 0, savedPrewaitUs: 200, savedPostwaitUs: 200, turboIndex: 0, otherHalfConnected: true,
    ...over,
});

const probeRow = (hand: 0 | 1, row: number, settle: number): ProbeRow => ({
    hand, row, valid: true,
    columns: Array.from({ length: 6 }, (_, col) => ({
        col, settleUs: col === 2 ? settle : 0, settleChanges: col === 2 ? 1 : 0, recoverUs: col === 2 ? 90 : 0, recoverChanges: col === 2 ? 1 : 0,
        idleHigh: true, litHigh: col !== 2, releasedHigh: true, activeDark: col === 2, expectedActiveDark: col === 2,
    })),
});

const svc = vi.hoisted(() => ({
    getStatus: vi.fn(),
    probeAll: vi.fn(),
    runSweepStep: vi.fn(),
    abort: vi.fn(),
    applyTiming: vi.fn(),
}));
vi.mock('@/services/scanlab.service', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/scanlab.service')>();
    return { ...actual, scanlabService: svc };
});

describe('ScanLabPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vial.isConnected = true;
        svc.getStatus.mockImplementation(async (hand: 0 | 1) => status(hand === 0 ? { isLeft: true } : { isLeft: false, hwRevision: 0 }));
        svc.applyTiming.mockResolvedValue(undefined);
    });

    it('asks to connect when no keyboard is attached', () => {
        vial.isConnected = false;
        render(<ScanLabPanel />);
        expect(screen.getByText('Connect')).toBeInTheDocument();
        expect(svc.getStatus).not.toHaveBeenCalled();
    });

    it('shows revision and effective timing for both halves on load', async () => {
        render(<ScanLabPanel />);
        await waitFor(() => expect(svc.getStatus).toHaveBeenCalledTimes(2));
        expect(screen.getByTestId('status-0')).toHaveTextContent('B (flipfet)');
        expect(screen.getByTestId('status-1')).toHaveTextContent('Revision A');
        expect(screen.getByTestId('status-0')).toHaveTextContent('pre 200 µs · post 200 µs');
    });

    it('probes every reachable hand and summarises the slowest settle and recovery', async () => {
        svc.probeAll.mockImplementation(async (hand: 0 | 1, onRow?: (r: ProbeRow) => void) => {
            const rows = [0, 1, 2, 3, 4].map((r) => probeRow(hand, r, hand === 0 ? 40 + r : 20));
            rows.forEach((r) => onRow?.(r));
            return rows;
        });
        render(<ScanLabPanel />);
        await waitFor(() => expect(svc.getStatus).toHaveBeenCalledTimes(2));
        fireEvent.click(screen.getByRole('button', { name: 'Probe all rows' }));
        await waitFor(() => expect(svc.probeAll).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.getByTestId('probe-summary')).toHaveTextContent('Slowest settle: 44 µs (Left Pinky C)'));
        expect(screen.getByTestId('probe-summary')).toHaveTextContent('Slowest recovery: 90 µs');
        expect(screen.getByTestId('probe-summary')).toHaveTextContent('matches the firmware table');
        expect(screen.getByTestId('probe-0')).toHaveTextContent('44/90');
    });

    it('applies the timing fields to the keyboard', async () => {
        render(<ScanLabPanel />);
        await waitFor(() => expect(svc.getStatus).toHaveBeenCalledTimes(2));
        fireEvent.change(screen.getByLabelText('pre-wait µs'), { target: { value: '120' } });
        fireEvent.change(screen.getByLabelText('post-wait µs'), { target: { value: '80' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply to keyboard' }));
        await waitFor(() => expect(svc.applyTiming).toHaveBeenCalledWith(120, 80));
    });
});
