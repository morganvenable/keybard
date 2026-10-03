# Isolated Sval preview

Use branch `cleanup/sval-naming` with the matching local firmware and Python GUI
branches. Firmware keymap: `sval`. Keybard accepts the new `sval` feature definition
and the older definition. It also accepts the Python GUI's `sval_protocol` backups.
Legacy backup conversion improvements remain separate work.

## Local testing

```sh
npm ci
npm run dev:sval-preview
```

Open http://localhost:5176/keybard-sval-preview/ in a WebHID-capable browser.
Alternatively run `npm run build:sval-preview` then
`npm run preview -- --mode sval-preview --host 127.0.0.1 --port 5176 --strictPort`.

The amber label identifies the preview. Browser settings and saved/imported
layouts use a separate `sval-preview:` namespace. There is no automatic copying
of production browser data; explicitly import a backup if needed. Changes sent
to a connected keyboard still change that real keyboard. Back it up first.

## Publishing later

No repository creation, pushes, Pages changes, or deployments have been performed
as part of preparing this branch.

Use a separate repository, `morganvenable/keybard-sval-preview`, with GitHub Pages
configured to use GitHub Actions. Push this branch there as `cleanup/sval-naming`.
The included Sval preview workflow builds/tests and deploys only to that exact
repository and branch. Its expected URL is:

https://morganvenable.github.io/keybard-sval-preview/

Do not run a production Pages deployment to publish a preview. A repository's
Pages deployment replaces that repository's site. In `morganvenable/keybard-ng`,
the preview workflow only produces a downloadable `sval-preview-site` artifact;
it cannot deploy. Both older deployment workflows exclude the preview branch,
and the standard production workflow additionally requires `main`.

A separate project URL on the same github.io host still shares browser storage,
which is why the namespace isolation is required. Production builds retain their
existing `/keybard-ng/` base URL and unprefixed storage keys.

## Acceptance

1. Confirm the preview label and build branch/commit.
2. Connect the matching firmware and verify feature counts, keymaps, combos,
   tap dances, macros, pointing settings, and scan-lab controls as applicable.
3. Save/reload a layout, including one from the renamed Python GUI.
4. Verify the layer library loads under the preview URL.
5. Open production separately and confirm its browser settings/layouts are intact.
6. Power-cycle the test board and verify configuration persistence.

Rollback of the web preview requires no production change. Firmware rollback may
require restoring a backup, depending on which firmware/storage layout is used.

## Production compatibility notice test

The preview deployment also publishes a separately built production guard at
https://morganvenable.github.io/keybard-sval-preview/production-check/ .
Connect renamed Sval firmware there to test the compatibility notice. Its inline
“here” link opens the working preview at the site's root. The test app uses
`keybard-production-check:` browser storage, separate from both other apps.
The workflow pins the guard source commit; update that pin to publish changes.
Production GitHub Pages is not changed by this deployment.
