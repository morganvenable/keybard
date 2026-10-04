"""Ordered matching and acknowledged, leased device updates."""
import time
from .model import BrowserContext, Config, Foreground, origin_of


class ContextEngine:
    def __init__(self, config: Config, device, clock=time.monotonic):
        self.config, self.device, self.clock = config, device, clock
        self.paused, self.pinned, self.typing_only = True, None, False
        self._signature = object()
        self._renewed = 0
        self.status = dict(state='Paused', context='Default', applied_count=0, applied_layer=None, error='', foreground='', origin='')
        self.device.clear()

    def pause(self, value=True):
        self.paused = bool(value)
        if self.paused:
            self.device.clear()
            self._signature = object()
            self.status.update(state='Paused', context='Default', applied_count=0, applied_layer=None, error='')

    def pin(self, name=None):
        if name is not None and name not in [r.name for r in self.config.rules]:
            raise ValueError('Unknown context')
        self.pinned = name
        self.typing_only = False

    def typing(self, value=True):
        """Use configured defaults until Resume following or Pin is selected."""
        self.typing_only = bool(value)

    def _browser(self, value):
        if isinstance(value, dict):
            return BrowserContext(origin=value.get('origin', ''), focused=value.get('focused', False),
                                  received_at=value.get('observed_at', 0), browser=value.get('browser_exe', ''),
                                  window_handle=value.get('window_handle', 0))
        return value

    def _matches(self, rule, fg, browser, now):
        if not rule.enabled or rule.exe.casefold() != fg.exe.casefold():
            return False
        if not rule.origin:
            return True
        if not browser or not browser.focused or not fg.hwnd or browser.window_handle != fg.hwnd:
            return False
        if browser.browser.casefold() != fg.exe.casefold() or not 0 <= now - browser.received_at <= 2.5:
            return False
        try:
            return origin_of(rule.origin) == origin_of(browser.origin)
        except ValueError:
            return False

    def tick(self, foreground: Foreground, browser=None):
        now = self.clock()
        browser = self._browser(browser)
        self.status.update(foreground=foreground.exe, origin=browser.origin if browser else '')
        if self.paused:
            return self.status
        try:
            self.config.validate()
            rule = None
            if not self.typing_only:
                rule = next((r for r in self.config.rules if r.name == self.pinned), None) if self.pinned else next(
                    (r for r in self.config.rules if self._matches(r, foreground, browser, now)), None)
            layer = rule.layer if rule else self.config.default_layer
            if layer is not None and layer >= self.device.layer_count:
                raise ValueError(f'Layer {layer} is unavailable; keyboard has {self.device.layer_count} layers')
            if layer != self._signature:
                self.device.replace_layer(layer)
                self._signature, self._renewed = layer, now
            elif layer is not None and now - self._renewed >= 1:
                self.device.renew()
                self._renewed = now
            self.status.update(state='Typing' if self.typing_only else 'Pinned' if self.pinned else 'Following',
                               context=rule.name if rule else 'Default', applied_count=int(layer is not None), applied_layer=layer, error='')
        except Exception as exc:
            self._signature = object()
            self.paused = True
            try:
                self.device.clear()
                count = 0
            except Exception:
                count = self.status['applied_count']
            self.status.update(state='Error', error=str(exc), applied_count=count,
                               applied_layer=self.status.get('applied_layer') if count else None)
        return self.status
