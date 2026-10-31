import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tuneLayoutFromSearch } from "@/lib/deepLinks";
import { TouchpadTuning } from "./TouchpadTuning";
import { closeTouchpadTuning, useTouchpadTuningOpen } from "./tuning-open";

/**
 * Touchpad tuning as a dialog, opened from Pointing Devices ("Tune
 * touchpad…"). The same view as the Settings card. Mounted once per page.
 */
export default function TouchpadTuningDialog() {
    const open = useTouchpadTuningOpen();
    const layout = tuneLayoutFromSearch(typeof window === "undefined" ? "" : window.location.search);
    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) closeTouchpadTuning(); }}>
            <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[920px]" data-touchpad-tuning-dialog>
                <DialogHeader>
                    <DialogTitle>Touchpad tuning</DialogTitle>
                    <DialogDescription>Each touch on a pad shows here, with why it clicked or didn't.</DialogDescription>
                </DialogHeader>
                {open && <TouchpadTuning layout={layout} place="dialog" />}
            </DialogContent>
        </Dialog>
    );
}
