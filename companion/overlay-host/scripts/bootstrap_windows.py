"""Install only the pinned Windows wheels into our embedded runtime, without pip.

This is deliberately a fixed app bootstrap, not a general-purpose wheel installer.
All archive bytes are SHA-256 checked against the reviewed runtime manifest.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import sys
from urllib.parse import urlparse
from urllib.request import urlopen
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def verify(path, expected):
    with path.open("rb") as stream:
        actual = hashlib.file_digest(stream, "sha256").hexdigest()
    if actual != expected:
        raise ValueError(f"SHA-256 mismatch for {path.name}")


def wheel_destination(name, destination):
    parts = PurePosixPath(name).parts
    if not parts or name.startswith("/") or ".." in parts or "\\" in name or ":" in name:
        raise ValueError("Unsafe wheel path")
    if parts[0].endswith(".data"):
        # These runtime wheels need only importable files. Entry point scripts
        # are intentionally not installed into PATH.
        if len(parts) < 3 or parts[1] == "scripts":
            return None
        if parts[1] not in ("purelib", "platlib"):
            raise ValueError(f"Unexpected wheel data category: {parts[1]}")
        parts = parts[2:]
    return destination.joinpath(*parts)


def unpack_wheel(path, destination):
    with zipfile.ZipFile(path) as archive:
        for entry in archive.infolist():
            target = wheel_destination(entry.filename, destination)
            if target is None or entry.is_dir():
                continue
            if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Unexpected symlink in wheel")
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, target.open("wb") as out:
                shutil.copyfileobj(source, out)


def main():
    if sys.platform != "win32" or sys.version_info[:2] != (3, 13):
        raise SystemExit("This bootstrap requires its bundled Windows Python 3.13 runtime")
    manifest_path = ROOT / "scripts" / "windows-runtime.json"
    manifest = json.loads(manifest_path.read_text())
    destination = ROOT / ".runtime" / "Lib" / "site-packages"
    cache = ROOT / ".downloads"
    cache.mkdir(exist_ok=True)
    destination.mkdir(parents=True, exist_ok=True)
    for wheel in manifest["wheels"]:
        path = cache / wheel["filename"]
        if not path.exists():
            print(f"Downloading {wheel['project']} {wheel['version']}...", flush=True)
            api = f"https://pypi.org/pypi/{wheel['project']}/{wheel['version']}/json"
            with urlopen(api, timeout=60) as response:
                metadata = json.load(response)
            files = [f for f in metadata["urls"] if f["filename"] == wheel["filename"]]
            if len(files) != 1 or files[0]["digests"]["sha256"] != wheel["sha256"]:
                raise ValueError("PyPI metadata does not match the pinned wheel")
            url = files[0]["url"]
            parsed = urlparse(url)
            if parsed.scheme != "https" or parsed.hostname != "files.pythonhosted.org":
                raise ValueError("Unexpected wheel download host")
            temporary = path.with_suffix(".part")
            with urlopen(url, timeout=120) as response, temporary.open("wb") as stream:
                shutil.copyfileobj(response, stream)
            verify(temporary, wheel["sha256"])
            temporary.replace(path)
        verify(path, wheel["sha256"])
        print(f"Installing {wheel['project']}...", flush=True)
        unpack_wheel(path, destination)
    # No success marker until all native modules load and an offscreen Qt
    # application can be created in a fresh process (handled by the PS script).
    print("Pinned runtime files installed.", flush=True)


if __name__ == "__main__":
    main()
