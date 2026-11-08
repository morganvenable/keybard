// Firmware files carried inside the page itself, as base64, by tag. Empty in the hosted
// builds (their files are served beside the page). A single-file test build replaces this
// with the files it embeds.
export const EMBEDDED_FILES: Record<string, string> = {};
