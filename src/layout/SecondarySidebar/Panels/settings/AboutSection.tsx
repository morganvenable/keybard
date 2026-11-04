import React from "react";
import { MANUAL_URL } from "@/lib/manual";
import { PARANOID } from "@/lib/paranoid";
import { keybardVersion, RELEASE_TAG } from "@/utils/build-info";
import { currentSite, type Site } from "@/constants/firmware-releases";
import { releaseNotesUrl, SITES, useSiteVersion, versionRows, sitesToRead } from "@/utils/site-versions";

/** The Svalboard community: a permanent Discord invite. */
export const COMMUNITY_URL = "https://svalboard.com/discord";

const linkClass = "underline underline-offset-2 hover:text-kb-ink";

/**
 * Keybard's own facts and links. Each release version is paired with the site
 * that serves it (v releases: keybard.svalboard.com, x releases:
 * next.keybard.svalboard.com), this build first. Other sites' versions are read
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
            <dl aria-label="Keybard" className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1">
                {rows.map((row) => (
                    <React.Fragment key={row.site ?? "build"}>
                        <dt className={`font-mono break-all ${row.thisOne ? "text-kb-ink" : "text-muted-foreground"}`}>
                            {row.version ?? <span className="sr-only">version not known</span>}
                        </dt>
                        <dd className="break-words text-muted-foreground">
                            {row.site && (
                                <a href={SITES[row.site].url} target="_blank" rel="noopener" className={linkClass}>
                                    {SITES[row.site].host}
                                </a>
                            )}
                            {row.site && row.version && row.firmware && <span>, firmware {row.firmware}</span>}
                            {row.thisOne && <span className={row.site ? "ml-1.5" : undefined}>(this one)</span>}
                        </dd>
                    </React.Fragment>
                ))}
            </dl>
            <p className="flex flex-row flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <a href={MANUAL_URL} target="_blank" rel="noopener" className={linkClass}>Manual</a>
                <a href={releaseNotesUrl(tag)} target="_blank" rel="noopener" className={linkClass}>Release notes</a>
                <a href={COMMUNITY_URL} target="_blank" rel="noopener" className={linkClass}>Svalboard community</a>
            </p>
        </div>
    );
};

export default AboutSection;
