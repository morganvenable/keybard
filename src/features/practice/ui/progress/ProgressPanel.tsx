import { useState } from "react";

import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { PILL_INK } from "@/components/shared/pills";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePractice } from "../../PracticeProvider";
import type { PracticeController } from "../../state/controller";
import type { ProgressPeriod } from "../../state/settings";
import { AboutRow, GroupLabel, PanelFooter, Row } from "../panelRows";

// G2 Progress panel (docs/practice/spec.md §5.9), the detail panel content while the Progress page shows:
// Profile (with New profile…), Scope (period), About. Every row acts on the active profile.
// TODO(practice): M4 adds the Data rows (Export, Import with Merge or Replace, Reset).

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
            <section aria-labelledby="progress-about" className={horizontal ? "max-w-md" : undefined}>
                <GroupLabel id="progress-about">About</GroupLabel>
                <AboutRow />
            </section>
            <PanelFooter saving={false} error={c.settingsError} />
            <NewProfileDialog open={creating} onOpenChange={setCreating} onCreate={(name) => c.createProfile(name)} />
        </div>
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
