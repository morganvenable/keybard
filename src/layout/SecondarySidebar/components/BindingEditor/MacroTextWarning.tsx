import { FC, Fragment } from "react";
import { cn } from "@/lib/utils";
import { macroCharLabel, untypableMacroChars } from "@/utils/macro-text";

/** Names the characters in a macro's text that the keyboard can't type and will skip. */
const MacroTextWarning: FC<{ text: string; className?: string }> = ({ text, className }) => {
    const chars = untypableMacroChars(text);
    if (chars.length === 0) return null;
    const labels = chars.map(macroCharLabel);
    return (
        <p
            role="status"
            data-macro-text-warning=""
            className={cn("rounded-md border border-kb-warn-ink bg-kb-warn-bg px-2 py-1 text-xs text-kb-warn-ink whitespace-normal", className)}
        >
            The keyboard can't type{" "}
            {labels.map((label, i) => (
                <Fragment key={label}>
                    {i > 0 && (i === labels.length - 1 ? " and " : ", ")}
                    <span className="font-mono font-semibold">{label}</span>
                </Fragment>
            ))}
            . It will skip {chars.length === 1 ? "it" : "them"}.
        </p>
    );
};

export default MacroTextWarning;
