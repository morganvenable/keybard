import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConnectKeyboard from '../../src/components/ConnectKeyboard';
import { listPermittedDevices } from '../../src/contexts/VialContext';

const vial = {
    isConnected: false,
    isWebHIDSupported: true,
    connect: vi.fn(),
    connectDevice: vi.fn(),
    disconnect: vi.fn(),
    loadKeyboard: vi.fn(),
    loadFromFile: vi.fn(),
};

vi.mock('@/contexts/VialContext', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/contexts/VialContext')>();
    return { ...actual, useVial: () => vial };
});

const fakeDevice = (productName: string, productId: number, collections: Array<[number, number]>) => ({
    vendorId: 0x303a,
    productId,
    productName,
    opened: false,
    collections: collections.map(([usagePage, usage]) => ({ usagePage, usage })),
}) as unknown as HIDDevice;

describe('listPermittedDevices', () => {
    it('keeps one entry per keyboard whose interface matches a filter', async () => {
        const hid = navigator.hid as unknown as { getDevices: ReturnType<typeof vi.fn> };
        hid.getDevices.mockResolvedValue([
            fakeDevice('Svalboard ScanLab', 0x4044, [[0xff31, 0x74]]),   // console interface: no
            fakeDevice('Svalboard ScanLab', 0x4044, [[0xff61, 0x62]]),   // raw HID: yes
            fakeDevice('Svalboard ScanLab', 0x4044, [[0x01, 0x06]]),     // keyboard: no
            fakeDevice('lightly', 0x4049, [[0xff61, 0x62]]),             // second board: yes
            fakeDevice('lightly', 0x4049, [[0xff61, 0x62]]),             // duplicate interface entry
        ]);
        const devices = await listPermittedDevices();
        expect(devices.map((d) => d.productName)).toEqual(['Svalboard ScanLab', 'lightly']);
    });
});

describe('ConnectKeyboard: reconnect to permitted keyboards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vial.isConnected = false;
    });

    it('lists permitted keyboards and opens one without the chooser', async () => {
        const hid = navigator.hid as unknown as { getDevices: ReturnType<typeof vi.fn> };
        const scanlab = fakeDevice('Svalboard ScanLab', 0x4044, [[0xff61, 0x62]]);
        hid.getDevices.mockResolvedValue([scanlab]);
        vial.connectDevice.mockResolvedValue(true);

        render(<ConnectKeyboard />);
        const button = await screen.findByRole('button', { name: 'Svalboard ScanLab' });
        fireEvent.click(button);
        await waitFor(() => expect(vial.connectDevice).toHaveBeenCalledWith(scanlab));
        expect(vial.connect).not.toHaveBeenCalled();
    });

    it('shows nothing extra when no keyboard has been permitted', async () => {
        render(<ConnectKeyboard />);
        expect(screen.getByRole('button', { name: /Connect Keyboard/ })).toBeInTheDocument();
        await waitFor(() => expect((navigator.hid as unknown as { getDevices: ReturnType<typeof vi.fn> }).getDevices).toHaveBeenCalled());
        expect(screen.queryByTestId('known-devices')).not.toBeInTheDocument();
    });
});

// The host must not add launchers or connection-policy copy to Keybard's landing page.
describe('ConnectKeyboard landing content', () => {
    it('keeps the original landing page in host mode', () => {
        document.documentElement.dataset.keybardHost = 'true';
        try {
            render(<ConnectKeyboard />);
            expect(screen.queryByText(/trainer/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Keybard Host|owns the board|device editing/i)).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'QWERTY Example' })).toBeInTheDocument();
        } finally {
            delete document.documentElement.dataset.keybardHost;
        }
    });
});
