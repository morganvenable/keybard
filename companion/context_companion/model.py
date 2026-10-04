"""Portable configuration and foreground context types."""
from dataclasses import dataclass, field, asdict
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlsplit


def origin_of(value: str) -> str:
    p = urlsplit(value)
    if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password:
        raise ValueError('Origin must be an http(s) origin')
    port = p.port
    return f'{p.scheme}://{p.hostname.lower()}' + (f':{port}' if port and port != (443 if p.scheme == 'https' else 80) else '')


def validate_layer(layer):
    if layer is not None and (type(layer) is not int or not 0 <= layer < 32):
        raise ValueError('Layer must be 0..31 or null for onboard/manual state')


@dataclass
class Rule:
    name: str
    exe: str = 'chrome.exe'
    origin: str = ''
    layer: int = 1
    enabled: bool = True


@dataclass
class Config:
    default_layer: int | None = None
    rules: list[Rule] = field(default_factory=list)
    schema_version: int = 2

    def validate(self):
        if self.schema_version != 2:
            raise ValueError('Unsupported configuration version; this draft uses layer rules (schema 2)')
        validate_layer(self.default_layer)
        names = set()
        for rule in self.rules:
            if not rule.name.strip() or rule.name in names:
                raise ValueError('Context names must be nonempty and unique')
            names.add(rule.name)
            if not rule.exe or '/' in rule.exe or chr(92) in rule.exe:
                raise ValueError('Application must be an executable basename')
            if rule.origin:
                if rule.exe.casefold() not in ('chrome.exe', 'msedge.exe'):
                    raise ValueError('Browser-origin rules currently support chrome.exe and msedge.exe')
                normalized = origin_of(rule.origin)
                host = urlsplit(normalized).hostname
                if normalized != rule.origin or not normalized.startswith('https://') or not (host == 'onshape.com' or host.endswith('.onshape.com')):
                    raise ValueError('Browser rules currently require an exact HTTPS Onshape origin, such as https://cad.onshape.com')
            validate_layer(rule.layer)
            if rule.layer is None:
                raise ValueError('Application rules require a layer index')

    @classmethod
    def load(cls, path):
        path = Path(path)
        if not path.exists():
            return cls()
        data = json.loads(path.read_text(encoding='utf-8'))
        if data.get('schema_version') != 2:
            raise ValueError('This file is not a layer configuration (schema 2); tap-dance drafts are not supported')
        result = cls(default_layer=data.get('default_layer'),
                     rules=[Rule(**r) for r in data.get('rules', [])], schema_version=data['schema_version'])
        result.validate()
        return result

    def save(self, path):
        self.validate()
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as handle:
                temporary = handle.name
                json.dump(asdict(self), handle, indent=2)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            if temporary and os.path.exists(temporary):
                os.unlink(temporary)


@dataclass
class Foreground:
    exe: str = ''
    title: str = ''
    hwnd: int = 0


@dataclass
class BrowserContext:
    origin: str = ''
    title: str = ''
    focused: bool = False
    received_at: float = 0.0
    browser: str = 'chrome.exe'
    window_handle: int = 0
