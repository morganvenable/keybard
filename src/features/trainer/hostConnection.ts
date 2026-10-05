import type { HostSnapshot } from './host';

export interface HostKeyboard {
    hostId: string;
    productName: string;
    productId: number;
    vendorId: number;
}
export type ConnectableKeyboard = HIDDevice | HostKeyboard;
export const isHostPage = () => document.documentElement.dataset.keybardHost === 'true';

async function snapshot(): Promise<HostSnapshot> {
    const response = await fetch('/api/host/state?layout=-1', { cache: 'no-store', signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error('Could not reach the keyboard connection.');
    const state = await response.json() as HostSnapshot;
    if (state.apiVersion !== 1) throw new Error('Unsupported keyboard connection version.');
    return state;
}
export async function hostKeyboards(): Promise<HostKeyboard[]> {
    return (await snapshot()).devices.map(device => ({ hostId: device.id, productName: device.name, vendorId: 0, productId: 0 }));
}

/** Load a fresh, read-only device snapshot without opening a second HID reader. */
export async function connectHostKeyboard(id?: string) {
    let state = await snapshot();
    const target = id ?? state.selectedDevice ?? (state.devices.length === 1 ? state.devices[0].id : null);
    if (!target) throw new Error(state.devices.length ? 'Select a keyboard from the list below.' : 'No Svalboard is connected.');
    if (state.selectedDevice !== target || !state.board || !state.valid) {
        const bootstrap = await fetch('/api/host/bootstrap', { cache: 'no-store', signal: AbortSignal.timeout(2000) });
        if (!bootstrap.ok) throw new Error('Could not authorize the keyboard connection.');
        const { token } = await bootstrap.json();
        const response = await fetch('/api/host/command', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Keybard-Token': token }, body: JSON.stringify({ op: 'connect', id: target }), signal: AbortSignal.timeout(2000) });
        if (!response.ok) throw new Error('Could not connect to the selected keyboard.');
    }
    const deadline = Date.now() + 15000;
    while (true) {
        if (state.selectedDevice === target && state.valid && state.board?.keymap?.length) return structuredClone(state.board);
        if (Date.now() >= deadline) throw new Error(`Keyboard did not finish connecting: ${state.status}`);
        await new Promise(resolve => setTimeout(resolve, 150));
        state = await snapshot();
    }
}
