import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppMono } from "./AppMenu";
import { appsOnLayer, useAppAware } from "./store";

/** On a layer tab: the marks of the apps that use this layer as their base. Hover lists them. */
export function LayerAppBadge({ layer }: { layer: number }) {
    const s = useAppAware();
    if (!s.on || !s.supported) return null;
    const apps = appsOnLayer(layer, s);
    if (!apps.length) return null;
    const label = `Base layer for ${apps.map(a => a.name).join(", ")}`;
    return (
        <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
                <span className="inline-flex items-center -space-x-1 ml-0.5" data-layer-app-badge={layer} aria-label={label} role="img">
                    {apps.slice(0, 2).map(a => <AppMono key={a.id} mono={a.mono} size={15} className="ring-1 ring-kb-surface" />)}
                    {apps.length > 2 && <span className="text-[10px] pl-1.5">+{apps.length - 2}</span>}
                </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
    );
}
