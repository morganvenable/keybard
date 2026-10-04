/** App copy keyed by firmware value ID. Labels never alter values or protocol IDs. */
export const developerSettingsCopy: Record<string, { label: string; description: string }> = {
    id_turbo_scan: { label: "Key scan speed", description: "Selects a preset for key scanning. Higher values scan faster." },
    id_scan_prewait_us: { label: "Sensor settling time · µs", description: "Waits before reading each key sensor row. Zero uses the scan speed preset." },
    id_scan_postwait_us: { label: "Pause after sensor reading · µs", description: "Waits after reading each key sensor row. Zero uses the scan speed preset." },
    id_scan_period_us: { label: "Active scan interval · µs", description: "Time between key scans while active. Zero scans as fast as possible and disables keyboard idle stages." },
    id_scan_idle_after_ms: { label: "Enter idle after · ms", description: "Time without key or pointer activity before idle begins. Zero disables idle." },
    id_scan_idle_period_ms: { label: "Idle scan interval · ms", description: "Time between key scans while idle. A longer interval saves power but can delay the first response. Must exceed the active interval." },
    id_scan_deep_after_s: { label: "Enter deep idle after · s", description: "Time without activity before deeper power saving begins. Measured from the last activity, not from entering idle. Zero disables deep idle." },
    id_scan_deep_period_ms: { label: "Deep idle scan interval · ms", description: "Time between key scans in deep idle. A longer interval saves power but can delay the first response. Must exceed the active interval." },
    id_idle_pointer_rest: { label: "Trackball power saving", description: "Reduces sensor power while the ball is still. Movement wakes it automatically. Separate from the keyboard idle timers." },
    id_idle_rgb_dim: { label: "Dim lighting when idle", description: "Dims lighting in idle and turns it off in deep idle. Input restores the previous brightness." },
    id_idle_cpu_sleep: { label: "Sleep between key scans", description: "Lets the processor sleep between scans instead of running continuously. Requires a scan interval." },
    id_idle_low_clock: { label: "Reduce processor speed in deep idle", description: "Slows the processor in deep idle to save power. Activity restores full speed." },
    id_idle_long_nap: { label: "Longer sleep in deep idle", description: "Wakes the processor less often in deep idle to save power. Requires sleep between key scans and may delay the first response." },
    id_scan_deep_clock_idx: { label: "Deep idle processor speed", description: "Processor speed used when reduced speed in deep idle is enabled." },
};
