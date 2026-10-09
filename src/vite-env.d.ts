/// <reference types="vite/client" />

// Injected by vite.config.ts at build time
declare const __GIT_BRANCH__: string;
declare const __GIT_SHA__: string;
declare const __GIT_SUBJECT__: string;
declare module "virtual:bundled-layers" {
    const layers: { layers?: unknown[] } | null;
    export default layers;
}
declare module "virtual:paranoid-fonts" {}
/** Practice's English content: compiled in for Paranoid, null in other builds (docs/practice/spec.md §7.5). */
declare module "virtual:practice-content" {
    const content: { model: string; words: string[] } | null;
    export default content;
}
