#!/usr/bin/env node
// Checks to run before opening or updating a pull request: npm run pre-pr
//
//   1. Lint: whitespace errors and conflict markers in the changes since main
//      (git diff --check against the merge base with upstream/main or origin/main)
//   2. Typecheck: tsc --noEmit
//   3. vitest: the whole suite, with the coverage thresholds (vitest.config.ts)
//   4. Keybard Overlay's Python tests, with Qt offscreen. They need PySide6:
//      pip install -r companion/overlay-host/requirements.txt, or set
//      KEYBARD_PYTHON to a Python that has it.
//
// Runs every step, prints a summary and exits 1 if any step failed. Releases
// run the same suites, and the Paranoid build, in .github/workflows/test.yml.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const results = [];

function run(cmd, args, opts = {}) {
    // Only npx needs a shell on Windows (npx.cmd); everything else runs directly.
    return spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: win && cmd === 'npx', ...opts }).status ?? 1;
}
function capture(cmd, args) {
    const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}
function step(name, fn) {
    console.log(`\n== ${name}`);
    const status = fn();
    console.log(status === 0 ? `-- ok: ${name}` : `-- FAILED: ${name}`);
    results.push([name, status === 0]);
}

step('Lint (git diff --check)', () => {
    const ref = ['upstream/main', 'origin/main'].find((r) => capture('git', ['rev-parse', '--verify', '-q', r]));
    const base = ref && capture('git', ['merge-base', 'HEAD', ref]);
    if (!base) {
        console.log('no upstream/main or origin/main to compare with');
        return 1;
    }
    console.log(`changes since ${ref} (${base.slice(0, 9)})`);
    return run('git', ['diff', '--check', base]);
});

step('Typecheck (tsc --noEmit)', () => run('npx', ['tsc', '--noEmit']));

step('vitest (all tests, coverage thresholds)', () => run('npx', ['vitest', 'run', '--coverage']));

step('Keybard Overlay tests (Python, Qt offscreen)', () => {
    const python = process.env.KEYBARD_PYTHON || (win ? 'python' : 'python3');
    if (run(python, ['-c', 'import PySide6'], { stdio: 'ignore' }) !== 0) {
        console.log(`${python} has no PySide6, so the Qt tests would be skipped.`);
        console.log('Install it: pip install -r companion/overlay-host/requirements.txt');
        console.log('or set KEYBARD_PYTHON to a Python that has it.');
        return 1;
    }
    const env = { ...process.env, QT_QPA_PLATFORM: 'offscreen', PYTHONPATH: 'companion/overlay-host' };
    return run(python, ['-m', 'unittest', 'discover', '-s', 'companion/overlay-host/tests'], { env });
});

console.log('\n== Summary');
for (const [name, ok] of results) console.log(`${ok ? 'ok    ' : 'FAILED'}  ${name}`);
const failed = results.filter(([, ok]) => !ok).length;
console.log(failed ? `\npre-pr: ${failed} step(s) failed` : '\npre-pr: all checks passed');
process.exit(failed ? 1 : 0);
