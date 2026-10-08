import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { DragContext } from "@/contexts/DragContext"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const { isDragging } = React.useContext(DragContext) || {};

  return <TooltipPrimitive.Trigger
    data-slot="tooltip-trigger"
    {...props}
    onPointerEnter={(e) => {
      if (isDragging) {
        e.preventDefault();
        return;
      }
      props.onPointerEnter?.(e);
    }}
    onMouseEnter={(e) => {
      if (isDragging) {
        e.preventDefault();
        return;
      }
      props.onMouseEnter?.(e);
    }}
    onFocus={(e) => {
      if (isDragging) {
        e.preventDefault();
        return;
      }
      props.onFocus?.(e);
    }}
  />
}

function TooltipContent({
  className,
  arrowClassName,
  arrowStyle,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & { arrowClassName?: string; arrowStyle?: React.CSSProperties }) {
  const dragContext = React.useContext(DragContext)
  if (dragContext?.isDragging) return null

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[10000] w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance select-none",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className={cn("bg-foreground fill-foreground z-[10000] size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]", arrowClassName)} style={arrowStyle} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/**
 * A tooltip variant with a longer delay before showing,
 * used for action buttons where accidental hover shouldn't trigger tooltips.
 */
function DelayedTooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider delayDuration={500}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

export { Tooltip, DelayedTooltip, TooltipTrigger, TooltipContent, TooltipProvider }
