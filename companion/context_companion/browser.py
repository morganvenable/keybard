"""Authenticated loopback context receiver; never receives document text or URLs."""
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import secrets
import threading
import time
from urllib.parse import urlsplit

from .model import BrowserContext, origin_of

PORT = 19732
MAX_BODY = 2048
EXTENSION_ORIGIN = re.compile(r"chrome-extension://[a-p]{32}\Z")
BROWSERS = {"chrome.exe", "msedge.exe"}


class BrowserBridge:
    def __init__(self, foreground_provider, config_dir=None, *, port=PORT, clock=time.monotonic, wall_clock=time.time):
        self.foreground_provider = foreground_provider
        self.port = port
        self.clock = clock
        self.wall_clock = wall_clock
        self.last_error = ""
        self._context = BrowserContext()
        self._lock = threading.Lock()
        self._sequences = {}
        self._server = None
        self._thread = None
        if config_dir is None:
            import os
            config_dir = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".config")) / "KeybardContext"
        directory = Path(config_dir)
        directory.mkdir(parents=True, exist_ok=True)
        token_path = directory / "browser-token.txt"
        try:
            self.token = token_path.read_text(encoding="utf-8").strip()
            if not re.fullmatch(r"[A-Za-z0-9_-]{43}", self.token):
                raise ValueError("Invalid browser pairing token; delete browser-token.txt to regenerate")
        except FileNotFoundError:
            self.token = secrets.token_urlsafe(32)
            # Do not overwrite an existing token if another instance won the race.
            try:
                with token_path.open("x", encoding="utf-8") as stream:
                    stream.write(self.token + "\n")
                token_path.chmod(0o600)
            except FileExistsError:
                self.token = token_path.read_text(encoding="utf-8").strip()
                if not re.fullmatch(r"[A-Za-z0-9_-]{43}", self.token):
                    raise ValueError("Invalid browser pairing token")

    @property
    def running(self):
        return self._server is not None

    def snapshot(self):
        with self._lock:
            return replace(self._context)

    def receive(self, payload):
        """Validate before publishing; foreground identity is sampled locally."""
        if not isinstance(payload, dict):
            raise ValueError("Expected an object")
        browser = payload.get("browser")
        origin = payload.get("origin", "")
        focused = payload.get("focused")
        sequence = payload.get("sequence")
        session = payload.get("session")
        sent_at = payload.get("sent_at")
        if browser not in BROWSERS or type(focused) is not bool:
            raise ValueError("Unsupported browser or focus state")
        if not isinstance(session, str) or not re.fullmatch(r"[a-zA-Z0-9-]{16,64}", session):
            raise ValueError("Invalid sender session")
        if type(sequence) is not int or not 0 < sequence < 2**53:
            raise ValueError("Invalid sequence")
        if type(sent_at) not in (int, float) or not -1 <= self.wall_clock() - sent_at / 1000 <= 2.5:
            raise ValueError("Expired browser observation")
        if not isinstance(origin, str) or len(origin) > 250:
            raise ValueError("Invalid origin")
        if origin:
            normalized = origin_of(origin)
            host = urlsplit(normalized).hostname
            if normalized != origin or not origin.startswith("https://") or not (host == "onshape.com" or host.endswith(".onshape.com")):
                raise ValueError("This draft accepts only an exact HTTPS Onshape origin")
        if focused and not origin:
            raise ValueError("A focused observation needs an origin")
        foreground = self.foreground_provider()
        observed_at = self.clock()
        with self._lock:
            key = (browser, session)
            if sequence <= self._sequences.get(key, 0):
                raise ValueError("Out-of-order browser observation")
            if len(self._sequences) > 32:
                self._sequences.clear()
            self._sequences[key] = sequence
            # Another installed browser/profile's loss-of-focus notification
            # must not clear a fresh signal from the foreground browser.
            if foreground.exe.lower() != browser or not foreground.hwnd:
                return
            self._context = BrowserContext(
                origin=origin if focused else "", focused=focused,
                received_at=observed_at, browser=browser,
                window_handle=foreground.hwnd,
            )

    def start(self):
        if self._server:
            return
        bridge = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass  # Never log pairing credentials or browsing context.

            def _origin(self):
                origin = self.headers.get("Origin", "")
                return origin if EXTENSION_ORIGIN.fullmatch(origin) else ""

            def _reply(self, code, obj):
                data = json.dumps(obj).encode()
                self.send_response(code)
                origin = self._origin()
                if origin:
                    self.send_header("Access-Control-Allow-Origin", origin)
                    self.send_header("Vary", "Origin")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def _host_ok(self):
                return self.headers.get("Host") == f"127.0.0.1:{bridge.port}"

            def _authorized(self):
                # Extension GET requests may omit Origin. Supplied web origins
                # are rejected; the unguessable bearer remains mandatory.
                origin_ok = not self.headers.get("Origin") or bool(self._origin())
                return (self._host_ok() and origin_ok and
                        secrets.compare_digest(self.headers.get("Authorization", ""), "Bearer " + bridge.token))

            def do_OPTIONS(self):
                if not self._host_ok() or not self._origin():
                    return self._reply(403, {"error": "Extension origin required"})
                self.send_response(204)
                self.send_header("Access-Control-Allow-Origin", self._origin())
                self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Vary", "Origin")
                self.end_headers()

            def do_GET(self):
                if not self._authorized():
                    return self._reply(403, {"error": "Pair this extension in its options"})
                if self.path != "/health":
                    return self._reply(404, {"error": "Not found"})
                self._reply(200, {"service": "Keybard Context", "protocol": 1})

            def do_POST(self):
                if not self._authorized():
                    return self._reply(403, {"error": "Pair this extension in its options"})
                if self.path != "/context":
                    return self._reply(404, {"error": "Not found"})
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                    if not 0 < length <= MAX_BODY or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                        raise ValueError("Invalid request body")
                    payload = json.loads(self.rfile.read(length))
                    bridge.receive(payload)
                except (ValueError, UnicodeDecodeError) as exc:
                    return self._reply(400, {"error": str(exc)})
                except Exception:
                    bridge.last_error = "Could not read foreground window"
                    return self._reply(503, {"error": bridge.last_error})
                self._reply(200, {"accepted": True})

        class Server(ThreadingHTTPServer):
            daemon_threads = True
            allow_reuse_address = False

            def get_request(self):
                connection, address = super().get_request()
                connection.settimeout(2)
                return connection, address

        try:
            self._server = Server(("127.0.0.1", self.port), Handler)
            self.port = self._server.server_address[1]
            self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
            self._thread.start()
        except OSError as exc:
            self.last_error = f"Browser bridge unavailable: {exc}"
            self._server = None
            raise

    def stop(self):
        if self._server:
            self._server.shutdown()
            self._server.server_close()
            self._server = None
        with self._lock:
            self._context = BrowserContext()
