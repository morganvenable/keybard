import { useEffect, useRef } from 'react';
import { useOptionalLayoutSettings } from '@/contexts/LayoutSettingsContext';
import { DEFAULT_SHIFTED_LEGENDS } from '@/lib/shiftedLegends';
import { useHost, type HostConfig } from './host';
import { AUTO_LAYOUT, setOverlayLayout } from '@/lib/autoLegends';

/**
 * Keeps a connected Keybard Overlay on the settings Keybard owns: the keyboard language, Shifted Key Symbols
 * and AltGr Symbols. With Key legends on Automatic it sends "auto" to an Overlay that reads the computer's
 * layout itself (it reports osLayout, available), so the Overlay follows layout switches on its own; any other
 * Overlay gets the layout Keybard shows. It also passes the Overlay's osLayout to the layout settings.
 * Runs whenever Keybard is open (not only while the Overlay dialog is), so a change in Settings, or opening Keybard with an Overlay already running, reaches the overlay at once.
 *
 * One write carries everything, because two writes started in the same render race: the second finds the
 * first still in flight and is dropped. An older overlay app has neither legend field and rejects unknown
 * ones, so only fields it reports are sent. A write that did not start (busy) is tried again when the busy
 * flag clears; one that started is not repeated for the same values on this connection, whatever the
 * overlay's revision: two Keybard tabs (or the stable and Unstable sites) with different settings would
 * otherwise overwrite each other forever. Each sends its values once; the last one sent stays.
 */
export function HostSettingsSync() {
    const host = useHost({ background: true });
    const settings = useOptionalLayoutSettings();
    const shownLayout = settings?.internationalLayout, choice = settings?.keyLegendsChoice, showShiftedLegends = settings?.showShiftedLegends, showAltGrLegends = settings?.showAltGrLegends;
    const shiftedLegends = showShiftedLegends ?? DEFAULT_SHIFTED_LEGENDS, altgrLegends = showAltGrLegends === true;
    const tried = useRef('');
    const osLayout = host.state?.osLayout;
    useEffect(() => { setOverlayLayout(osLayout); }, [osLayout]);
    useEffect(() => () => setOverlayLayout(undefined), []);
    const internationalLayout = choice === AUTO_LAYOUT && osLayout?.available ? AUTO_LAYOUT : shownLayout;
    useEffect(() => {
        const config = host.state?.config;
        if (!config || host.busy || internationalLayout === undefined) return;
        const fields: Partial<Pick<HostConfig, 'layoutId' | 'shiftedLegends' | 'altgrLegends'>> = {};
        if (config.layoutId !== internationalLayout) fields.layoutId = internationalLayout;
        if ('shiftedLegends' in config && config.shiftedLegends !== shiftedLegends) fields.shiftedLegends = shiftedLegends;
        if ('altgrLegends' in config && config.altgrLegends !== altgrLegends) fields.altgrLegends = altgrLegends;
        if (!Object.keys(fields).length) { tried.current = ''; return; }
        const attempt = `${host.state?.session}:${JSON.stringify(fields)}`;
        if (tried.current === attempt) return;
        void Promise.resolve(host.configure(latest => ({ ...latest, ...fields }))).then(started => { if (started !== null) tried.current = attempt; });
    }, [internationalLayout, shiftedLegends, altgrLegends, host.state?.session, host.state?.config, host.busy]);
    return null;
}
