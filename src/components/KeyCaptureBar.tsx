import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useSettings } from "@/contexts/SettingsContext";

export function KeyCaptureBar() {
    const { selectedTarget, isCapturing, setCapturing } = useKeyBinding();
    const { getSetting } = useSettings();
    if (!selectedTarget || !getSetting("typing-binds-key")) return null;
    const destination = selectedTarget.type === "keyboard"
        ? `layer ${selectedTarget.layer}, row ${selectedTarget.row}, column ${selectedTarget.col}`
        : `${selectedTarget.type} editor selection`;
    return <div className="fixed top-3 right-4 z-40 rounded-lg border bg-white p-3 shadow-sm text-sm" onClick={e => e.stopPropagation()}>
        <span role="status">{isCapturing ? `Press a key for ${destination}. Escape cancels.` : `Assign to ${destination}`}</span>
        <button className="ml-3 rounded border px-3 py-1" onClick={e => {
            setCapturing(!isCapturing);
            // The recording destination is the canvas, never a focused button.
            e.currentTarget.blur();
        }}>{isCapturing ? "Cancel recording" : "Record a key"}</button>
    </div>;
}
