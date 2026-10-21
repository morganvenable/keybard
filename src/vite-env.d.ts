/// <reference types="vite/client" />

// Injected by vite.config.ts at build time
declare const __GIT_BRANCH__: string;
declare const __GIT_SHA__: string;
declare const __GIT_SUBJECT__: string;
declare const __RELEASE_TAG__: string;
/** The firmware mock board (?fwfake) is in this build: dev servers and the test site only. */
declare const __FW_FAKE__: boolean;
declare module "virtual:bundled-layers" {
    const layers: { layers?: unknown[] } | null;
    export default layers;
}
declare module "virtual:paranoid-fonts" {}
