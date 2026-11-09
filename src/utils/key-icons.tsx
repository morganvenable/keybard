import React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Clock, Crosshair, ListOrdered, Zap } from "lucide-react";
import MouseIcon from "@/components/icons/Mouse";
import LayersIcon from "@/components/icons/Layers";
import MacrosIcon from "@/components/icons/MacrosIcon";
import TapdanceIcon from "@/components/icons/Tapdance";
import ComboIcon from "@/components/ComboIcon";
import OverridesIcon from "@/components/icons/Overrides";
import AltRepeatArrowsIcon from "@/components/icons/AltRepeatArrowsIcon";

export const getHeaderIcons = (keycode: string, label: string) => {
    const lowerLabel = String(label).toLowerCase();
    const mouseWords = ["mouse", "ms"];
    const sniperWords = ["sniper"];
    const boostWords = ["boost"];
    const timerWords = ["timer"];

    const isMouse = mouseWords.some((w) => lowerLabel.includes(w));
    const isSniper = sniperWords.some((w) => lowerLabel.includes(w)) || keycode.includes("SNIPER");
    const isBoost = boostWords.some((w) => lowerLabel.includes(w)) || keycode.includes("BOOST");
    const isTimer = timerWords.some((w) => lowerLabel.includes(w)) || keycode.includes("TIMEOUTS");

    const icons: React.ReactNode[] = [];
    if (isMouse) icons.push(<MouseIcon key="mouse" className="w-3.5 h-3.5" />);
    if (isSniper) icons.push(<Crosshair key="sniper" className="w-3.5 h-3.5" />);
    if (isBoost) icons.push(<Zap key="boost" className="w-3.5 h-3.5" />);
    if (isTimer) icons.push(<Clock key="timer" className="w-3.5 h-3.5" />);

    return {
        icons,
        isMouse,
        isSniper,
        isBoost,
        isTimer
    };
};

export const getCenterContent = (
    label: string,
    keycode: string,
    isMouse: boolean,
    showArrowsOnly: boolean = false,
    /** A small (30px) key: the wheel legend and arrow shrink to fit it. */
    small: boolean = false
) => {
    const lowerLabel = String(label).toLowerCase();
    const upWords = ["up"];
    const downWords = ["down"];
    const leftWords = ["left"];
    const rightWords = ["right"];

    const isUp = upWords.some((w) => lowerLabel.includes(w)) || keycode.endsWith("_U");
    const isDown = downWords.some((w) => lowerLabel.includes(w)) || keycode.endsWith("_D");
    const isLeft = leftWords.some((w) => lowerLabel.includes(w)) || keycode.endsWith("_L");
    const isRight = rightWords.some((w) => lowerLabel.includes(w)) || keycode.endsWith("_R");

    const showArrows = (isMouse && (isUp || isDown || isLeft || isRight)) || ["up", "down", "left", "right"].includes(lowerLabel);

    const isWheel = lowerLabel.includes("wheel") || keycode.includes("WH");

    if (showArrows) {
        let ArrowIcon;
        const arrowClass = small && isWheel ? "w-3 h-3" : "w-5 h-5";
        if (isUp) ArrowIcon = <ArrowUp className={arrowClass} />;
        if (isDown) ArrowIcon = <ArrowDown className={arrowClass} />;
        if (isLeft) ArrowIcon = <ArrowLeft className={arrowClass} />;
        if (isRight) ArrowIcon = <ArrowRight className={arrowClass} />;

        if (ArrowIcon) {
            if (isWheel) {
                return (
                    <div className={small ? "flex flex-col items-center justify-center" : "flex flex-col items-center justify-center -space-y-1"}>
                        <span className={small ? "text-[7px] leading-none font-bold" : "text-[9px] font-bold"}>WHEEL</span>
                        {ArrowIcon}
                    </div>
                );
            }
            return ArrowIcon;
        }
    }

    if (showArrowsOnly) return null;

    let clean = label;
    const wordsToRemove = ["mouse", "ms", "sniper", "boost", "timer"];
    wordsToRemove.forEach((w) => {
        clean = clean.replace(new RegExp(`\\b${w}\\b`, "i"), "").trim();
    });

    return clean;
};

export const getTypeIcon = (type: string, variant: "default" | "medium" | "small" = "default") => {
    const isMedium = variant === "medium";
    const isSmall = variant === "small";
    const iconClass = isSmall ? "mt-1 h-4" : isMedium ? "mt-1.5 h-6" : "mt-2 h-8";
    switch (type) {
        case "tapdance":
            return <TapdanceIcon className={iconClass} />;
        case "macro":
            return <MacrosIcon className={iconClass} />;
        case "combo":
            return <ComboIcon className={iconClass} />;
        case "override":
            return <OverridesIcon className={iconClass} />;
        case "layer":
            return <LayersIcon className={isSmall ? "w-3 h-3" : isMedium ? "w-5 h-5" : ""} />;
        case "altrepeat":
            return <AltRepeatArrowsIcon className={iconClass} />;
        case "leaders":
            return <ListOrdered className={iconClass} />;
        default:
            return null;
    }
};
