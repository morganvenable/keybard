// Pin a published Svalboard firmware release into this Keybard build.
//
//   node scripts/pin-firmware-release.mjs x4.1
//
// Downloads svalboard_sval_<tag>.uf2 from the svalboard/qmk release <tag> (with gh),
// checks it is a pair UF2 whose manifest names that tag, and then makes it the one
// release this build carries: public/firmware/<tag>/ holds the file, every other folder
// under public/firmware/ is removed, and CARRIED_RELEASES in
// src/constants/firmware-releases.ts becomes this one entry, with its SHA-256, size,
// fw_version and updater protocol read from the file itself.
//
// Run it after release CI has published the tag, then run npm test (the pins test reads
// the carried file back) and commit both changes together.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tag = process.argv[2];
if (!tag || !/^[vx]\d+(\.\d+)*$/.test(tag)) {
    console.error("usage: node scripts/pin-firmware-release.mjs <tag>   (a v or x release tag, e.g. x4.1)");
    process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = `svalboard_sval_${tag}.uf2`;
const outDir = path.join(root, "public", "firmware", tag);
mkdirSync(outDir, { recursive: true });
execFileSync("gh", ["release", "download", tag, "-R", "svalboard/qmk", "-p", name, "-D", outDir, "--clobber"], { stdio: "inherit" });
const bytes = readFileSync(path.join(outDir, name));

// A pair UF2 (docs/pair-uf2.md): 512-byte blocks, the last 16 the record sector at 0x10270000.
const u32 = (b, o) => b.readUInt32LE(o);
if (bytes.length % 512 !== 0 || bytes.length < 512 * 17) throw new Error(`${name}: not a pair UF2 (${bytes.length} bytes)`);
const recordBlock = bytes.length / 512 - 16;
const block = bytes.subarray(recordBlock * 512, recordBlock * 512 + 512);
if (u32(block, 0) !== 0x0a324655 || u32(block, 4) !== 0x9e5d5157 || u32(block, 12) !== 0x10270000) throw new Error(`${name}: no pair record sector`);
const record = block.subarray(32, 32 + 256);
if (u32(record, 0) !== 0x55505653) throw new Error(`${name}: no pair record`);
const manifest = record.subarray(16, 16 + 108);
const updaterProtocol = manifest[15];
const fwVersion = u32(manifest, 20);
const versionString = manifest.subarray(28, 44).toString("latin1").replace(/\0+$/, "");
if (versionString !== tag) throw new Error(`${name}: its manifest says ${JSON.stringify(versionString)}, not ${tag}`);
if (manifest[7] !== 2) throw new Error(`${name}: not the one image for both halves (hand ${manifest[7]})`);
const sha256 = createHash("sha256").update(bytes).digest("hex");

for (const dir of readdirSync(path.join(root, "public", "firmware"))) {
    if (dir !== tag) rmSync(path.join(root, "public", "firmware", dir), { recursive: true, force: true });
}

const file = path.join(root, "src", "constants", "firmware-releases.ts");
const src = readFileSync(file, "utf8");
const start = src.indexOf("export const CARRIED_RELEASES: FirmwareReleasePin[] = [");
const end = src.indexOf("\n];", start);
if (start < 0 || end < 0) throw new Error("CARRIED_RELEASES not found");
const entry = `export const CARRIED_RELEASES: FirmwareReleasePin[] = [
    {
        tag: "${tag}",
        kind: "${tag[0]}",
        fwVersion: ${fwVersion},
        updaterProtocol: ${updaterProtocol},
        svalProtocol: 3,
        file: {
            uf2: "${name}",
            sha256: "${sha256}",
            size: ${bytes.length},
        },
        notesUrl: "https://github.com/svalboard/qmk/releases/tag/${tag}",
    },`;
writeFileSync(file, src.slice(0, start) + entry + src.slice(end));
console.log(`pinned ${name}: fw_version ${fwVersion}, updater protocol ${updaterProtocol}, ${bytes.length} bytes, sha256 ${sha256}`);
