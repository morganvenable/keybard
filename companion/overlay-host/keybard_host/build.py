"""Which release this host is, and which Keybard build it serves.

Release packaging writes build.json next to this file. A host run from a source
checkout has none and reports itself as a development build.
"""
import json
from pathlib import Path

BUILD_FILE = Path(__file__).resolve().parent / 'build.json'


def build_info(path=BUILD_FILE):
    """{'version': release tag or 'dev', 'keybardCommit': short commit of the bundled Keybard or None, 'testBuild': bool}."""
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        data = {}
    version = data.get('version')
    commit = data.get('keybardCommit')
    test = data.get('testBuild')
    return {
        'version': version if isinstance(version, str) and 0 < len(version) <= 64 else 'dev',
        'keybardCommit': commit if isinstance(commit, str) and 0 < len(commit) <= 40 else None,
        'testBuild': test is True,
    }


def build_label(info):
    """One line that names a build, for the tray menu and messages."""
    if not info or info.get('version') in (None, 'unknown'): return 'an older Keybard Overlay'
    label = f"Keybard Overlay {info['version']}"
    if info.get('keybardCommit'): label += f" · Keybard {info['keybardCommit']}"
    if info.get('testBuild'): label += ' · test build'
    return label
