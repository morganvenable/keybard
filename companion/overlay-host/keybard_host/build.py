"""Which release this host is, and which Keybard build it serves.

Release packaging writes build.json next to this file. A host run from a source
checkout has none and reports itself as a development build.
"""
import json
from pathlib import Path

BUILD_FILE = Path(__file__).resolve().parent / 'build.json'


def build_info(path=BUILD_FILE):
    """{'version': release tag or 'dev', 'keybardCommit': short commit of the bundled Keybard or None}."""
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        data = {}
    version = data.get('version')
    commit = data.get('keybardCommit')
    return {
        'version': version if isinstance(version, str) and 0 < len(version) <= 64 else 'dev',
        'keybardCommit': commit if isinstance(commit, str) and 0 < len(commit) <= 40 else None,
    }
