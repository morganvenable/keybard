import React from "react";
import { MANUAL_URL } from "@/lib/manual";
import { PARANOID } from "@/lib/paranoid";
import { keybardVersion, RELEASE_TAG } from "@/utils/build-info";
import { currentSite, type Site } from "@/constants/firmware-releases";
import { descriptorFor, releaseNotesUrl, SITES, useSiteVersion, versionRows, sitesToRead } from "@/utils/site-versions";

/** The Svalboard community: a permanent Discord invite. */
export const COMMUNITY_URL = "https://svalboard.com/discord";

const linkClass = "underline underline-offset-2 hover:text-kb-ink";

/**
 * Keybard's own facts and links. Each release version is paired with the site
 * that serves it (v releases: keybard.svalboard.com, x releases:
 * next.keybard.svalboard.com), this build first, each with its plain word
 * (Stable, Bleeding edge) from its tag kind. Other sites' versions are read
 * from their version.json, never guessed; Paranoid reads nothing.
 */
const AboutSection: React.FC<{ tag?: string; label?: string; paranoid?: boolean; buildSite?: Site }> = ({
    tag = RELEASE_TAG,
    label = keybardVersion(),
    paranoid = PARANOID,
    buildSite = currentSite(),
}) => {
    const read = sitesToRead(tag, paranoid, buildSite);
    const production = useSiteVersion(read.includes("production") ? "production" : null);
    const next = useSiteVersion(read.includes("next") ? "next" : null);
    const rows = versionRows({ tag, label, paranoid, buildSite, fetched: { production, next } });

    return (
        <div className="flex flex-col gap-2 px-3 py-2.5 text-sm">
            {/* Word, version and site in aligned columns; on a narrow card the site
                drops to its own line under the word and version. Explicit table roles: the rows use display: contents. */}
            <div className="@container">
                <div
                    role="table"
                    aria-label="Keybard"
                    className="grid grid-cols-[max-content_max-content_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 @max-[25rem]:grid-cols-[max-content_minmax(0,1fr)]"
                >
                    <div role="rowgroup" className="contents">
                        {rows.map((row) => {
                            const word = descriptorFor(row.version);
                            const ink = row.thisOne ? "text-kb-ink" : "text-muted-foreground";
                            return (
                                <div role="row" key={row.site ?? "build"} className="contents" data-version-row="">
                                    <span role="cell" className={`whitespace-nowrap ${ink}`}>{word ?? ""}</span>
                                    <span role="cell" className={`whitespace-nowrap font-mono ${ink}`}>
                                        {row.version ?? <span className="sr-only">version not known</span>}
                                    </span>
                                    <span role="cell" className="min-w-0 text-muted-foreground @max-[25rem]:col-span-full @max-[25rem]:-mt-0.5 @max-[25rem]:mb-1.5">
                                        {row.site && (
                                            <a href={SITES[row.site].url} target="_blank" rel="noopener" className={`${linkClass} whitespace-nowrap`}>
                                                {SITES[row.site].host}
                                            </a>
                                        )}
                                        {row.site && row.version && row.firmware && <span>, <span className="whitespace-nowrap">firmware {row.firmware}</span></span>}
                                        {row.thisOne && <span className={`whitespace-nowrap ${row.site ? "ml-1.5" : ""}`}>(this one)</span>}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <p className="flex flex-row flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <a href={MANUAL_URL} target="_blank" rel="noopener" className={linkClass}>Manual</a>
                <a href={releaseNotesUrl(tag)} target="_blank" rel="noopener" className={linkClass}>Release notes</a>
                <a href={COMMUNITY_URL} target="_blank" rel="noopener" className={linkClass}>Svalboard community</a>
            </p>
        </div>
    );
};

export default AboutSection;
