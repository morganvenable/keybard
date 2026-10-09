import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";

import { SegmentedControl } from "@/components/shared/SegmentedControl";
import OnOffToggle from "@/components/ui/OnOffToggle";
import { PILL_INK } from "@/components/shared/pills";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePractice } from "../../PracticeProvider";
import type { PracticeController } from "../../state/controller";
import type { ProgressPeriod } from "../../state/settings";
import { type ImportMode, type ParsedImport, readImportFile } from "../../store/export";
import { AboutRow, GroupLabel, PanelFooter, Row } from "../panelRows";
import { COLOR_BLIND_HEAT_SETTING } from "./heat";

// G2 Progress panel (docs/practice/spec.md §5.9), the detail panel content while the Progress page shows:
// Profile (with New profile…), Scope (period), Data (Export with Include keystrokes, Import with Merge or
// Replace, Reset) and About. Every row acts on the active profile. Replacing or deleting data takes two
// steps: a destructive button, then a confirm dialog. With Storage off (or a newer schema) Import and Reset
// say why they are not available; Export still exports this session's lessons.

const NEW_PROFILE = "__new";

const PERIODS: { value: ProgressPeriod; label: string }[] = [
    { value: "7", label: "7 days" },
    { value: "30", label: "30 days" },
    { value: "all", label: "All" },
];

export default function ProgressPanel({ horizontal = false }: { horizontal?: boolean }) {
    const controller = usePractice();
    if (!controller) return null;
    return <ProgressRows controller={controller} horizontal={horizontal} />;
}

function ProgressRows({ controller: c, horizontal }: { controller: PracticeController; horizontal: boolean }) {
    const [creating, setCreating] = useState(false);
    const active = c.session?.profile.id ?? c.settings.activeProfileId ?? "me";
    const group = horizontal ? "grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-x-4 items-start" : "flex flex-col";
    return (
        <div data-practice-panel="progress" className="flex flex-col pb-2">
            <section aria-labelledby="progress-profile">
                <GroupLabel id="progress-profile">Profile</GroupLabel>
                <div className={group}>
                    <Row title="Profile" titleId="progress-profile-select">
                        <Select value={active} onValueChange={(id) => (id === NEW_PROFILE ? setCreating(true) : c.selectProfile(id))}>
                            <SelectTrigger aria-labelledby="progress-profile-select" className="min-w-40 max-w-full bg-kb-surface"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {(c.profiles.length ? c.profiles : c.session ? [c.session.profile] : []).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                                <SelectSeparator />
                                <SelectItem value={NEW_PROFILE}>New profile…</SelectItem>
                            </SelectContent>
                        </Select>
                    </Row>
                </div>
            </section>
            <section aria-labelledby="progress-scope">
                <GroupLabel id="progress-scope">Scope</GroupLabel>
                <div className={group}>
                    <Row title="Period">
                        <SegmentedControl label="Period" value={c.settings.period} onChange={(period) => c.update({ period })} options={PERIODS} />
                    </Row>
                </div>
            </section>
            {COLOR_BLIND_HEAT_SETTING && <HeatColorsRow group={group} />}
            <DataSection controller={c} group={group} />
            <section aria-labelledby="progress-about" className={horizontal ? "max-w-md" : undefined}>
                <GroupLabel id="progress-about">About</GroupLabel>
                <AboutRow />
            </section>
            <PanelFooter saving={false} error={c.settingsError} />
            <NewProfileDialog open={creating} onOpenChange={setCreating} onCreate={(name) => c.createProfile(name)} />
        </div>
    );
}

/**
 * OWNER_Q9 stub: the Heat colors row (§5.0.2 item 4), shown only when Q9 is answered yes.
 * TODO(practice): Q9 yes → bind this to a `heatPalette` setting with a SegmentedControl
 * (Standard · Color-blind) and the color-blind HEAT_FACE set in heat.ts. Until then it only marks the place.
 */
function HeatColorsRow({ group }: { group: string }) {
    return (
        <section aria-labelledby="progress-heat">
            <GroupLabel id="progress-heat">Heatmap</GroupLabel>
            <div className={group}>
                <Row title="Heat colors" value="Standard" />
            </div>
        </section>
    );
}

/** Saves text as a file through a temporary link (no network; works in Paranoid). */
export function downloadText(filename: string, text: string, type = "application/json") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A chosen file's text (FileReader where Blob.text is missing). */
function readText(file: File): Promise<string> {
    if (typeof file.text === "function") return file.text();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

const NOT_AVAILABLE = "Not available · progress isn't being saved";
const READ_ONLY = "Not available · progress was saved by a newer Keybard";
const ERROR_LINE = "text-sm text-red-700 dark:text-red-400";

type ImportState =
    | { kind: "idle"; done?: string }
    | { kind: "parsed"; file: ParsedImport; mode: ImportMode; failed?: boolean }
    | { kind: "invalid" };

function DataSection({ controller: c, group }: { controller: PracticeController; group: string }) {
    const input = useRef<HTMLInputElement | null>(null);
    const [state, setState] = useState<ImportState>({ kind: "idle" });
    const [confirm, setConfirm] = useState<"replace" | "reset" | null>(null);
    const [busy, setBusy] = useState(false);
    const [exportFailed, setExportFailed] = useState(false);
    const [resetFailed, setResetFailed] = useState(false);
    const profile = c.session?.profile.name ?? "Me";
    const writable = c.dataWritable;
    const unavailable = c.storageOff ? NOT_AVAILABLE : READ_ONLY;

    const exportNow = async () => {
        try {
            const { filename, text } = await c.exportData();
            downloadText(filename, text);
            setExportFailed(false);
        } catch {
            setExportFailed(true);
        }
    };

    const choose = async (file: File | undefined) => {
        if (!file) return;
        try {
            setState({ kind: "parsed", file: readImportFile(await readText(file)), mode: "merge" });
        } catch {
            setState({ kind: "invalid" });
        }
    };

    const commit = async (mode: ImportMode) => {
        if (state.kind !== "parsed") return;
        setBusy(true);
        try {
            const summary = await c.importData(state.file.json, mode);
            setState({ kind: "idle", done: `${summary.added} ${summary.added === 1 ? "lesson" : "lessons"} imported` });
        } catch {
            setState({ ...state, failed: true });
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    const reset = async () => {
        setBusy(true);
        try {
            await c.resetProgress();
            setState({ kind: "idle" });
            setResetFailed(false);
        } catch {
            setResetFailed(true);
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    const lessons = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "lesson" : "lessons"}`;
    const importValue = state.kind === "parsed"
        ? <span className="tabular-nums" data-import-counts>{lessons(state.file.lessons)} · {state.file.profiles} {state.file.profiles === 1 ? "profile" : "profiles"}</span>
        : state.kind === "invalid" ? <span role="alert" className={ERROR_LINE}>Not a Keybard practice file</span>
        : state.done;
    return (
        <section aria-labelledby="progress-data" data-progress-data>
            <GroupLabel id="progress-data">Data</GroupLabel>
            <div className={group}>
                <Row title="Export" value={exportFailed ? <span role="alert" className={ERROR_LINE}>Export failed</span> : undefined}>
                    <Button type="button" variant="outline" onClick={() => void exportNow()}><Download aria-hidden="true" />Export…</Button>
                </Row>
                <Row title="Include keystrokes">
                    <OnOffToggle label="Include keystrokes" value={c.settings.exportKeystrokes} onToggle={(exportKeystrokes) => c.update({ exportKeystrokes })} />
                </Row>
                {writable ? (
                    <>
                        <Row title="Import" value={importValue}>
                            <Button type="button" variant="outline" onClick={() => input.current?.click()}><Upload aria-hidden="true" />Import…</Button>
                            <input ref={input} type="file" accept=".json,application/json" hidden aria-hidden="true" tabIndex={-1} data-progress-import-file
                                onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
                        </Row>
                        {state.kind === "parsed" && (
                            <>
                                <Row title="Mode">
                                    <SegmentedControl label="Import mode" value={state.mode} onChange={(mode) => setState({ ...state, mode, failed: false })}
                                        options={[{ value: "merge", label: "Merge" }, { value: "replace", label: "Replace" }]} />
                                </Row>
                                <div className="flex flex-wrap items-center justify-end gap-3 p-3 panel-layer-item">
                                    {state.failed && <span role="alert" className={ERROR_LINE}>{state.mode === "replace" && state.file.lessons === 0 ? "The file has no lessons to replace with" : "Import failed"}</span>}
                                    {state.mode === "merge"
                                        ? <button type="button" className={PILL_INK} disabled={busy} onClick={() => void commit("merge")}>Import</button>
                                        : <Button type="button" variant="destructive" disabled={busy} onClick={() => setConfirm("replace")}><Trash2 aria-hidden="true" />Replace progress…</Button>}
                                </div>
                            </>
                        )}
                        <Row title="Reset" value={resetFailed ? <span role="alert" className={ERROR_LINE}>Reset failed</span> : undefined}>
                            <Button type="button" variant="destructive" onClick={() => setConfirm("reset")}><Trash2 aria-hidden="true" />Reset progress…</Button>
                        </Row>
                    </>
                ) : (
                    <>
                        <Row title="Import" value={unavailable} />
                        <Row title="Reset" value={unavailable} />
                    </>
                )}
            </div>
            <ConfirmDialog
                open={confirm != null}
                onOpenChange={(open) => { if (!open) setConfirm(null); }}
                title={confirm === "replace" ? `Replace progress for ${profile}?` : `Delete progress for ${profile}?`}
                line={`${lessons(c.lessonCount)} will be deleted`}
                action={confirm === "replace" ? "Replace" : "Delete"}
                busy={busy}
                onConfirm={() => void (confirm === "replace" ? commit("replace") : reset())}
            />
        </section>
    );
}

function ConfirmDialog({ open, onOpenChange, title, line, action, busy, onConfirm }: {
    open: boolean; onOpenChange: (open: boolean) => void; title: string; line: string; action: string; busy: boolean; onConfirm: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{line}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>{action}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function NewProfileDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (name: string) => Promise<unknown> }) {
    const [name, setName] = useState("");
    const [failed, setFailed] = useState(false);
    const create = async () => {
        const created = await onCreate(name);
        if (!created) { setFailed(true); return; }
        setName("");
        setFailed(false);
        onOpenChange(false);
    };
    return (
        <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setName(""); setFailed(false); } }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>New profile</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    <Input aria-label="Profile name" value={name} maxLength={40} autoFocus onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) { event.preventDefault(); void create(); } }} />
                    {failed && <p role="alert" className="text-sm text-red-700 dark:text-red-400">Profile couldn't be created</p>}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <button type="button" className={PILL_INK} disabled={!name.trim()} onClick={() => void create()}>Create</button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
