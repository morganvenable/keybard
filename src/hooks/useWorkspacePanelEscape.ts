import { useCallback, type KeyboardEvent } from "react";

// Esc closes the Practice and Overlay detail panels (docs/practice/spec.md §4.1 "Close, focus and Esc").
// Editor panels don't close on Esc, so this lives in those two panels, not in SecondarySidebar.
//
// The handler goes on the panel root as a React onKeyDown, so it also sees Esc from portaled
// descendants (ui/select content, popovers). Each open layer closes itself first: one Esc on an open
// select closes only the select; a second Esc closes the panel.

/**
 * Open layers that own their Esc: select lists, popovers and dialogs (Radix gives popover content
 * role="dialog"). Not every [data-state="open"]: an expanded accordion or collapsible carries it too,
 * and Esc inside one should still close the panel.
 */
const OWN_ESCAPE = '[role="listbox"], [role="dialog"], [role="alertdialog"], [role="menu"]';

/** A select or menu trigger whose list is open (focus can stay on the trigger). */
function isOpenTrigger(target: Element): boolean {
    return target.getAttribute("aria-expanded") === "true"
        && (target.getAttribute("role") === "combobox" || target.hasAttribute("aria-haspopup"));
}

/** Text inputs being edited keep Esc (to cancel the edit). Buttons, checkboxes and sliders don't. */
function isEditingText(target: Element): boolean {
    if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled;
    if (target instanceof HTMLInputElement) {
        const textual = ["text", "search", "email", "url", "tel", "password", "number"].includes(target.type);
        return textual && !target.readOnly && !target.disabled;
    }
    return target instanceof HTMLElement && target.isContentEditable;
}

export function shouldPanelHandleEscape(event: Pick<KeyboardEvent, "key" | "defaultPrevented" | "target">): boolean {
    if (event.key !== "Escape" || event.defaultPrevented) return false;
    const target = event.target;
    if (!(target instanceof Element)) return true;
    if (target.closest(OWN_ESCAPE) || isOpenTrigger(target)) return false;
    return !isEditingText(target);
}

export function useWorkspacePanelEscape(onClose: () => void) {
    return useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            if (!shouldPanelHandleEscape(event)) return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
        },
        [onClose],
    );
}
