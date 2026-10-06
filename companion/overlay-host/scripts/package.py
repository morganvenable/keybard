"""Build a runtime-free Windows test ZIP containing the exact web build."""
from pathlib import Path
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parents[3]
HOST = ROOT / 'companion' / 'overlay-host'
DIST = ROOT / 'dist'
PARANOID = ROOT / 'dist-paranoid' / 'keybard-paranoid.html'

def package():
    if not (DIST / 'index.html').exists(): raise SystemExit('Build Keybard with VITE_BASE_PATH=/ first')
    if not PARANOID.exists(): raise SystemExit('Build Keybard Paranoid first (npm run build:paranoid)')
    web_files = [p for p in DIST.rglob('*') if p.is_file() and p.suffix != '.zip']
    destination = DIST / 'KeybardHost-Windows.zip'
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for folder in ('keybard_host', 'scripts', 'tests'):
            for path in (HOST / folder).rglob('*'):
                if path.is_file() and '__pycache__' not in path.parts:
                    archive.write(path, Path('KeybardHost') / path.relative_to(HOST))
        for name in ('Start-Windows.cmd', 'Start-Paranoid.cmd', 'Open-Paranoid.cmd', 'README.md', 'RELEASE-NOTES.md', 'requirements.txt', 'start-linux.sh'):
            archive.write(HOST / name, Path('KeybardHost') / name)
        for path in web_files:
            archive.write(path, Path('KeybardHost/web') / path.relative_to(DIST))
        # Paranoid mode serves the single-file build; it is also usable on its own.
        archive.write(PARANOID, Path('KeybardHost/web-paranoid/index.html'))
        archive.writestr('KeybardHost/web-paranoid/SHA256SUMS.txt', f'{hashlib.sha256(PARANOID.read_bytes()).hexdigest()}  index.html\n')
        archive.write(PARANOID, Path('KeybardHost') / PARANOID.name)
    print(destination)

if __name__ == '__main__': package()
