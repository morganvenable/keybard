/// <reference lib="es2022" />
// The vendored keybr engine is written for ES2022+ (keybr compiles with lib
// es2024). It uses Array.prototype.at, Error `cause` options and Intl.Segmenter,
// all available in every browser Practice supports. Keybard's tsconfig targets
// ES2020, so this reference adds the ES2022 library types for the engine.
// (A reference lib applies to the whole program; see docs/practice/notes/M1a.md.)
export {};
