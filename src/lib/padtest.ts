// A firmware test build (VITE_PADTEST=1): a Keybard that carries the test firmware and the
// official release inside the file, installs them through the usual updater,
// and says on every screen that it is a test.
export const PADTEST = import.meta.env.VITE_PADTEST === "1";
