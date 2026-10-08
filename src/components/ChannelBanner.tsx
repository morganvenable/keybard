import React from "react";

export const STABLE_URL = "https://keybard.svalboard.com/";

/**
 * Marks the bleeding-edge build (VITE_CHANNEL=next, see .env.next) so nobody
 * mistakes it for the stable site, and links back to stable. Other builds show nothing.
 */
const ChannelBanner: React.FC = () => {
    if (import.meta.env.VITE_CHANNEL !== "next") return null;

    return (
        <div
            role="note"
            className="fixed top-1 left-1/2 -translate-x-1/2 z-50 rounded-full bg-kb-yellow px-3 py-0.5 text-xs font-medium text-kb-sidebar-dark shadow"
        >
            Bleeding edge: may break.{" "}
            <a href={STABLE_URL} className="underline underline-offset-2">
                Use the stable version
            </a>
        </div>
    );
};

export default ChannelBanner;
