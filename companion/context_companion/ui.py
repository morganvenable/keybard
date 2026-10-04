"""Native draft editor. All device changes require an explicit Enable action."""
from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import time
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog, ttk

from . import device, engine, model, windows


class App:
    def __init__(self, root, browser_provider=None, demo=False, browser_bridge=None):
        self.worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="keyboard-io")
        self.pending = []
        self.closing = False
        self.root = root
        self.browser_provider = browser_provider or (lambda: None)
        self.browser_bridge = browser_bridge
        self.config = model.Config(default_layer=None, rules=[])
        self.device = None
        self.engine = None
        self.layer_count = 16
        self.path = None
        self.settings_dir = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".config")) / "KeybardContext"
        self.enabled = False
        self.demo = demo
        self.demo_seeded = demo
        self.devices = []
        self.selected_rule = None
        self.root.title("Keybard Context — Windows draft")
        self.root.geometry("1100x780")
        self.root.minsize(920, 650)
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self._build()
        self.refresh_devices()
        if not demo:
            self.restore_config()
        if demo:
            self.config = model.Config(default_layer=None, rules=[model.Rule(name="Onshape", exe="chrome.exe", origin="https://cad.onshape.com", layer=1)])
            self.refresh_rules()
            self.connect()
        self.root.after(250, self.tick)

    def _build(self):
        outer = ttk.Frame(self.root, padding=18)
        outer.pack(fill="both", expand=True)
        ttk.Label(outer, text="App-specific layers", font=("Segoe UI", 22, "bold")).pack(anchor="w")
        ttk.Label(outer, text="Select an existing keyboard layer when an app or Onshape has focus.").pack(anchor="w", pady=(4, 16))
        connection = ttk.Frame(outer)
        connection.pack(fill="x")
        self.device_choice = ttk.Combobox(connection, state="readonly", width=53)
        self.device_choice.pack(side="left")
        ttk.Button(connection, text="Refresh", command=self.refresh_devices).pack(side="left", padx=4)
        ttk.Button(connection, text="Connect", command=self.connect).pack(side="left")
        self.enable_button = ttk.Button(connection, text="Enable app switching", command=self.toggle_enabled, state="disabled")
        self.enable_button.pack(side="left", padx=4)
        self.status = tk.StringVar(value="Disconnected. Prepare your layers in Keybard, then connect here.")
        ttk.Label(outer, textvariable=self.status, wraplength=1040, font=("Segoe UI", 11, "bold")).pack(anchor="w", pady=(12, 4))
        self.context_status = tk.StringVar(value="App matching works directly; Onshape tab matching needs the browser extension.")
        ttk.Label(outer, textvariable=self.context_status, wraplength=1040).pack(anchor="w", pady=(0, 10))
        simulator = ttk.Frame(outer)
        simulator.pack(fill="x", pady=(0, 10))
        ttk.Label(simulator, text="Demo keyboard only — simulate focus:").pack(side="left")
        self.demo_context = ttk.Combobox(simulator, values=("Desktop", "Onshape in Chrome", "Another Chrome tab"), state="readonly", width=26)
        self.demo_context.current(0)
        self.demo_context.pack(side="left", padx=8)
        bar = ttk.Frame(outer)
        bar.pack(fill="x", pady=(0, 12))
        ttk.Button(bar, text="Open config…", command=self.load).pack(side="left")
        ttk.Button(bar, text="Save config…", command=self.save).pack(side="left", padx=4)
        ttk.Button(bar, text="Use default", command=self.typing).pack(side="right")
        ttk.Button(bar, text="Follow apps", command=lambda: self.pin(None)).pack(side="right", padx=4)
        ttk.Button(bar, text="Pin selected app layer", command=self.pin_selected).pack(side="right")
        if self.browser_bridge:
            bridge_row = ttk.Frame(outer)
            bridge_row.pack(fill="x", pady=(0, 12))
            ttk.Label(bridge_row, text="Onshape: load browser-extension in Chrome, then paste the pairing token into its options.").pack(side="left")
            ttk.Button(bridge_row, text="Copy pairing token", command=self.copy_token).pack(side="right")
        pane = ttk.Panedwindow(outer, orient="horizontal")
        pane.pack(fill="both", expand=True)
        left, right = ttk.Frame(pane, padding=(0, 0, 16, 0)), ttk.Frame(pane)
        pane.add(left, weight=1)
        pane.add(right, weight=3)
        ttk.Label(left, text="App rules", font=("Segoe UI", 13, "bold")).pack(anchor="w")
        self.rules = tk.Listbox(left, exportselection=False, height=9)
        self.rules.pack(fill="both", expand=True, pady=8)
        self.rules.bind("<<ListboxSelect>>", self.select_rule)
        buttons = ttk.Frame(left)
        buttons.pack(fill="x")
        ttk.Button(buttons, text="Add app", command=self.add_rule).pack(side="left")
        ttk.Button(buttons, text="Remove", command=self.remove_rule).pack(side="left", padx=4)
        ttk.Label(left, text="First enabled match wins.\nDefault applies when no app matches.\n\nPause removes this app's temporary layer selection.", wraplength=240).pack(anchor="w", pady=12)
        edit = ttk.LabelFrame(right, text="App → existing keyboard layer", padding=16)
        edit.pack(fill="x")
        self.rule_name, self.exe, self.origin = tk.StringVar(), tk.StringVar(), tk.StringVar()
        self.layer = tk.StringVar(value="Onboard / manual")
        self.rule_enabled = tk.BooleanVar(value=True)
        for row, (label, variable) in enumerate((("Name", self.rule_name), ("Executable", self.exe), ("Onshape origin (optional)", self.origin))):
            ttk.Label(edit, text=label).grid(row=row, column=0, sticky="w", padx=(0, 14), pady=7)
            ttk.Entry(edit, textvariable=variable).grid(row=row, column=1, sticky="ew", pady=7)
        ttk.Label(edit, text="Layer").grid(row=3, column=0, sticky="w", pady=7)
        self.layer_choice = ttk.Combobox(edit, textvariable=self.layer, state="readonly", values=["Onboard / manual"] + [str(n) for n in range(self.layer_count)])
        self.layer_choice.grid(row=3, column=1, sticky="ew", pady=7)
        ttk.Checkbutton(edit, text="Rule enabled", variable=self.rule_enabled).grid(row=4, column=0, sticky="w", pady=7)
        ttk.Button(edit, text="Apply rule / default", command=self.apply_rule).grid(row=4, column=1, sticky="e", pady=7)
        edit.columnconfigure(1, weight=1)
        ttk.Label(right, text="Quick start", font=("Segoe UI", 13, "bold")).pack(anchor="w", pady=(22, 8))
        ttk.Label(right, text="1. Configure a useful layer in Keybard and note its zero-based index.\n2. Add an app, enter its executable (for example chrome.exe), and choose that layer.\n3. For Onshape only, keep https://cad.onshape.com and pair the extension.\n4. Check Rule enabled, click Apply, then Enable app switching.\n\nLeave origin empty to match the entire app. Other layers are configured on the keyboard; this editor only chooses them.\n\nDefault: Onboard / manual leaves layer selection to the keyboard when no rule matches. Choosing a numbered default adds that layer instead.\n\nUse default stays selected until Follow apps or Pin. Edits take effect while enabled. Save your configuration to keep it after closing.", wraplength=650, justify="left").pack(anchor="w")
        self.refresh_rules()

    def copy_token(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.browser_bridge.token)
        self.status.set("Pairing token copied. Paste it in the browser extension options.")

    def refresh_devices(self):
        try:
            self.devices = device.HidDevice.discover()
            labels = ["Demo keyboard (no hardware changes)"] + [str(d.get("product_string") or d.get("product") or "Svalboard") + " — " + str(d.get("serial_number", n)) for n, d in enumerate(self.devices)]
            self.device_choice["values"] = labels
            self.device_choice.current(0)
        except Exception as exc:
            self.devices = []
            self.device_choice["values"] = ["Demo keyboard (no hardware changes)"]
            self.device_choice.current(0)
            self.status.set(f"Device discovery unavailable: {exc}. Demo is available.")

    def submit(self, action, callback=None):
        self.pending.append((self.worker.submit(action), callback))

    def poll_results(self):
        while self.pending and self.pending[0][0].done():
            future, callback = self.pending.pop(0)
            try:
                result = future.result()
                if callback:
                    callback(result)
            except Exception as exc:
                self.enabled = False
                self.enable_button.configure(text="Enable app switching")
                if not self.closing:
                    self.error(exc)

    def connect(self):
        self.poll_results()
        if self.pending or self.closing:
            self.status.set("Please wait for the current keyboard operation to finish.")
            return
        self.status.set("Connecting and checking layer-switching support…")
        self.enable_button.configure(state="disabled")
        selection = self.device_choice.current()
        self.demo = selection == 0
        if not self.demo and self.demo_seeded:
            self.config = model.Config()
            self.path = None
            self.demo_seeded = False
            self.refresh_rules()
        config = deepcopy(self.config)
        previous_engine, previous_device = self.engine, self.device
        self.engine, self.device, self.enabled = None, None, False
        info = self.devices[selection - 1] if not self.demo else None

        def work():
            if previous_engine:
                previous_engine.pause(True)
            if previous_device:
                previous_device.close()
            board = device.SimulatedDevice() if info is None else device.HidDevice(info)
            try:
                resolver = engine.ContextEngine(config, board)
                return board, resolver
            except Exception:
                board.close()
                raise

        def connected(result):
            self.device, self.engine = result
            self.layer_count = self.device.layer_count
            self.layer_choice["values"] = ["Onboard / manual"] + [str(n) for n in range(self.layer_count)]
            self.enable_button.configure(state="normal", text="Enable app switching")
            self.status.set(f"{'DEMO — ' if self.demo else ''}Connected; {self.layer_count} layer indices available. App switching paused.")

        self.submit(work, connected)

    def toggle_enabled(self):
        if self.engine and not self.closing:
            enabling = not self.enabled
            self.enabled = enabling
            self.enable_button.configure(text="Pause app switching" if enabling else "Enable app switching")
            resolver = self.engine
            self.submit(lambda: resolver.pause(not enabling))

    def restore_config(self):
        try:
            pointer = self.settings_dir / "last-config-path.txt"
            if pointer.exists():
                path = pointer.read_text(encoding="utf-8").strip()
                if Path(path).is_file():
                    self.config = model.Config.load(path)
                    self.path = path
                    self.refresh_rules()
                    self.status.set(f"Loaded {Path(path).name}. Connect and explicitly enable automation.")
        except Exception as exc:
            self.status.set(f"Could not restore your last configuration: {exc}. Open a config to recover.")

    def remember_path(self):
        if not self.demo and self.path:
            self.settings_dir.mkdir(parents=True, exist_ok=True)
            (self.settings_dir / "last-config-path.txt").write_text(str(Path(self.path).resolve()), encoding="utf-8")

    def refresh_rules(self, selection=0):
        self.rules.delete(0, "end")
        default = "Onboard / manual" if self.config.default_layer is None else f"Layer {self.config.default_layer}"
        self.rules.insert("end", f"Default → {default}")
        for rule in self.config.rules:
            self.rules.insert("end", f"{rule.name} → Layer {rule.layer}" + (" (disabled)" if not rule.enabled else ""))
        selection = min(selection, len(self.config.rules))
        self.rules.selection_set(selection)
        self.select_rule()

    def select_rule(self, _event=None):
        selection = self.rules.curselection()
        if not selection:
            return
        self.selected_rule = self.config.rules[selection[0] - 1] if selection[0] else None
        rule = self.selected_rule
        self.rule_name.set(rule.name if rule else "Default")
        self.exe.set(rule.exe if rule else "")
        self.origin.set(rule.origin or "" if rule else "")
        self.rule_enabled.set(rule.enabled if rule else True)
        layer = rule.layer if rule else self.config.default_layer
        self.layer.set("Onboard / manual" if layer is None else str(layer))

    def add_rule(self):
        name = simpledialog.askstring("New app rule", "Name", initialvalue="Onshape", parent=self.root)
        name = name.strip() if name else ""
        if name:
            if any(r.name == name for r in self.config.rules):
                return self.error(ValueError("Choose a unique app rule name."))
            self.config.rules.append(model.Rule(name=name, exe="chrome.exe", origin="https://cad.onshape.com", layer=1, enabled=False))
            self.refresh_rules(len(self.config.rules))

    def remove_rule(self):
        if self.selected_rule:
            self.config.rules.remove(self.selected_rule)
            self.refresh_rules()

    def apply_rule(self):
        try:
            layer = None if self.layer.get() == "Onboard / manual" else int(self.layer.get())
            if layer is not None and not 0 <= layer < self.layer_count:
                raise ValueError(f"Choose a layer index between 0 and {self.layer_count - 1}.")
            if not self.selected_rule:
                self.config.default_layer = layer
                self.refresh_rules()
                return
            if layer is None:
                raise ValueError("Choose a numbered layer for an app rule. Onboard / manual is a Default option.")
            name, exe, origin = self.rule_name.get().strip(), self.exe.get().strip(), self.origin.get().strip()
            if not name or not exe:
                raise ValueError("Name and executable are required.")
            if '/' in exe or '\\' in exe:
                raise ValueError("Use an executable basename such as chrome.exe, without a path.")
            if any(r is not self.selected_rule and r.name == name for r in self.config.rules):
                raise ValueError("App rule names must be unique.")
            if origin:
                from urllib.parse import urlsplit
                url = urlsplit(origin)
                if url.path not in ("", "/") or url.query or url.fragment:
                    raise ValueError("Use an origin such as https://cad.onshape.com without a document path.")
                origin = model.origin_of(origin.rstrip("/"))
                host = urlsplit(origin).hostname
                if urlsplit(origin).scheme != 'https' or not (host == 'onshape.com' or host.endswith('.onshape.com')):
                    raise ValueError("This draft's browser extension supports HTTPS Onshape sites only. Leave origin empty to match a whole app.")
            candidate = deepcopy(self.config)
            position = self.config.rules.index(self.selected_rule)
            candidate.rules[position] = model.Rule(name=name, exe=exe, origin=origin, layer=layer, enabled=self.rule_enabled.get())
            candidate.validate()
            self.config = candidate
            self.refresh_rules(position + 1)
        except Exception as exc:
            self.error(exc)

    def load(self):
        path = filedialog.askopenfilename(filetypes=[("Context configuration", "*.json")])
        if not path:
            return
        try:
            config = model.Config.load(path)
            if self.engine:
                resolver = self.engine
                self.submit(lambda: resolver.pause(True))
            self.config = config
            self.demo_seeded = False
            self.enabled = False
            self.enable_button.configure(text="Enable app switching")
            self.path = path
            self.remember_path()
            self.refresh_rules()
        except Exception as exc:
            self.error(exc)

    def save(self):
        path = filedialog.asksaveasfilename(initialfile=Path(self.path).name if self.path else "contexts.json", defaultextension=".json", filetypes=[("Context configuration", "*.json")])
        if path:
            try:
                self.config.save(path)
                self.path = path
                self.remember_path()
            except Exception as exc:
                self.error(exc)

    def pin_selected(self):
        if self.selected_rule:
            self.pin(self.selected_rule.name)

    def pin(self, name):
        if self.engine:
            try:
                resolver = self.engine
                config = deepcopy(self.config)
                def work():
                    resolver.config = config
                    resolver.pin(name)
                self.submit(work)
            except Exception as exc:
                self.error(exc)

    def typing(self):
        if self.engine:
            resolver = self.engine
            self.submit(lambda: resolver.typing(True))

    def tick(self):
        self.poll_results()
        if self.closing:
            if not self.pending:
                self.finish_close()
                return
            self.root.after(50, self.tick)
            return
        try:
            foreground = windows.foreground()
            browser = self.browser_provider()
            if self.demo and self.device:
                choice = self.demo_context.get()
                title = "Demo document - Onshape" if choice == "Onshape in Chrome" else "Another tab"
                foreground = model.Foreground(exe="notepad.exe" if choice == "Desktop" else "chrome.exe", title=title, hwnd=1)
                browser = None if choice == "Desktop" else model.BrowserContext(origin="https://cad.onshape.com" if choice == "Onshape in Chrome" else "https://example.com", title=title, focused=True, received_at=time.monotonic(), browser="chrome.exe", window_handle=1)
            browser_origin = browser.get('origin', '') if isinstance(browser, dict) else browser.origin if browser else 'no extension context'
            if not browser_origin or (isinstance(browser, model.BrowserContext) and (not browser.focused or time.monotonic() - browser.received_at > 2.5)):
                browser_origin = 'no current Onshape signal'
            self.context_status.set(f"Active app: {foreground.exe or '(unavailable)'} · Browser: {browser_origin}")
            if self.engine and not self.pending:
                resolver = self.engine
                config = deepcopy(self.config)
                def work():
                    resolver.config = config
                    return dict(resolver.tick(foreground, browser))
                self.submit(work, self.show_state)
        except Exception as exc:
            self.status.set(f"Error: {exc}")
        self.root.after(250, self.tick)

    def error(self, exc):
        self.status.set(f"Error: {exc}")
        messagebox.showerror("Keybard Context", str(exc), parent=self.root)

    def show_state(self, state):
        if state.get('state') == 'Error':
            self.enabled = False
            self.enable_button.configure(text="Enable app switching")
        layer = state.get('applied_layer')
        applied = "Onboard / manual" if layer is None else f"Layer {layer}"
        mode = "Manual default" if state.get('state') == 'Typing' else state.get('state', '')
        self.status.set(("DEMO — " if self.demo else "") + f"{mode} · Context: {state.get('context', 'Default')} · Applied: {applied}" + (f" · {state['error']}" if state.get('error') else ""))

    def close(self):
        if not self.closing:
            self.closing = True
            self.status.set("Restoring onboard behavior and closing…")

    def finish_close(self):
        resolver, board = self.engine, self.device
        self.engine, self.device = None, None
        def work():
            try:
                if resolver:
                    resolver.pause(True)
            finally:
                if board:
                    board.close()
        def done(_):
            self.worker.shutdown(wait=False)
            self.root.destroy()
        # Process errors too: firmware lease expiry is the recovery if unplugged.
        def safe_work():
            try:
                work()
            except Exception:
                pass
        self.submit(safe_work, done)
        self.root.after(50, self.close_poll)

    def close_poll(self):
        self.poll_results()
        if self.pending:
            self.root.after(50, self.close_poll)


def run(browser_provider=None, demo=False, browser_bridge=None, smoke_test=False):
    root = tk.Tk()
    app = App(root, browser_provider=browser_provider, demo=demo, browser_bridge=browser_bridge)
    errors = []
    if smoke_test:
        def fail(exc):
            errors.append(str(exc))
            app.close()
        app.error = fail
        root.report_callback_exception = lambda _kind, exc, _trace: fail(exc)
        deadline = time.monotonic() + 20
        phase = [0]

        def exercise():
            try:
                if app.closing:
                    return
                if time.monotonic() > deadline:
                    raise RuntimeError(f"UI smoke test timed out at step {phase[0]}")
                resolver = app.engine
                state = resolver.status if resolver else {}
                if state.get('state') == 'Error':
                    raise RuntimeError(state.get('error', 'Worker failed'))
                if phase[0] == 0 and resolver:
                    assert resolver.paused, "Connection must start paused"
                    app.demo_context.set("Onshape in Chrome")
                    app.toggle_enabled()
                    phase[0] = 1
                elif phase[0] == 1 and state.get('applied_layer') == 1:
                    assert state.get('context') == 'Onshape'
                    app.pin('Onshape')
                    app.demo_context.set("Desktop")
                    phase[0] = 2
                elif phase[0] == 2 and state.get('state') == 'Pinned':
                    assert state.get('applied_layer') == 1
                    app.pin(None)
                    phase[0] = 3
                elif phase[0] == 3 and state.get('state') == 'Following' and state.get('applied_layer') is None:
                    app.toggle_enabled()
                    phase[0] = 4
                elif phase[0] == 4 and state.get('state') == 'Paused':
                    assert app.device.active_layer is None
                    app.close()
                    return
                root.after(50, exercise)
            except Exception as exc:
                fail(exc)
        root.after(50, exercise)
    root.mainloop()
    if errors:
        raise RuntimeError("UI smoke test failed: " + "; ".join(errors))
