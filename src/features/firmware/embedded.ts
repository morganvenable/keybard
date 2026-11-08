// Firmware files carried inside the page itself, as base64, by tag. Empty in the hosted
// builds (their files are served beside the page). A single-file test build adds
// src/generated/embedded-*.ts modules (each a default export of { tag: base64 }).
const modules = import.meta.glob<{ default: Record<string, string> }>("../../generated/embedded-*.ts", { eager: true });

export const EMBEDDED_FILES: Record<string, string> = Object.assign({}, ...Object.values(modules).map((m) => m.default));
