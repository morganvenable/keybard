import React from "react";
import DescriptionBlock from "@/layout/SecondarySidebar/components/DescriptionBlock";
import { KEYBARD_LICENSE, KEYBARD_SOURCE_URL, KEYBR_SOURCE_URL, SVALBR_URL } from "@/constants/license";

const linkClass = "font-medium text-kb-primary underline";

const AboutPanel: React.FC = () => {
    return (
        <div className="space-y-3 pt-0 pb-8 relative flex flex-col">
            <div className="flex flex-col">
                <DescriptionBlock wrapText={false}>
                    <p className="mb-4 text-sm text-slate-500 dark:text-neutral-400 leading-relaxed">
                        <b>Keybard</b> version 1.0.0
                        <br/><br/>
                        Developed for the <b>Svalboard</b> community.
                        <br/><br/>
                        Licensed {KEYBARD_LICENSE} ·{" "}
                        <a href={KEYBARD_SOURCE_URL} target="_blank" rel="noreferrer" className={linkClass}>Source code</a>
                        <br/>
                        Includes code from{" "}
                        <a href={KEYBR_SOURCE_URL} target="_blank" rel="noreferrer" className={linkClass}>keybr.com</a>{" "}
                        by Aliaksandr Radzivanovich (aradzie) and ideas from{" "}
                        <a href={SVALBR_URL} target="_blank" rel="noreferrer" className={linkClass}>svalbr</a>{" "}
                        by River (r-tae).
                    </p>
                </DescriptionBlock>
            </div>
        </div>
    );
};

export default AboutPanel;
