"""Run with ``python -m context_companion [--demo]``."""
import argparse


def main():
    parser = argparse.ArgumentParser(description="Keybard Windows context companion")
    parser.add_argument("--demo", action="store_true", help="Connect a simulated keyboard; never write to hardware")
    parser.add_argument("--smoke-test", action="store_true", help="Launch demo UI and close automatically for build validation")
    args = parser.parse_args()
    from . import windows
    from .browser import BrowserBridge
    from .ui import run

    bridge = None
    try:
        bridge = BrowserBridge(windows.foreground)
        bridge.start()
        run(browser_provider=bridge.snapshot, browser_bridge=bridge,
            demo=args.demo or args.smoke_test, smoke_test=args.smoke_test)
    except Exception as exc:
        if args.smoke_test:
            raise
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("Keybard Context — startup failed", f"{exc}\n\nIf another copy of Keybard Context is running, close it and try again.", parent=root)
        root.destroy()
    finally:
        if bridge:
            bridge.stop()


if __name__ == "__main__":
    main()
