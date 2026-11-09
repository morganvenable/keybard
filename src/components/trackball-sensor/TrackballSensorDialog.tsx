import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TrackballPanel from "@/layout/SecondarySidebar/Panels/TrackballPanel";
import { closeTrackballSensor, useTrackballSensorOpen } from "./trackball-open";

/**
 * Trackball characterization as a dialog over Settings, the same way as the
 * touchpad live view. The panel is mounted only while open, so the keyboard is
 * polled only then. Mounted once per page.
 */
export default function TrackballSensorDialog() {
    const open = useTrackballSensorOpen();
    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) closeTrackballSensor(); }}>
            <DialogContent
                className="flex h-dvh max-h-none w-screen max-w-none flex-col gap-3 overflow-hidden rounded-none p-4 sm:h-[min(60rem,calc(100dvh-4rem))] sm:w-[min(60rem,calc(100vw-4rem))] sm:max-w-none sm:rounded-lg sm:p-6"
                data-trackball-sensor-dialog
            >
                <DialogHeader className="shrink-0">
                    <DialogTitle>Trackball sensors</DialogTitle>
                    <DialogDescription>Surface quality and readings for each sensor, live. Nothing is written to the keyboard.</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                    {open && <TrackballPanel />}
                </div>
            </DialogContent>
        </Dialog>
    );
}
