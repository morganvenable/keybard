import { HelpCircle, Keyboard, ListOrdered, LucideIcon, Mouse, Piano, Repeat, Settings } from "lucide-react";
import PointingDeviceBall01Icon from "@/components/icons/PointingDeviceBall01Icon";
import LayoutLayersIcon from "@/components/icons/LayoutLayersIcon";
import { useCallback, useMemo } from "react";

import ComboIcon from "@/components/ComboIcon";
import { isExcludedMenu, getIconForMenu } from "@/constants/custom-ui-exclusions";

import LayersDefaultIcon from "@/components/icons/LayersDefault";
import MacrosIcon from "@/components/icons/MacrosIcon";
import OverridesIcon from "@/components/icons/Overrides";
import TapdanceIcon from "@/components/icons/Tapdance";
import Logo from "@/components/Logo";
import {
    Sidebar,
    SidebarContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar
} from "@/components/ui/sidebar";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { cn } from "@/lib/utils";

// --- Constants ---
const MENU_ITEM_GAP_PX = 42; // Matches Gap-4 (16px) + Button Height (26px)
const DIVIDER_HEIGHT_PX = 17; // 1px + 2*8px (my-2)
const FLEX_GAP_PX = 16; // Gap-4
const DIVIDER_OFFSET = DIVIDER_HEIGHT_PX + FLEX_GAP_PX;

// Icon layout helpers - use isCollapsed boolean
const getIconGutterWidth = (isCollapsed: boolean) => isCollapsed ? "w-full" : "w-[43px]";
const getIconPadding = (isCollapsed: boolean) => isCollapsed ? "pl-0" : "pl-[13px]";
const getLogoPadding = (isCollapsed: boolean) => isCollapsed ? "pl-0" : "pl-[10px]";
const getIconJustify = (isCollapsed: boolean) => isCollapsed ? "justify-center" : "justify-start";

export type SidebarItem = {
    title: string;
    url: string;
    icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
};

// Top section items (Keyboard and Pointing Devices, before the spacer)
export const topSectionItems: SidebarItem[] = [
    { title: "Keyboard Keys", url: "keyboard", icon: Keyboard },
    { title: "Pointing Devices", url: "pointing", icon: PointingDeviceBall01Icon },
];

// Middle section items (after the spacer, before the divider)
export const middleSectionItems: SidebarItem[] = [
    { title: "Special Keys", url: "special", icon: Piano },
    { title: "Layer Keys", url: "layers", icon: LayersDefaultIcon },
    { title: "Mouse Keys", url: "mouse", icon: Mouse },
    { title: "Tap Dances", url: "tapdances", icon: TapdanceIcon },
    { title: "Macros", url: "macros", icon: MacrosIcon },
];

// For backward compatibility
export const primarySidebarItemsBeforeDynamic: SidebarItem[] = topSectionItems;
export const primarySidebarItemsAfterDynamic: SidebarItem[] = middleSectionItems;

// Combined for backward compatibility and index calculations
export const primarySidebarItems: SidebarItem[] = [
    ...topSectionItems,
    ...middleSectionItems,
];

// Alt-Repeat - enabled for testing
const SHOW_ALT_REPEAT = true;
// Leaders - enable when ready to test
const SHOW_LEADERS = true;

const featureSidebarItems: SidebarItem[] = [
    { title: "Combos", url: "combos", icon: ComboIcon },
    { title: "Overrides", url: "overrides", icon: OverridesIcon },
    ...(SHOW_ALT_REPEAT ? [{ title: "Alt-Repeat", url: "altrepeat", icon: Repeat }] : []),
    ...(SHOW_LEADERS ? [{ title: "Leaders", url: "leaders", icon: ListOrdered }] : []),
];

const footerItems: SidebarItem[] = [
    { title: "About", url: "about", icon: HelpCircle },
    { title: "Layouts", url: "layouts", icon: LayoutLayersIcon },
    { title: "Settings", url: "settings", icon: Settings },
];

// --- Sub-components ---

const SlidingIndicator = ({ y }: { y: number }) => (
    <div
        className="absolute left-[4px] top-0 w-[3px] h-[26px] bg-black z-20 transition-transform duration-300 ease-in-out pointer-events-none"
        style={{ transform: `translateY(${y}px)` }}
    />
);

interface SidebarNavItemProps {
    item: SidebarItem;
    isActive: boolean;
    isPreviousPanel?: boolean;
    alternativeHeader?: boolean;
    isCollapsed: boolean;
    onClick: (item: SidebarItem) => void;
}

const SidebarNavItem = ({
    item,
    isActive,
    isPreviousPanel,
    alternativeHeader,
    isCollapsed,
    onClick,
}: SidebarNavItemProps) => (
    <SidebarMenuItem className="cursor-pointer">
        <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={item.title}
            sidebarName="primary-nav"
            size="nav"
            className={cn(
                "transition-colors",
                (alternativeHeader ? isPreviousPanel : isActive) ? "text-sidebar-foreground" : "text-gray-400"
            )}
        >
            <button type="button" onClick={(e) => { e.stopPropagation(); onClick(item); }} className="flex w-full items-center justify-start">
                <div className={cn(getIconGutterWidth(isCollapsed), "h-full flex items-center shrink-0", getIconJustify(isCollapsed), getIconPadding(isCollapsed))}>
                    <item.icon className="h-4 w-4 shrink-0" />
                </div>
                <span className={cn("truncate", isCollapsed && "hidden")}>
                    {item.title}
                </span>
            </button>
        </SidebarMenuButton>
    </SidebarMenuItem>
);

// --- Main Component ---

const AppSidebar = () => {
    const { state, toggleSidebar } = useSidebar("primary-nav", { defaultOpen: false });
    const isCollapsed = state === "collapsed";
    const {
        setItemToEdit,
        setActivePanel,
        openDetails,
        activePanel,
        panelToGoBack,
        alternativeHeader,
        setPanelToGoBack,
        setAlternativeHeader,
        open,
        handleCloseDetails,
        setOpen,
    } = usePanels();

    const { keyboard } = useVial();



    const handleItemSelect = useCallback(
        (item: SidebarItem) => {
            if (item.url === "matrixtester") {
                if (activePanel === "matrixtester") {
                    setActivePanel(null);
                    return;
                }
                setOpen(false);
                setActivePanel("matrixtester");
                setPanelToGoBack(null);
                setItemToEdit(null);
                return;
            }

            if (activePanel === item.url && open) {
                handleCloseDetails();
            } else {
                setActivePanel(item.url);
                openDetails();
                setPanelToGoBack(null);
                setAlternativeHeader(false);
                setItemToEdit(null);
            }
        },
        [activePanel, open, handleCloseDetails, setActivePanel, openDetails, setPanelToGoBack, setAlternativeHeader, setItemToEdit, setOpen]
    );



    // Build dynamic menu items from keyboard definition
    const dynamicMenuItems: SidebarItem[] = useMemo(() => {
        if (!keyboard?.menus) return [];

        return keyboard.menus
            .filter((menu) => !isExcludedMenu(menu.label))
            .map((menu, index) => {
                const iconName = getIconForMenu(menu.label);
                // Map icon name to component
                const IconComponent = iconName === 'target' ? PointingDeviceBall01Icon : iconName === 'mouse' ? Mouse : Settings;

                return {
                    title: menu.label || `Menu ${index}`,
                    url: `dynamic-menu-${index}`,
                    icon: IconComponent,
                };
            });
    }, [keyboard?.menus]);

    const activeTopIndex = topSectionItems.findIndex((item) => item.url === activePanel);
    const activeMiddleIndex = middleSectionItems.findIndex((item) => item.url === activePanel);
    const activeFeatureIndex = featureSidebarItems.findIndex((item) => item.url === activePanel);
    const activeDynamicIndex = dynamicMenuItems.findIndex((item) => item.url === activePanel);
    const activeFooterIndex = footerItems.findIndex((item) => item.url === activePanel);

    let indicatorY = -1;
    if (activeTopIndex !== -1) {
        // Top section items (Keyboard, Pointing Devices)
        indicatorY = activeTopIndex * MENU_ITEM_GAP_PX;
    } else if (activeDynamicIndex !== -1 && dynamicMenuItems.length > 0) {
        // Dynamic menu items - right after Pointing Devices
        indicatorY = (topSectionItems.length * MENU_ITEM_GAP_PX) + (activeDynamicIndex * MENU_ITEM_GAP_PX);
    } else if (activeMiddleIndex !== -1) {
        // Middle section items - after first divider
        indicatorY = (topSectionItems.length * MENU_ITEM_GAP_PX)
            + (dynamicMenuItems.length * MENU_ITEM_GAP_PX)
            + DIVIDER_OFFSET
            + (activeMiddleIndex * MENU_ITEM_GAP_PX);
    } else if (activeFeatureIndex !== -1) {
        // Feature items - after two dividers
        indicatorY = (topSectionItems.length * MENU_ITEM_GAP_PX)
            + (dynamicMenuItems.length * MENU_ITEM_GAP_PX)
            + DIVIDER_OFFSET
            + (middleSectionItems.length * MENU_ITEM_GAP_PX)
            + DIVIDER_OFFSET
            + (activeFeatureIndex * MENU_ITEM_GAP_PX);
    }

    const sidebarClasses = cn(
        "z-11 fixed transition-[box-shadow,border-color] duration-300 ease-out border border-sidebar-border shadow-lg ml-2 h-[98vh] mt-[1vh] transition-all",
        "rounded-3xl select-none"
    );

    return (
        <>
            {/* Hidden file input for import */}



            <Sidebar rounded name="primary-nav" defaultOpen={false} collapsible="icon" hideGap className={sidebarClasses}>
                <SidebarContent className={cn("py-4 overflow-y-auto overflow-x-hidden flex flex-col", isCollapsed && "scrollbar-none")}>
                    {/* Header section - Logo, Connect, Import/Export */}
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild size="nav" className="transition-colors">
                                <button
                                    type="button"
                                    className="flex w-full items-center justify-start"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSidebar();
                                    }}
                                >
                                    <div className={cn(getIconGutterWidth(isCollapsed), "h-4 flex items-center shrink-0", getIconJustify(isCollapsed), getLogoPadding(isCollapsed))}>
                                        <Logo />
                                    </div>
                                    <span className={cn("text-[22px] font-semibold truncate", isCollapsed && "hidden")}>keybard</span>
                                </button>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>

                    {/* Main navigation - vertically centered in available space */}
                    <div className="flex-1 flex flex-col justify-center py-2">
                        <SidebarMenu className="relative">
                            {indicatorY !== -1 && <SlidingIndicator y={indicatorY} />}

                            {/* Top section items (Keyboard, Pointing Devices) */}
                            {topSectionItems.map((item) => (
                                <SidebarNavItem
                                    key={item.url}
                                    item={item}
                                    isActive={activePanel === item.url}
                                    isPreviousPanel={panelToGoBack === item.url}
                                    alternativeHeader={alternativeHeader}
                                    isCollapsed={isCollapsed}
                                    onClick={handleItemSelect}
                                />
                            ))}

                            {/* Dynamic menu items from keyboard definition - right after Pointing Devices */}
                            {dynamicMenuItems.map((item) => (
                                <SidebarNavItem
                                    key={item.url}
                                    item={item}
                                    isActive={activePanel === item.url}
                                    isPreviousPanel={panelToGoBack === item.url}
                                    alternativeHeader={alternativeHeader}
                                    isCollapsed={isCollapsed}
                                    onClick={handleItemSelect}
                                />
                            ))}

                            {/* Divider between top section and middle section */}
                            <div className="mx-4 my-2 h-[1px] bg-slate-400" />

                            {/* Middle section items (Special, Layer Keys, Mouse Keys, Tap Dances, Macros) */}
                            {middleSectionItems.map((item) => (
                                <SidebarNavItem
                                    key={item.url}
                                    item={item}
                                    isActive={activePanel === item.url}
                                    isPreviousPanel={panelToGoBack === item.url}
                                    alternativeHeader={alternativeHeader}
                                    isCollapsed={isCollapsed}
                                    onClick={handleItemSelect}
                                />
                            ))}

                            <div className="mx-4 my-2 h-[1px] bg-slate-400" />

                            {featureSidebarItems.map((item) => (
                                <SidebarNavItem
                                    key={item.url}
                                    item={item}
                                    isActive={activePanel === item.url}
                                    isPreviousPanel={panelToGoBack === item.url}
                                    alternativeHeader={alternativeHeader}
                                    isCollapsed={isCollapsed}
                                    onClick={handleItemSelect}
                                />
                            ))}
                        </SidebarMenu>
                    </div>

                    {/* Footer section - About, Matrix Tester, Settings */}
                    <div className="py-2 mb-3">
                        <SidebarMenu className="relative">
                            {activeFooterIndex !== -1 && <SlidingIndicator y={activeFooterIndex * MENU_ITEM_GAP_PX} />}
                            {footerItems.map((item) => (
                                <SidebarNavItem
                                    key={item.url}
                                    item={item}
                                    isActive={activePanel === item.url}
                                    isCollapsed={isCollapsed}
                                    onClick={handleItemSelect}
                                />
                            ))}
                        </SidebarMenu>

                    </div>
                </SidebarContent>
            </Sidebar>
        </>
    );
};

export default AppSidebar;
