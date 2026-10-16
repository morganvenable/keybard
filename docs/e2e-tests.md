# User-flow tests (Playwright)

The tests in `e2e/` drive the built app the way a person does: they open it from
its real entry point with a demo layout (no keyboard needed), click, drag, type
and use shortcuts, check what is on screen, reload, and check what was kept.
Layout checks run in light and dark themes, at Normal, Medium and Small key
sizes, and at desktop, 1024 px and phone widths. A console error fails a test.

## Run

```bash
npx playwright install chromium
npm run test:ux
```

This builds the app, serves it with `vite preview` on port 4471 under
`/keybard/`, and runs every `e2e/*.e2e.ts` file. A full run takes about
8 minutes. (`npm run test:e2e` is a different, older check: the Python combo
editor test in `tests/e2e/`.)

| Variable | Effect |
|---|---|
| `UX_SKIP_BUILD=1` | Reuse the existing `dist/` instead of building. |
| `UX_PORT=4480` | Serve on another port (when 4471 is taken). |
| `UX_OUT=<dir>` | Write traces and screenshots somewhere other than `e2e/.results`. Give parallel runs separate folders. |
| `UX_SHOW_KNOWN=1` | Group 1 tests: run known-bug tests as normal tests, so they fail outright. |
| `G5_PROBE=1` | Same for the group 5 (views and pointing) tests. |

Run one area: `npx playwright test e2e/g3-` (binding features). The groups are
`g1` app shell, `g2` layout editor, `g3` combos, tap dances, macros, overrides,
alt-repeat and leaders, `g4` files and layouts, `g5` views and pointing.

`e2e/g4-paranoid.e2e.ts` tests the single-file build. Run
`npm run build:paranoid` first; without it those tests skip themselves.

When building from Git Bash on Windows, set `MSYS_NO_PATHCONV=1`, or Git Bash
turns the `/keybard/` base path into a Windows path.

## Known bugs

A test that fails because the app is wrong stays in the suite, marked
`test.fail()` with a finding id (for example `g2-05`) in its message. It
passes while the bug is there. When someone fixes the bug, the test turns red
("expected to fail, but passed"): remove its `test.fail()` then, so it guards
the fix.
