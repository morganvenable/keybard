import { FC, useState } from "react";

import { cn } from "@/lib/utils";

interface Props {
    label: string;
}

const HoldableButton: FC<Props> = ({ label }) => {
    const [value, setValue] = useState(false);
    return (
        <div
            className={cn(
                "px-5 text-center py-1 bg-transparent hover:bg-kb-active hover:text-kb-active-fg rounded-full cursor-pointer text-center",
                value && "bg-kb-active text-kb-active-fg hover:bg-slate-600 dark:hover:bg-neutral-300"
            )}
            onClick={() => setValue((val) => !val)}
        >
            {label}
        </div>
    );
};

export default HoldableButton;
