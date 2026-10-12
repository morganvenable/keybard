import KeyboardIcon from "@/components/icons/Keyboard";
import { LayoutImport } from "@/components/icons/LayoutImport";
import Settings2Icon from "@/components/icons/Settings2Icon";
import { useEffect, useRef, useState } from "react";
import { BarChart3, BookOpen, ChevronRight, FileText, Loader2, Menu, Moon, Sprout, Sun, Target, PlugZap, Unplug, X, type LucideIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import ThemeSync from "@/components/ThemeSync";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PILL_BRAND, PILL_QUIET } from "@/components/shared/pills";
import { LAYOUTS } from "@/components/Keyboards/layouts";
import { KeyboardProvider, useKeyboard } from "@/contexts/KeyboardContext";
import { LayoutSettingsProvider, useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { PanelsProvider, usePanels } from "@/contexts/PanelsContext";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import { PracticeProvider, usePractice } from "@/features/practice/PracticeProvider";
import PracticeWorkspace from "@/features/practice/PracticeWorkspace";
import PracticePanel from "@/features/practice/PracticePanel";
import { PracticePresentation } from "@/features/practice/presentation";
import { effectiveLessonType } from "@/features/practice/state/settings";
import { AboutRow } from "@/features/practice/ui/panelRows";
import type { LessonType } from "@/features/practice/types";
import { cn } from "@/lib/utils";
import demoLayoutUrl from "@/default-layouts/sval-default.svil?url";

const MODES: { id: LessonType; title: string; description: string; icon: LucideIcon }[] = [
    { id: "guided", title: "Guided", description: "Build your confidence, key by key", icon: Sprout },
    { id: "drill", title: "Drill", description: "Give the tricky keys a little attention", icon: Target },
    { id: "words", title: "Words", description: "Find your rhythm with real words", icon: BookOpen },
    { id: "custom", title: "Custom", description: "Practice something of your own", icon: FileText },
];

export default function SvalbrApp() {
    return <KeyboardProvider><SettingsProvider><ThemeSync /><LayoutSettingsProvider>
        <SidebarProvider className="svalbr-root"><PanelsProvider practiceOnly><PracticeProvider><Trainer /></PracticeProvider></PanelsProvider></SidebarProvider>
    </LayoutSettingsProvider></SettingsProvider></KeyboardProvider>;
}

function Trainer() {
    const c = usePractice();
    const { keyboard, loadedFrom, isConnected, connectionState, isChangingTarget, isImporting, connect, disconnect, loadFromFile, isWebHIDSupported, connectionError } = useKeyboard();
    const { practicePage, setPracticePage, activePanel, setActivePanel, handleCloseDetails } = usePanels();
    const { internationalLayout, setInternationalLayout } = useLayoutSettings();
    const { getSetting, updateSetting } = useSettings();
    const [navOpen, setNavOpen] = useState(false);
    const [sourceOpen, setSourceOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const type = effectiveLessonType(c?.settings.type ?? "guided");
    const mode = MODES.find(m => m.id === type)!;
    const progress = practicePage === "progress";
    const title = progress ? "Your progress" : practicePage === "lab" ? "Input lab" : c?.session?.firstRun ? "Welcome to Svalbr" : mode.title;
    const pending = busy || isChangingTarget || isImporting || connectionState === "connecting" || connectionState === "loading";
    const panelOpen = !!activePanel;

    // Modal focus pauses typing, including while a user is changing their keymap.
    useEffect(() => { if (sourceOpen || panelOpen || navOpen) c?.setFocused(false); }, [sourceOpen, panelOpen, navOpen, c]);

    const task = async (action: () => Promise<unknown>) => {
        setBusy(true); setError(null);
        try { const result = await action(); if (result !== false) setSourceOpen(false); }
        catch (e) { setError(e instanceof Error ? e.message : "Couldn't load this keymap. Please try again."); }
        finally { setBusy(false); }
    };
    const example = () => task(async () => {
        const response = await fetch(demoLayoutUrl);
        if (!response.ok) throw new Error("Couldn't load the example. Please try again.");
        return loadFromFile(new File([await response.blob()], "sval-default.svil", { type: "application/json" }), "demo");
    });
    const chooseMode = (id: LessonType) => {
        c?.update({ type: id }); setPracticePage("lessons"); handleCloseDetails(); setNavOpen(false);
    };
    const sourceControls = <>
        <button type="button" className={PILL_BRAND} disabled={pending || !isWebHIDSupported} onClick={() => void task(connect)}><Unplug size={16} />Connect Svalboard</button>
        <button type="button" className={PILL_QUIET} disabled={pending} onClick={() => input.current?.click()}><LayoutImport className="size-4" />Import keymap</button>
        <button type="button" className={PILL_QUIET} disabled={pending} onClick={() => void example()}>Try QWERTY example<ChevronRight size={16} /></button>
        {!isWebHIDSupported && <p className="svalbr-help">USB connection needs Chrome or Edge. You can still use an imported keymap or the example.</p>}
        {isConnected && <button type="button" className={PILL_QUIET} disabled={pending} onClick={() => void task(disconnect)}>Disconnect board</button>}
    </>;

    return <PracticePresentation.Provider value={{ standalone: true, title, chooseKeymap: () => setSourceOpen(true) }}>
        <input ref={input} type="file" accept=".svil,.vil,.kbi,.json" className="sr-only" aria-label="Import a keymap" onChange={e => {
            const file = e.target.files?.[0]; e.target.value = "";
            if (file) void task(() => loadFromFile(file));
        }} />
        <div className="svalbr-app">
            <aside className="svalbr-sidebar" aria-label="Svalbr navigation">
                <a className="svalbr-brand" href="#practice" onClick={() => { setPracticePage("lessons"); setNavOpen(false); }}>
                    <span className="svalbr-mark"><KeyboardIcon className="w-6 h-4" /></span>
                    <span><strong>Svalbr</strong><small>Svalboard typing practice</small></span>
                </a>
                <button className="svalbr-mobile-menu svalbr-icon" aria-label={navOpen ? "Close navigation" : "Open navigation"} aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>{navOpen ? <X size={20} /> : <Menu size={20} />}</button>
                <div className={cn("svalbr-nav-body", navOpen && "is-open")}>
                    <p className="svalbr-eyebrow">Practice</p>
                    <nav aria-label="Training modes">
                        {MODES.map(({ id, title: label, icon: Icon }) => <button type="button" key={id} className={cn("svalbr-nav-item", !progress && type === id && "is-active")} aria-current={!progress && type === id ? "page" : undefined} disabled={!c || !keyboard || c.session?.firstRun} onClick={() => chooseMode(id)}><Icon size={19} strokeWidth={2} /><span>{label}</span></button>)}
                        <div className="svalbr-nav-divider" />
                        <button type="button" className={cn("svalbr-nav-item", progress && "is-active")} aria-current={progress ? "page" : undefined} disabled={!keyboard} onClick={() => { setPracticePage("progress"); handleCloseDetails(); setNavOpen(false); }}><BarChart3 size={19} strokeWidth={2} />Progress</button>
                    </nav>
                    <div className="svalbr-sidebar-bottom">
                        <button type="button" className="svalbr-source" onClick={() => { setSourceOpen(true); setNavOpen(false); }}>{isConnected ? <PlugZap size={18} /> : <KeyboardIcon className="w-5 h-4" />}<span><strong>{isConnected ? "Svalboard connected" : keyboard ? "Keymap loaded" : "Choose your keymap"}</strong><small>{loadedFrom ?? "Connect, import, or try an example"}</small></span><ChevronRight size={15} /></button>
                        <div className="svalbr-sidebar-footer"><a href="https://keybard.svalboard.com" target="_blank" rel="noreferrer">Made with Keybard</a><button type="button" className="svalbr-icon" aria-label={getSetting("theme") === "dark" ? "Use light theme" : "Use dark theme"} onClick={() => updateSetting("theme", getSetting("theme") === "dark" ? "light" : "dark")}>{getSetting("theme") === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button></div>
                    </div>
                </div>
            </aside>
            <div className="svalbr-main">
                <div className="svalbr-topbar"><span>{progress ? "A little practice adds up." : mode.description}</span><button type="button" className={PILL_QUIET} disabled={!keyboard} onClick={() => setActivePanel("practice")}><Settings2Icon className="size-4" />{progress ? "Progress & data" : "Lesson settings"}</button></div>
                {(error || connectionError) && <div role="alert" className="svalbr-error">{error || connectionError}<button className="svalbr-icon" aria-label="Choose another keymap" onClick={() => setSourceOpen(true)}><ChevronRight size={16} /></button></div>}
                {pending && <div role="status" className="svalbr-loading"><Loader2 size={18} className="animate-spin" />Loading your keymap…</div>}
                <main id="trainer-content" inert={pending}>
                    {keyboard ? <PracticeWorkspace /> : <section className="svalbr-welcome">
                        <span className="svalbr-welcome-mark"><Sprout size={34} strokeWidth={2} /></span>
                        <p className="svalbr-eyebrow">One key at a time</p><h1>Make yourself at home<br />on your Svalboard.</h1>
                        <p>Guided lessons, focused drills, and a little daily practice.<br className="svalbr-desktop" /> Start with the keymap you actually use.</p>
                        <div className="svalbr-source-actions">{sourceControls}</div>
                        <p className="svalbr-help">Your progress stays in this browser. No account needed.</p>
                    </section>}
                </main>
            </div>
        </div>
        <Dialog.Root open={panelOpen} onOpenChange={open => { if (!open) handleCloseDetails(); }}>
            <Dialog.Portal><Dialog.Overlay className="svalbr-dialog-overlay" /><Dialog.Content className="svalbr-settings" onCloseAutoFocus={e => { e.preventDefault(); document.querySelector<HTMLTextAreaElement>('main textarea')?.focus(); }}>
                <div className="svalbr-dialog-heading"><Dialog.Title>{activePanel === "settings" ? "Keyboard & appearance" : progress ? "Progress & data" : "Lesson settings"}</Dialog.Title><Dialog.Close className="svalbr-icon" aria-label="Close settings"><X size={20} /></Dialog.Close></div>
                <Dialog.Description className="sr-only">Adjust your practice preferences.</Dialog.Description>
                <div className="svalbr-settings-scroll">{activePanel === "settings" ? <>
                    <label className="svalbr-field">OS keyboard layout<select value={internationalLayout} onChange={e => setInternationalLayout(e.target.value)}>{Object.entries(LAYOUTS).map(([id, layout]) => <option key={id} value={id}>{layout.label}</option>)}</select></label>
                    <label className="svalbr-field">Appearance<select value={String(getSetting("theme") ?? "light")} onChange={e => updateSetting("theme", e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label><AboutRow />
                </> : <PracticePanel />}</div>
            </Dialog.Content></Dialog.Portal>
        </Dialog.Root>
        <Dialog.Root open={sourceOpen} onOpenChange={setSourceOpen}><Dialog.Portal><Dialog.Overlay className="svalbr-dialog-overlay" /><Dialog.Content className="svalbr-source-dialog">
            <div className="svalbr-dialog-heading"><Dialog.Title>Your keymap</Dialog.Title><Dialog.Close className="svalbr-icon" aria-label="Close keymap dialog"><X size={20} /></Dialog.Close></div>
            <Dialog.Description className="svalbr-help">Practice the layout you use, or start with the Svalboard QWERTY example.</Dialog.Description>
            <div className="svalbr-source-actions">{sourceControls}</div>
            {(error || connectionError) && <p role="alert" className="svalbr-error">{error || connectionError}</p>}
        </Dialog.Content></Dialog.Portal></Dialog.Root>
    </PracticePresentation.Provider>;
}
