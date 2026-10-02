import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScanLabPanel from '../../src/layout/SecondarySidebar/Panels/ScanLabPanel';
import type { ProbeRow, ScanLabPower, ScanLabStatus } from '../../src/services/scanlab.service';

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
    getPower: vi.fn(),
    applyPacing: vi.fn(),
    rebootToBootloader: vi.fn(),
    probeAll: vi.fn(),
    runSweepStep: vi.fn(),
    abort: vi.fn(),
    applyTiming: vi.fn(),
}));

const powerReading = (over: Partial<ScanLabPower> = {}): ScanLabPower => ({
    reachable: true, periodUs: 1000, idlePeriodMs: 1, idleAfterMs: 1000, deepAfterS: 0, deepPeriodMs: 0,
    measuredFrameUs: 1000, measuredLedUs: 240, stage: 0, idleActive: false, effectivePeriodUs: 1000, effPrewaitUs: 45, effPostwaitUs: 5,
    rows: 5, hostBootloader: true, rebootArmed: false, dutyPct: 24, scanHz: 1000,
    ...over,
});
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
        svc.applyPacing.mockResolvedValue(undefined);
        svc.getPower.mockImplementation(async (hand: 0 | 1) => (hand === 0 ? powerReading() : powerReading({ reachable: false })));
    });

    it('shows the measured LED duty, frame time and expected duty for the pacing inputs', async () => {
        render(<ScanLabPanel />);
        await waitFor(() => expect(svc.getPower).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByTestId('power-0')).toHaveTextContent('LED duty 24.0 %'));
        expect(screen.getByTestId('power-0')).toHaveTextContent('frame 1000 µs · LED on 240 µs');
        expect(screen.getByTestId('power-1')).toHaveTextContent('no reading');
        expect(screen.getByTestId('power-expected')).toHaveTextContent('active 24.0 % ≈ 86 mA');
        expect(screen.getByTestId('power-ma-0')).toHaveTextContent('≈ 86 mA');
    });

    it('applies pacing with both idle stages from the fields', async () => {
        render(<ScanLabPanel />);
        await waitFor(() => expect(svc.getPower).toHaveBeenCalled());
        fireEvent.change(screen.getByLabelText('frame period µs (0 = unpaced)'), { target: { value: '2000' } });
        fireEvent.change(screen.getByLabelText('light idle after ms (0 = never)'), { target: { value: '1500' } });
        fireEvent.change(screen.getByLabelText('light idle period ms'), { target: { value: '100' } });
        fireEvent.change(screen.getByLabelText('deep idle after s (0 = never)'), { target: { value: '600' } });
        fireEvent.change(screen.getByLabelText('deep idle period ms'), { target: { value: '1000' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply pacing' }));
        await waitFor(() => expect(svc.applyPacing).toHaveBeenCalledWith(2000, { idleAfterMs: 1500, idlePeriodMs: 100, deepAfterS: 600, deepPeriodMs: 1000 }));
    });

    it('idle presets fill the fields', async () => {
        render(<ScanLabPanel />);
        await waitFor(() => expect(svc.getPower).toHaveBeenCalled());
        fireEvent.click(screen.getByRole('button', { name: 'Deep' }));
        expect(screen.getByLabelText('light idle period ms')).toHaveValue(100);
        expect(screen.getByLabelText('deep idle after s (0 = never)')).toHaveValue(600);
        expect(screen.getByLabelText('deep idle period ms')).toHaveValue(1000);
    });

    it('reboots a half only after arm then confirm', async () => {
        svc.rebootToBootloader.mockResolvedValue(true);
        render(<ScanLabPanel />);
        await waitFor(() => expect(svc.getPower).toHaveBeenCalled());
        const btn = screen.getByTestId('reboot-0');
        expect(btn).toHaveTextContent('Reboot Left into bootloader');
        fireEvent.click(btn);
        expect(screen.getByTestId('reboot-0')).toHaveTextContent('Confirm: reboot Left');
        expect(svc.rebootToBootloader).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('reboot-0'));
        await waitFor(() => expect(svc.rebootToBootloader).toHaveBeenCalledWith(0));
        await waitFor(() => expect(screen.getByTestId('reboot-note')).toHaveTextContent('RPI-RP2'));
    });

    it('disables reboot for a half whose firmware lacks host bootloader support', async () => {
        svc.getPower.mockImplementation(async (hand: 0 | 1) => (hand === 0 ? powerReading({ hostBootloader: false }) : powerReading({ reachable: false })));
        render(<ScanLabPanel />);
        await waitFor(() => expect(svc.getPower).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByTestId('reboot-0')).toBeDisabled());
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
