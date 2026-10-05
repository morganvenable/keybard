import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FC, useEffect, useRef } from "react";
import { DelayedTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
    type: string;
    value: string | number;
    onChange: (value: string | number) => void;
    onDelete?: () => void;
    autoFocus?: boolean;
}

const MacroEditorText: FC<Props> = ({ type, value, onChange, onDelete, autoFocus }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const activeRef = type === "text" ? textareaRef.current : inputRef.current;
        if (autoFocus && activeRef) {
            activeRef.focus();
            // Move cursor to end of text
            const len = String(value).length;
            activeRef.setSelectionRange(len, len);
        }
    }, [autoFocus, type, value]);

    return (
        <div className="relative w-full">
            <div className="flex flex-row flex-wrap gap-2 justify-start items-center w-full peer">
                {type === "text" ? (
                    <Textarea
                        ref={textareaRef}
                        value={String(value)}
                        onChange={(e) => onChange(e.target.value)}
                        className="bg-white text-black border-input w-[180px] max-w-full min-w-0 flex-grow-0 select-text"
                    />
                ) : (
                    <Input
                        ref={inputRef}
                        value={String(value)}
                        onChange={(e) => onChange(e.target.value)}
                        className="bg-white text-black border-input w-[180px] max-w-full min-w-0 flex-grow-0 select-text"
                    />
                )}
                <div className="flex flex-row items-center">
                    {type && <div className="font-medium text-gray-600">{type === "delay" ? "Delay (ms)" : type.charAt(0).toUpperCase() + type.slice(1)}</div>}
                </div>
            </div>
            {onDelete && (
                <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 peer-hover:opacity-100 hover:opacity-100 transition-opacity z-10">
                    <DelayedTooltip>
                        <TooltipTrigger asChild>
                            <button
                                className="p-2 text-gray-400 hover:bg-red-500 hover:text-white rounded-full bg-kb-gray-medium"
                                onClick={onDelete}
                                type="button"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Delete item</p>
                        </TooltipContent>
                    </DelayedTooltip>
                </div>
            )}
        </div>
    );
};

export default MacroEditorText;
