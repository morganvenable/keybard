import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useSidebar } from "@/components/ui/sidebar";
import {
    EDITOR_ROUTE,
    isPageWorkspace,
    parseWorkspaceHash,
    syncWorkspaceHash,
    WORKSPACE_HAS_PANEL,
    type PracticePage,
    type Workspace,
    type WorkspaceRoute,
} from "@/layout/workspaces";

interface PanelsContextType {
    activePanel: string | undefined | null;
    panelToGoBack: string | undefined | null;
    setPanelToGoBack: React.Dispatch<React.SetStateAction<string | null>>;
    setActivePanel: React.Dispatch<React.SetStateAction<string | null>>;
    handleCloseDetails: () => void;
    openDetails: () => void;
    alternativeHeader: boolean;
    setAlternativeHeader: React.Dispatch<React.SetStateAction<boolean>>;
    handleCloseEditor: () => void;
    itemToEdit: number | null;
    setItemToEdit: React.Dispatch<React.SetStateAction<number | null>>;
    bindingTypeToEdit: string | null;
    setBindingTypeToEdit: React.Dispatch<React.SetStateAction<string | null>>;
    initialEditorSlot: any | null;
    setInitialEditorSlot: React.Dispatch<React.SetStateAction<any | null>>;

    /** The page right of the nav rail (§4.1). Independent of activePanel: closing the panel keeps it. */
    workspace: Workspace;
    setWorkspace: (workspace: Workspace) => void;
    /** Practice page behind the Lessons · Progress pills; kept while another workspace shows. */
    practicePage: PracticePage;
    setPracticePage: (page: PracticePage) => void;
    /**
     * Where focus goes when the detail panel closes, instead of the element that opened it. Practice
     * points it at the typing surface while Lessons shows (§4.1 "Focus on close"). Null to use the opener.
     */
    returnFocusOverride: React.MutableRefObject<HTMLElement | null>;

    name: string;
    state: "expanded" | "collapsed";
    open: boolean;
    setOpen: (value: boolean | ((value: boolean) => boolean)) => void;
    openMobile: boolean;
    setOpenMobile: (value: boolean | ((value: boolean) => boolean)) => void;
    isMobile: boolean;
    toggleSidebar: () => void;
}

const PanelsContext = createContext<PanelsContextType | undefined>(undefined);

/** A workspace's nav item opens its panel unless that workspace has none yet (WORKSPACE_HAS_PANEL). */
const opensPanel = (panel: string | null) =>
    !!panel && panel !== "matrixtester" && !(isPageWorkspace(panel) && !WORKSPACE_HAS_PANEL[panel]);

export const PanelsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Deep links (§4.2), and the way Practice and Overlay survive a reconnect: a connect remounts
    // EditorLayout, and this initializer reopens the workspace, page and panel from the hash.
    const [initialRoute] = useState<WorkspaceRoute>(() => parseWorkspaceHash(window.location.hash, window.location.search) ?? EDITOR_ROUTE);
    const [workspace, setWorkspaceState] = useState<Workspace>(initialRoute.workspace);
    const [practicePage, setPracticePage] = useState<PracticePage>(initialRoute.practicePage);
    const [activePanel, setActivePanel] = useState<string | null>(initialRoute.workspace === "editor" ? null : initialRoute.workspace);
    const returnFocusOverride = useRef<HTMLElement | null>(null);
    const [alternativeHeader, setAlternativeHeader] = useState<boolean>(false);
    const [panelToGoBack, setPanelToGoBack] = useState<string | null>(null);
    const [itemToEdit, setItemToEdit] = useState<number | null>(null);
    const [bindingTypeToEdit, setBindingTypeToEdit] = useState<string | null>(null);
    const [initialEditorSlot, setInitialEditorSlot] = useState<any | null>(null);

    const sidebar = useSidebar("details-panel", { defaultOpen: false });
    const { open: detailsOpen, setOpen } = sidebar;

    // The shared detail shell uses the same open state in either placement.
    const openDetails = useCallback(() => setOpen(true), [setOpen]);
    const closeDetails = useCallback(() => setOpen(false), [setOpen]);

    useEffect(() => {
        if (opensPanel(activePanel) && !detailsOpen) {
            openDetails();
        }

        if ((!activePanel || (activePanel !== "matrixtester" && !opensPanel(activePanel))) && detailsOpen) {
            closeDetails();
        }
    }, [activePanel, detailsOpen, openDetails, closeDetails]);

    const setWorkspace = useCallback((next: Workspace) => setWorkspaceState(next), []);

    // Switching workspace or Practice page rewrites the hash without a history entry (§4.2).
    useEffect(() => {
        syncWorkspaceHash({ workspace, practicePage });
    }, [workspace, practicePage]);

    // A workspace hash entered while Keybard is open (the address bar, a link) acts like a nav click,
    // so the address bar and the page never disagree. Other hash changes are ignored.
    useEffect(() => {
        const onHashChange = () => {
            const route = parseWorkspaceHash(window.location.hash, window.location.search);
            if (!route || route.workspace === "editor") return;
            setWorkspaceState(route.workspace);
            setPracticePage(route.practicePage);
            setActivePanel(route.workspace);
            setPanelToGoBack(null);
            setAlternativeHeader(false);
            setItemToEdit(null);
            // Re-canonicalize (#trainer → #overlay) even when the route didn't change.
            syncWorkspaceHash(route);
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    // The typing-surface override belongs to Practice; drop it whenever Practice isn't showing.
    useEffect(() => {
        if (workspace !== "practice") returnFocusOverride.current = null;
    }, [workspace]);

    const handleCloseDetails = useCallback(() => {
        closeDetails();
        setActivePanel(null);
    }, [closeDetails]);

    const handleCloseEditor = useCallback(() => {
        setItemToEdit(null);
        setActivePanel(panelToGoBack);
        setAlternativeHeader(false);
        setPanelToGoBack(null);
        setInitialEditorSlot(null);
    }, [panelToGoBack]);

    return (
        <PanelsContext.Provider
            value={{
                activePanel,
                setActivePanel,
                handleCloseDetails,
                openDetails,
                alternativeHeader,
                setAlternativeHeader,
                panelToGoBack,
                setPanelToGoBack,
                handleCloseEditor,
                itemToEdit,
                setItemToEdit,
                bindingTypeToEdit,
                setBindingTypeToEdit,
                initialEditorSlot,
                setInitialEditorSlot,
                workspace,
                setWorkspace,
                practicePage,
                setPracticePage,
                returnFocusOverride,
                ...sidebar,
            }}
        >
            {children}
        </PanelsContext.Provider>
    );
};

export const usePanels = (): PanelsContextType => {
    const context = useContext(PanelsContext);
    if (!context) {
        throw new Error("usePanels must be used within a PanelsProvider");
    }
    return context;
};
