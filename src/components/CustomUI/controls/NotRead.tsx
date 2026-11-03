import { cn } from "@/lib/utils";

/** What a control shows when its value wasn't read from the board. */
export const NOT_READ = "Not read";

/** "Not read", beside a control whose value Keybard didn't get from the board. Choosing a value still writes it. */
export function NotReadNote({ compact = false, className }: { compact?: boolean; className?: string }) {
    return (
        <span className={cn(compact ? "text-[10px]" : "text-xs", "font-medium text-muted-foreground", className)} data-not-read="">
            {NOT_READ}
        </span>
    );
}
