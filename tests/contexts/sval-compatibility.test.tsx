import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VialProvider, useVial } from '../../src/contexts/VialContext';
import { SvalPreviewRequiredError, SVAL_PREVIEW_URL } from '../../src/services/firmware-compatibility';

vi.mock('../../src/services/vial.service', () => ({
  VialService: { isWebHIDSupported: () => true },
  vialService: { init: vi.fn(), load: vi.fn(), updateKey: vi.fn(), getActiveLayerIndex: vi.fn() },
}));
vi.mock('../../src/services/usb.service', () => ({
  usbInstance: {
    open: vi.fn(), openDevice: vi.fn(), close: vi.fn(), getDeviceName: () => 'Keyboard',
    getAllLayerColors: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../src/services/qmk.service', () => ({ qmkService: { get: vi.fn() } }));
import { usbInstance } from '../../src/services/usb.service';
import { vialService } from '../../src/services/vial.service';
import { qmkService } from '../../src/services/qmk.service';

function Controls() {
  const { connect, connectDevice, keyboard, isConnected } = useVial();
  return <>
    <button onClick={() => void connect()}>Choose keyboard</button>
    <button onClick={() => void connectDevice({} as HIDDevice)}>Known keyboard</button>
    {keyboard && isConnected && <div>Keyboard editor</div>}
  </>;
}

describe('Sval firmware handoff', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(usbInstance.open).mockResolvedValue(true);
    vi.mocked(usbInstance.openDevice).mockResolvedValue(true);
    vi.mocked(usbInstance.close).mockResolvedValue(undefined);
    vi.mocked(usbInstance.getAllLayerColors).mockResolvedValue([]);
    vi.mocked(vialService.load).mockRejectedValue(new SvalPreviewRequiredError());
  });

  it.each(['Choose keyboard', 'Known keyboard'])('releases the device and blocks edits via %s', async (button) => {
    render(<VialProvider><Controls /></VialProvider>);
    fireEvent.click(screen.getByText(button));
    expect(await screen.findByRole('alert')).toHaveTextContent('new Sval firmware');
    expect(screen.queryByText('Keyboard editor')).not.toBeInTheDocument();
    expect(usbInstance.close).toHaveBeenCalledTimes(1);
    expect(qmkService.get).not.toHaveBeenCalled();
    expect(vialService.updateKey).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Open Keybard Preview' })).toHaveAttribute('href', SVAL_PREVIEW_URL);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    vi.mocked(vialService.load).mockResolvedValue({ rows: 10, cols: 6 });
    fireEvent.click(screen.getByText('Choose keyboard'));
    expect(await screen.findByText('Keyboard editor')).toBeInTheDocument();
  });

  it('gives explicit recovery instructions if closing the device fails', async () => {
    vi.mocked(usbInstance.close).mockRejectedValueOnce(new Error('device busy'));
    render(<VialProvider><Controls /></VialProvider>);
    fireEvent.click(screen.getByText('Choose keyboard'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unplug and reconnect');
    expect(screen.queryByText('Keyboard editor')).not.toBeInTheDocument();
  });
});
