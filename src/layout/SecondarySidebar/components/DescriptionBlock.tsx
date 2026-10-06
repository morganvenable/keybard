import React from "react";
import { cn } from "@/lib/utils";

interface DescriptionBlockProps {
    children: React.ReactNode;
    className?: string;
    textClassName?: string;
    wrapText?: boolean;
}

const DescriptionBlock: React.FC<DescriptionBlockProps> = ({ children, className, textClassName, wrapText = true }) => {
    return (
        <div
            className={cn(
                "flex flex-col gap-1 pt-0 pl-0 pr-[26px] w-full box-border pb-5",
                className
            )}
        >
            {wrapText ? (
                <span className={cn("text-sm text-slate-500 dark:text-neutral-400 leading-relaxed max-w-[560px]", textClassName)}>
                    {children}
                </span>
            ) : (
                children
            )}
        </div>
    );
};

export default DescriptionBlock;
