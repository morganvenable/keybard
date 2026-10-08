import json
import tempfile
import unittest
from pathlib import Path

from keybard_host.build import build_info


class BuildInfoTests(unittest.TestCase):
    def info(self, text):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'build.json'
            if text is not None: path.write_text(text, encoding='utf-8')
            return build_info(path)

    def test_release_build_reports_tag_and_keybard_commit(self):
        self.assertEqual(self.info(json.dumps({'version': 'vLaunch2', 'keybardCommit': '5954334'})), {'version': 'vLaunch2', 'keybardCommit': '5954334'})

    def test_missing_or_bad_file_is_a_development_build(self):
        for text in (None, 'not json', json.dumps({'version': 7, 'keybardCommit': ''}), json.dumps({'version': 'x' * 65})):
            with self.subTest(text=text):
                self.assertEqual(self.info(text), {'version': 'dev', 'keybardCommit': None})


if __name__ == '__main__': unittest.main()
