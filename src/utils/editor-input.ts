/** Editing shortcuts must yield to form controls, dialogs and ordinary navigation. */
export function isEditorInput(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest(
        'input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], [role="menu"], [role="combobox"], [role="slider"]',
    );
}
