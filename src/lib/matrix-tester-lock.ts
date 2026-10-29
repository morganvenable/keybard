// While the matrix tester is open, Keybard's own keyboard shortcuts do nothing
// (Delete/Backspace on a key, typing binds a key, Ctrl/Cmd+B, Ctrl/Cmd+V layer
// paste, modifier tracking). The tester also swallows key events at the window
// in the capture phase; this flag is the second guard, checked by each handler.
let open = false;

export function setMatrixTesterOpen(value: boolean): void {
    open = value;
}

export function matrixTesterOpen(): boolean {
    return open;
}
