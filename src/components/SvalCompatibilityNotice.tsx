import { SVAL_PREVIEW_URL } from '../services/firmware-compatibility';

export function SvalCompatibilityNotice({ onDisconnect, releaseFailed }: {
    onDisconnect: () => void;
    releaseFailed: boolean;
}) {
    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <section role="alert" aria-labelledby="sval-compatibility-title" className="max-w-lg rounded-lg border p-6 space-y-4">
                <h1 id="sval-compatibility-title" className="text-xl font-semibold">Open Keybard Preview for this keyboard</h1>
                <p>This keyboard uses the new Sval firmware. Open Keybard Preview to configure it.</p>
                <p>{releaseFailed
                    ? 'Unplug and reconnect the keyboard before connecting in the preview.'
                    : 'The keyboard connection has been released. Connect again in the preview.'}</p>
                <div className="flex gap-4 items-center">
                    <a className="underline" href={SVAL_PREVIEW_URL} target="_blank" rel="noopener noreferrer">Open Keybard Preview</a>
                    <button className="rounded border px-3 py-2" onClick={onDisconnect}>Disconnect</button>
                </div>
            </section>
        </main>
    );
}
