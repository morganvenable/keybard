/**
 * Each Keybard release is served by one public site: v releases by
 * keybard.svalboard.com, x releases by next.keybard.svalboard.com. Every release
 * deploy publishes version.json at its site's root ({"tag":"v4.3.6","firmware":"v4.3.5"}:
 * the Keybard release and the newest firmware it carries, which can differ), so
 * a page can show the other site's real versions. Nothing here guesses: a site
 * whose file cannot be read is shown with no version.
 */
import { useEffect, useState } from "react";
import { currentSite, newestFirmwareFor, parseReleaseTag, siteForTag, type Site } from "@/constants/firmware-releases";

export { siteForTag };
export type PublicSite = "production" | "next";

export const SITES: Record<PublicSite, { host: string; url: string }> = {
    production: { host: "keybard.svalboard.com", url: "https://keybard.svalboard.com/" },
    next: { host: "next.keybard.svalboard.com", url: "https://next.keybard.svalboard.com/" },
};

export const VERSION_FILE = "version.json";
export const RELEASES_URL = "https://github.com/svalboard/keybard/releases";

/** A site's published versions. */
export interface SiteVersion {
    tag: string;
    /** The newest firmware release the site carries; null when the file names none. */
    firmware: string | null;
}

/** This release's notes when the build has a tag, else the releases list. */
export function releaseNotesUrl(tag: string): string {
    return parseReleaseTag(tag) ? `${RELEASES_URL}/tag/${tag}` : RELEASES_URL;
}

/**
 * A site's version.json, only if its tag is a release that site serves. Its
 * firmware must be one that site can carry: keybard.svalboard.com carries only
 * v firmware; next carries both.
 */
export function parseVersionFile(data: unknown, site: PublicSite): SiteVersion | null {
    const { tag, firmware } = (data ?? {}) as { tag?: unknown; firmware?: unknown };
    if (typeof tag !== "string" || siteForTag(tag) !== site) return null;
    const kind = typeof firmware === "string" ? parseReleaseTag(firmware)?.kind : undefined;
    const carried = kind === "v" || (kind === "x" && site === "next");
    return { tag, firmware: carried ? (firmware as string) : null };
}

/** Read a site's version.json. Any failure (network, 404, bad JSON, wrong kind) is null. */
export async function fetchSiteVersion(site: PublicSite, fetchImpl: typeof fetch = fetch): Promise<SiteVersion | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetchImpl(SITES[site].url + VERSION_FILE, { cache: "no-store", signal: controller.signal });
        if (!res.ok) return null;
        return parseVersionFile(await res.json(), site);
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// One read per site per page load, shared by the About section and the banner.
const cache = new Map<PublicSite, Promise<SiteVersion | null>>();

export function siteVersion(site: PublicSite): Promise<SiteVersion | null> {
    let p = cache.get(site);
    if (!p) {
        p = fetchSiteVersion(site);
        cache.set(site, p);
        // A failed read is not remembered: the next one (About opened later) tries again.
        p.then((v) => { if (!v && cache.get(site) === p) cache.delete(site); });
    }
    return p;
}

/** For tests. */
export function resetSiteVersions(): void {
    cache.clear();
}

/** A site's fetched versions: null while reading and when they are not known. */
export function useSiteVersion(site: PublicSite | null): SiteVersion | null {
    const [version, setVersion] = useState<{ site: PublicSite; value: SiteVersion | null } | null>(null);
    useEffect(() => {
        if (!site) return;
        let live = true;
        siteVersion(site).then((value) => { if (live) setVersion({ site, value }); });
        return () => { live = false; };
    }, [site]);
    return site && version?.site === site ? version.value : null;
}

/**
 * The public site this build is: the one serving its tag, when the build was
 * made for that site. A build with no tag, or a release built for somewhere else
 * (Keybard Overlay builds x tags for production), is no public site.
 */
export function ownSite(tag: string, buildSite: Site = currentSite()): PublicSite | null {
    const site = siteForTag(tag);
    return site && site === buildSite ? site : null;
}

/** The sites this build reads version.json from: the other public site, or both when it is none. */
export function sitesToRead(tag: string, paranoid: boolean, buildSite: Site = currentSite()): PublicSite[] {
    if (paranoid) return [];
    const own = ownSite(tag, buildSite);
    return own === "production" ? ["next"] : own === "next" ? ["production"] : ["production", "next"];
}

/**
 * The plain word for a release version, from its tag kind: v releases are
 * stable, x releases bleeding edge. Only ever shown beside the version itself;
 * null for anything that is not a release tag (a build's commit, an unknown version).
 */
export function descriptorFor(version: string | null): "Stable" | "Bleeding edge" | null {
    const kind = version ? parseReleaseTag(version)?.kind : undefined;
    return kind === "v" ? "Stable" : kind === "x" ? "Bleeding edge" : null;
}

export interface VersionRow {
    /** The Keybard version shown, or null when it is not known. */
    version: string | null;
    /** The newest firmware that site carries, when known. */
    firmware: string | null;
    /** The site serving it; null for a build no public site serves. */
    site: PublicSite | null;
    thisOne: boolean;
}

/**
 * The About rows. A release build pairs its version with its own site, first
 * and marked, then the other site with its fetched version. A build with no
 * release tag shows its own label, then both public sites. Paranoid never
 * reads the network, so it shows only its own row.
 */
export function versionRows(opts: {
    tag: string;
    label: string;
    fetched: Partial<Record<PublicSite, SiteVersion | null>>;
    paranoid?: boolean;
    buildSite?: Site;
}): VersionRow[] {
    const paranoid = !!opts.paranoid;
    const buildSite = opts.buildSite ?? currentSite();
    const own = ownSite(opts.tag, buildSite);
    const rows: VersionRow[] = [{
        version: opts.label,
        firmware: own && !paranoid ? newestFirmwareFor(own) : null,
        site: own,
        thisOne: true,
    }];
    for (const site of sitesToRead(opts.tag, paranoid, buildSite)) {
        const v = opts.fetched[site];
        rows.push({ version: v?.tag ?? null, firmware: v?.firmware ?? null, site, thisOne: false });
    }
    return rows;
}
