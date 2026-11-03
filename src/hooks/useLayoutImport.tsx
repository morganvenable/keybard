import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { useChanges } from '@/contexts/ChangesContext';
import { fileService } from '@/services/file.service';
import { prepareImport, type ImportReview } from '@/services/import-preflight';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { ImportSettingsNotes } from '@/components/ImportSettingsNotes';
import { readBoard } from '@/services/board-read';
import { landLayout, LayoutNotLanded, planWrites } from '@/features/firmware/restore';

const NOT_SAVED = 'Some imported changes could not be saved. They remain in pending changes. Retry Apply after restoring the connection.';

export function useLayoutImport() {
    const { keyboard, setKeyboard, isConnected, setIsImporting, loadFromFile, markAsSaved, getKeyboardSnapshot } = useKeyboard();
    const { queue, todo, isInstant, commit, isSaving, error: changesError } = useChanges();
    const [review, setReview] = useState<{ plan: ImportReview; imported: KeyboardInfo; target: KeyboardInfo | null; connected: boolean; filename: string; file: File } | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [applying, setApplying] = useState(false);

    // Manual updates: once Apply has written a staged import, read the board back and compare.
    const verifyAfterApply = useRef(false);
    const wasSaving = useRef(false);
    useEffect(() => {
        const finished = wasSaving.current && !isSaving;
        wasSaving.current = isSaving;
        if (!verifyAfterApply.current) return;
        const pending = Object.keys(todo).length;
        // Discarded: nothing left to check.
        if (!pending && !isSaving && !finished) { verifyAfterApply.current = false; return; }
        if (!finished || pending || changesError) return;
        verifyAfterApply.current = false;
        const wanted = getKeyboardSnapshot();
        if (!wanted) return;
        void (async () => {
            try {
                await landLayout(wanted, await readBoard(), { queue, commit, readBoard });
            } catch (error) {
                if (error instanceof LayoutNotLanded) { setKeyboard(error.board); markAsSaved(error.board); }
                setFileError(error instanceof Error ? error.message : String(error));
            }
        })();
    }, [isSaving, todo, changesError, getKeyboardSnapshot, queue, commit, setKeyboard, markAsSaved]);

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        await reviewFile(file);
    };

    /** Open the import review for a layout file (also used to restore backups). */
    const reviewFile = async (file: File) => {
        setFileError(null);
        if (Object.keys(todo).length || isSaving) {
            setFileError('Apply or discard your pending changes before importing a layout.');
            return;
        }
        setIsImporting(true);
        try {
            const imported = await fileService.uploadFile(file);
            setReview({ plan: prepareImport(imported, isConnected && keyboard ? keyboard : undefined), imported, target: keyboard, connected: isConnected, filename: file.name, file });
        } catch (error) {
            setFileError(error instanceof Error ? error.message : String(error));
        } finally { setIsImporting(false); }
    };

    const applyImport = async () => {
        if (!review || review.plan.errors.length) return;
        if (review.target !== keyboard || review.connected !== isConnected || Object.keys(todo).length || isSaving) {
            setFileError('The editing target or pending changes changed. Close this review and select the file again.');
            return;
        }
        setApplying(true);
        setFileError(null);
        try {
            if (!isConnected) {
                if (await loadFromFile(review.file) === false) return;
            } else if (keyboard) {
                // Planned against the board as read now, never the editor's copy: after an update
                // or a reset the board holds its defaults, whatever the editor last showed.
                const board = await readBoard();
                const plan = prepareImport(review.imported, board);
                if (plan.errors.length) throw new Error(plan.errors.join(' '));
                markAsSaved(board);
                setKeyboard(plan.keyboard);
                const target = { queue, commit, readBoard };
                if (isInstant) {
                    try {
                        await landLayout(plan.keyboard, board, target);
                    } catch (error) {
                        if (error instanceof LayoutNotLanded) { setKeyboard(error.board); markAsSaved(error.board); throw error; }
                        throw new Error(NOT_SAVED);
                    }
                } else {
                    // Manual updates: staged now; read back once Apply has written them.
                    const writes = await planWrites(plan.keyboard, board);
                    await Promise.all(writes.map(w => queue(w.desc, w.cb, { ...w.metadata, deferCommit: true })));
                    verifyAfterApply.current = writes.length > 0;
                }
            }
            setReview(null);
        } catch (error) {
            setFileError(error instanceof Error ? error.message : String(error));
            setReview(null);
        } finally { setApplying(false); }
    };

    const importReview = <>
        {fileError && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{fileError}</p>}
        <Dialog open={!!review} onOpenChange={open => { if (!open && !applying) setReview(null); }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Review layout import</DialogTitle>
                    <DialogDescription>{review?.filename} — {isConnected ? `replace matching entries on ${keyboard?.name || 'the connected keyboard'}` : 'open as an offline layout'}.</DialogDescription>
                </DialogHeader>
                <ul className="list-disc pl-5 text-sm space-y-1">{review?.plan.summary.map((line, i) => <li key={i}>{line}</li>)}</ul>
                {!!review?.plan.errors.length && <div role="alert" className="text-sm text-red-700 dark:text-red-400"><p className="font-semibold">Cannot import this file</p><ul className="list-disc pl-5">{review.plan.errors.map((line, i) => <li key={i}>{line}</li>)}</ul></div>}
                {!!review?.plan.warnings.length && <div className="text-sm"><p className="font-semibold">Review before applying</p><ul className="list-disc pl-5">{review.plan.warnings.map((line, i) => <li key={i}>{line}</li>)}</ul></div>}
                {review && <ImportSettingsNotes replaced={review.plan.replaced} unavailable={review.plan.unavailable} done={false} />}
                {fileError && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{fileError}</p>}
                <p className="text-sm">{isConnected ? (isInstant ? 'Applying writes these changes to the keyboard. Save a backup first so you can restore the previous layout.' : 'This will stage changes in Manual mode. Nothing is written until you use Apply.') : 'This replaces the current offline layout.'}</p>
                <DialogFooter className="flex-wrap">
                    {keyboard && <Button variant="secondary" disabled={applying} onClick={async () => { try { await fileService.downloadSvil(keyboard); } catch (error) { setFileError(error instanceof Error ? error.message : String(error)); } }}>Back up current layout</Button>}
                    <Button variant="secondary" disabled={applying} onClick={() => setReview(null)}>Cancel</Button>
                    <Button disabled={applying || !!review?.plan.errors.length} onClick={applyImport}>{applying ? 'Applying…' : isConnected ? (isInstant ? 'Apply import' : 'Stage import') : 'Open layout'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>;

    return { handleFileImport, reviewFile, importReview, fileError, setFileError };
}
