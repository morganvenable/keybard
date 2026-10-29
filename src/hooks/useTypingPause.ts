import { useEffect } from "react";

import { keyboardService } from "@/services/keyboard.service";
import { TYPING_PAUSE_OFF, TYPING_PAUSE_ON, TYPING_PAUSE_RENEW_MS } from "@/services/typing-pause";
import { usbInstance } from "@/services/usb.service";

/**
 * Pauses the board's typing (Sval TYPING_PAUSE) while `active`: the matrix tester
 * is open on a connected board that supports it. The pause is on only while
 * Keybard is in front of you: losing window focus or hiding the tab sends
 * "off" at once (the standard build keeps polling in the background, so the
 * board's lease alone would not end it), and coming back turns it on again.
 * Closing the tester sends "off" too. A renewed client ID sends "on" again
 * with the new ID, since the board ties the pause to one client.
 */
export function useTypingPause(active: boolean): void {
    useEffect(() => {
        if (!active) return;
        let closed = false;
        let focused = typeof document === "undefined" ? true : document.hasFocus();
        let timer: ReturnType<typeof setTimeout> | undefined;

        const wanted = () => focused && document.visibilityState === "visible";
        const send = (op: number) => {
            keyboardService.typingPause(op).catch((e) => console.warn("Typing pause:", e));
        };
        const on = () => send(TYPING_PAUSE_ON);
        const off = () => send(TYPING_PAUSE_OFF);

        const renew = () => {
            if (closed) return;
            if (wanted()) on();
            timer = setTimeout(renew, TYPING_PAUSE_RENEW_MS);
        };
        const onBlur = () => {
            focused = false;
            off();
        };
        const onFocus = () => {
            focused = true;
            if (wanted()) on();
        };
        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                if (wanted()) on();
            } else {
                off();
            }
        };
        const onPageHide = () => off();

        window.addEventListener("blur", onBlur);
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", onPageHide);
        const stopRenewed = usbInstance.onClientRenewed(() => {
            if (!closed && wanted()) on();
        });
        renew();

        return () => {
            closed = true;
            if (timer) clearTimeout(timer);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pagehide", onPageHide);
            stopRenewed();
            off();
        };
    }, [active]);
}
