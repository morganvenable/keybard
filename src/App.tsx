import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

import MainScreen from "./components/MainScreen";
import PrintableKeymapWrapper from "./components/PrintableKeymapWrapper";
import ExploreLayoutsPage from "./pages/ExploreLayoutsPage";
import ProofSheetPage from "./pages/ProofSheet/ProofSheetPage";

import { ChangesProvider } from "./contexts/ChangesContext";
import { DragProvider } from "./contexts/DragContext";
import { KeyBindingProvider } from "./contexts/KeyBindingContext";
import { LayoutLibraryProvider } from "./contexts/LayoutLibraryContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { VialProvider, useVial } from "./contexts/VialContext";

// Simple page navigation context
type Page = "main" | "explore" | "proof-sheet";

interface NavigationContextType {
    currentPage: Page;
    navigateTo: (page: Page) => void;
    goBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const useNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error("useNavigation must be used within NavigationProvider");
    }
    return context;
};

// Wrapper to connect VialContext's markAsSaved to ChangesProvider
const ChangesProviderWithVial = ({ children }: { children: ReactNode }) => {
    const { markAsSaved } = useVial();
    return <ChangesProvider onPush={markAsSaved}>{children}</ChangesProvider>;
};

const NavigationProvider = ({ children }: { children: ReactNode }) => {
    const [currentPage, setCurrentPage] = useState<Page>("main");

    const navigateTo = useCallback((page: Page) => {
        setCurrentPage(page);
    }, []);

    const goBack = useCallback(() => {
        setCurrentPage("main");
    }, []);

    return (
        <NavigationContext.Provider value={{ currentPage, navigateTo, goBack }}>
            {children}
        </NavigationContext.Provider>
    );
};

function AppContent() {
    const { currentPage, goBack } = useNavigation();

    return (
        <>
            {currentPage === "main" ? (
                <>
                    <MainScreen />
                    <PrintableKeymapWrapper />
                </>
            ) : currentPage === "explore" ? (
                <DragProvider>
                    <ExploreLayoutsPage onBack={goBack} />
                </DragProvider>
            ) : currentPage === "proof-sheet" ? (
                <ProofSheetPage onBack={goBack} />
            ) : null}
        </>
    );
}

function App() {
    return (
        <VialProvider>
            <SettingsProvider>
                <ChangesProviderWithVial>
                    <KeyBindingProvider>
                        <LayoutLibraryProvider>
                            <NavigationProvider>
                                <AppContent />
                            </NavigationProvider>
                        </LayoutLibraryProvider>
                    </KeyBindingProvider>
                </ChangesProviderWithVial>
            </SettingsProvider>
        </VialProvider>
    );
}

export default App;
