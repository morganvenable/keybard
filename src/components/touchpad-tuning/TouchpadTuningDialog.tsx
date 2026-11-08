import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TouchpadTuning } from "./TouchpadTuning";
import { closeTouchpadTuning, useTouchpadTuningOpen } from "./tuning-open";

/**
 * Touchpad tuning as a dialog, opened from Pointing Devices ("Tune
 * touchpad…"). The same view as the Settings card. Mounted once per page.
 */
export default function TouchpadTuningDialog() {
    const open = useTouchpadTuningOpen();
    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) closeTouchpadTuning(); }}>
            {/* A diagnostic panel with a fixed size, set by the viewport and never by what the
                pads report: most of the screen on a desktop, all of it on a phone. The body
                scrolls inside it when the window is small, and only the touch lists grow
                (inside their own fixed-height boxes). Touchpad mode has less to show (the
                pads and their touches): the panel fits it, in fixed-height boxes too. */}
            <DialogContent
                className="flex h-dvh max-h-none w-screen max-w-none flex-col gap-3 overflow-hidden rounded-none p-4 sm:h-[min(60rem,calc(100dvh-4rem))] sm:w-[min(80rem,calc(100vw-4rem))] sm:max-w-none sm:rounded-lg sm:p-6 has-[[data-layout^=os]]:h-auto has-[[data-layout^=os]]:max-h-dvh sm:has-[[data-layout^=os]]:h-auto sm:has-[[data-layout^=os]]:max-h-[calc(100dvh-4rem)] sm:has-[[data-layout^=os]]:w-[min(60rem,calc(100vw-4rem))]"
                data-touchpad-tuning-dialog
            >
                <DialogHeader className="shrink-0">
                    <DialogTitle>Live view</DialogTitle>
                    <DialogDescription>Touch a pad to see each touch as it happens. Dead zone, tap and hold times are set under Advanced in Settings.</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden" data-touchpad-tuning-body>
                    {open && <TouchpadTuning place="dialog" />}
                </div>
            </DialogContent>
        </Dialog>
    );
}
