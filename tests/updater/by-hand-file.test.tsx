// The Install by hand file card: downloads the in-memory copy (embedded or fetched, checked
// against its pin) as a Blob under the release's file name; else the usual URL; never an
// image whose SHA-256 misses the pin.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createHash } from "node:crypto";

import type { FirmwareReleasePin } from "@/constants/firmware-releases";
import { carriedBytes, forgetVerified, FileCheckError } from "@/features/firmware/file-bytes";
import { ManualInstall } from "@/features/firmware/ManualInstall";
import * as fileBytes from "@/features/firmware/file-bytes";

vi.mock("@/lib/paranoid", () => ({ PARANOID: false, userIsLooking: () => true }));

const bytes = new Uint8Array([1, 2, 3, 4, 5]);
const b64 = Buffer.from(bytes).toString("base64");
const sha = createHash("sha256").update(bytes).digest("hex");
const release: FirmwareReleasePin = {
    tag: "x9", kind: "x", fwVersion: 9, updaterProtocol: 4,
    file: { uf2: "svalboard_sval_x9.uf2", sha256: sha, size: bytes.length }, notesUrl: "",
};
const okFetch = (b: Uint8Array) => vi.fn(async () => new Response(b as BlobPart)) as unknown as typeof fetch;

beforeEach(() => forgetVerified());

describe("carriedBytes", () => {
    it("uses the embedded copy without fetching", async () => {
        const f = vi.fn() as unknown as typeof fetch;
        expect(await carriedBytes(release, { embedded: { x9: b64 }, fetcher: f })).toEqual(bytes);
        expect(f).not.toHaveBeenCalled();
    });
    it("fetches from the release URL when nothing is embedded", async () => {
        const f = okFetch(bytes);
        expect(await carriedBytes(release, { embedded: {}, fetcher: f })).toEqual(bytes);
        expect(f).toHaveBeenCalledWith("/firmware/x9/svalboard_sval_x9.uf2", expect.anything());
    });
    it("refuses bytes that miss the pin", async () => {
        await expect(carriedBytes(release, { embedded: { x9: Buffer.from([9, 9]).toString("base64") } })).rejects.toBeInstanceOf(FileCheckError);
        await expect(carriedBytes(release, { embedded: {}, fetcher: okFetch(new Uint8Array([7])) })).rejects.toBeInstanceOf(FileCheckError);
    });
    it("returns null when it can't fetch and nothing is embedded (Paranoid)", async () => {
        expect(await carriedBytes(release, { embedded: {}, paranoid: true })).toBeNull();
    });
});

describe("the file card", () => {
    const props = {
        release, backup: null, afterwards: "stay" as never, onAfterwards: () => {}, onConnect: () => {}, onClose: () => {},
    };
    it("saves the verified bytes under the file name", async () => {
        const save = vi.spyOn(fileBytes, "saveBytes").mockImplementation(() => {});
        vi.stubGlobal("fetch", okFetch(bytes));
        render(<ManualInstall {...props} />);
        const card = document.querySelector("[data-file=both]") as HTMLAnchorElement;
        expect(card.getAttribute("download")).toBe("svalboard_sval_x9.uf2");
        fireEvent.click(card);
        await waitFor(() => expect(save).toHaveBeenCalledWith(bytes, "svalboard_sval_x9.uf2"));
    });
    it("says so and saves nothing when the file misses its pin", async () => {
        const save = vi.spyOn(fileBytes, "saveBytes").mockImplementation(() => {});
        vi.stubGlobal("fetch", okFetch(new Uint8Array([7])));
        render(<ManualInstall {...props} />);
        fireEvent.click(document.querySelector("[data-file=both]")!);
        expect((await screen.findByRole("alert")).textContent).toMatch(/checksum/);
        expect(save).not.toHaveBeenCalled();
    });
});
