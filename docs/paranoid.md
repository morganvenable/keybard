# Keybard Paranoid

Keybard Paranoid is Keybard as a single HTML file that runs on your own computer and cannot reach the network.

## What it guarantees

- **No network access.** The file carries a Content Security Policy that blocks every request: no fetches, fonts, images, frames, form posts or connections to anywhere. Even buggy or malicious code inside the page could not send anything. The only exception is the Keybard Host that serves the page in paranoid mode (below), and only that Host.
- **Everything is inside the file.** Code, styles, the Inter font, the icon, the example layout and the layer library are embedded. Nothing is downloaded when you use it, and nothing updates itself.
- **No background reads from your keyboard.** Keybard's active-layer display only asks the board while the Keybard window is in front of you. The Matrix Tester only reads key presses while it is open.
- **No website can drive it.** It never connects to Keybard Host across origins, and Keybard Host in paranoid mode accepts no website at all.

Everything else works as in Keybard: editing, saving to the board, layer colors, dark mode, printing, `.svil` import and export.

## Use it

### On its own

1. Download `keybard-paranoid.html` from the Keybard Host release and check it against `SHA256SUMS.txt`.
2. Open it in Chrome or Edge, either by double-clicking it or with **File → Open**. WebHID needs a Chromium browser.
3. Click **Connect Keyboard** and choose your Svalboard.

The Trainer works as a preview. For the desktop overlay, use Keybard Host in paranoid mode.

### With the Trainer overlay

1. Extract the Keybard Host ZIP and run **Start-Paranoid.cmd**.
2. Use the Keybard it opens at `http://127.0.0.1:5178/`. That copy is Keybard Paranoid, served by the Host itself, so the Trainer can reach the Host. The page's policy allows that one local connection and nothing else.

In paranoid mode the Host refuses every website, including keybard.svalboard.com, and its API stays loopback-only and token-protected.

## Limits worth knowing

- **Use a dedicated browser profile.** Chrome treats every HTML file opened from disk as the same origin. Another local HTML file opened in the same profile could read Keybard's saved settings and, if you've granted it, talk to your keyboard. A Chrome profile used only for Keybard Paranoid avoids that.
- **The firmware answers any page you connect.** Over WebHID, the keyboard's firmware will report its switch matrix to whatever page you've connected it to. Keybard Paranoid only asks while the Matrix Tester is open, but the protection comes from the page's code, not from the firmware.
- **Links still open when you click them.** Links to documentation or releases open in your browser when you click them. The policy blocks the page from making requests itself, not from following a link you choose.
- **Updates are manual.** Download the new file when a release comes out. There is no update check, by design.

## Build it

```sh
npm run build:paranoid     # writes dist-paranoid/keybard-paranoid.html and SHA256SUMS.txt
```

`build/paranoid.ts` inlines everything. It hashes each inline script into the policy, after normalizing line endings exactly as browsers do, and fails the build if any external script, stylesheet, image, font or remote CSS URL remains. `tests/build/paranoid.test.ts` covers these rules.
