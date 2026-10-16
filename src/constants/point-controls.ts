import type { KeyboardInfo } from '@/types/keyboard.types';

export interface PointSpeed { horizontal: number; vertical: number; linked: boolean }
// v5 proportional scrolling uses reversal as dead-zone counts + 1; other tools retain reversal tolerance.
export interface PointProfile { distance: number; interval: number; reversal: number; speed?: PointSpeed; useDefaults?: boolean; action?: number; invertHorizontal?: boolean; invertVertical?: boolean }
export interface PointControls { version: 1 | 2 | 3 | 4 | 5; profiles: PointProfile[]; defaults?: PointSpeed; universal?: boolean }
// GET_INFO feature_flags2 bit 7 (sval_flag2_pointing_tools). Bits 0-6 belong to other features
// (bit 5 is POINTING_CONTACTS, bit 6 the one-image side command).
export const POINT_CONTROL_FLAG = 0x80;
export const POINT_PRESETS = ['Volume', 'Arrows', 'Tabs', 'Tasks'] as const;
// Descriptions give the Windows shortcut first; the board switches to the Command
// versions by itself when the host is macOS.
export const POINT_ACTIONS = [
    {name:'Volume', short:'Vol', description:'Vertical: up increases volume, down decreases it. Standard consumer HID. Waits while a keyboard modifier is held.'},
    {name:'Arrows', short:'Arr', description:'Both axes: left/right/up/down arrow keys. Held Shift and Ctrl carry through: Shift selects, Ctrl jumps by word.'},
    {name:'Tabs', short:'Tab', description:'Horizontal: left sends Ctrl+Shift+Tab; right sends Ctrl+Tab. On macOS, Command+Shift+[ / Command+Shift+].'},
    {name:'Tasks', short:'Tsk', description:'Horizontal: Alt+Shift+Tab / Alt+Tab. Release or Enter accepts; Escape cancels. On macOS, Command+Tab.'},
    {name:'Zoom', short:'Zm', description:'Vertical: up sends Ctrl+= (zoom in); down sends Ctrl+- (zoom out). On macOS, Command+= / Command+-. Browser/app zoom, US keyboard layout.'},
    {name:'Undo / Redo', short:'Un', description:'Horizontal: left sends Ctrl+Z (undo); right sends Ctrl+Shift+Z (redo). On macOS, Command+Z / Command+Shift+Z. Choose the Ctrl+Y preset if your app needs it.'},
    {name:'Undo / Redo (Ctrl+Y)', short:'UnY', description:'Horizontal: left sends Ctrl+Z (undo); right sends Ctrl+Y (redo). On macOS, Command+Z / Command+Y. Windows app preset.'},
    {name:'Proportional scroll', short:'Pan', description:'Move away from the activation point to set scrolling velocity. Return to center to stop; release Hold or switch Toggle off to stop and recenter. Both axes use your existing free-scroll / axis-lock policy.'},
] as const;
export const pointAction = (value: PointControls, index: number) => POINT_ACTIONS[value.profiles[index].action ?? index];
export const pointSlotName = (value: PointControls, index: number) => `Tool ${index+1} · ${pointAction(value,index).name}`;
type PointingInfo = Pick<Partial<KeyboardInfo>, 'pointing_hardware'> | null | undefined;
/** "ball", "pad" or "stick" for the half's pointing module when Keybard knows it, else "pointer". */
export function pointDevice(side: number, kb?: PointingInfo): string {
    const half = kb?.pointing_hardware?.halves.find(h => h.side === (side ? 'right' : 'left'));
    const module = half && (half.builtFor !== 'none' ? half.builtFor : half.detected);
    if (module === 'pmw3360' || module === 'pmw3389') return 'ball';
    if (module === 'azoteq') return 'pad';
    if (module === 'trackpoint') return 'stick';
    return 'pointer';
}
export const pointSideName = (side: number, kb?: PointingInfo) => `${side ? 'Right' : 'Left'} ${pointDevice(side, kb)}`;
/** The label and title a slot key shows: the action its slot runs, the side and hold or toggle. */
export function configuredPointKey(key: PointKey, value?: PointControls, kb?: PointingInfo) {
    if (key.side < 0) return key;
    const slot = ((key.code-0x7e00)%8)>>1, toggle=!!(key.code&1);
    const known = value && value.version >= 4;
    const action = known ? pointAction(value,slot) : undefined;
    const label = `${key.side?'R':'L'} ${action ? action.short : `T${slot+1}`}\n${toggle?'TG':'Hold'}`;
    const title = `${pointSideName(key.side,kb)}: ${action ? action.name : `Tool ${slot+1}`} (${toggle?'toggle':'hold'})`;
    return {...key,label,title};
}
export const POINT_DEFAULTS: PointProfile[] = [
    { distance: 64, interval: 80, reversal: 8 }, { distance: 32, interval: 80, reversal: 8 },
    { distance: 96, interval: 80, reversal: 8 }, { distance: 96, interval: 160, reversal: 8 },
];
export const supportsPointControls = (kb?: Partial<KeyboardInfo> | null) => !!((kb?.feature_flags2 ?? 0) & POINT_CONTROL_FLAG);
export const hasPointControls = (kb?: Partial<KeyboardInfo> | null) => supportsPointControls(kb) || !!kb?.pointing_controls;
export interface PointKey { code: number; name: string; label: string; title: string; side: number; hidden?: boolean }
// QK_KB 0x7E00-0x7E3F belongs to Svalboard pointing tools: 0x7E00 + side*8 + slot*2 + mode,
// then the shared keys. New keys go at the end; never renumber.
export const POINT_BLOCK_FIRST = 0x7e00, POINT_BLOCK_LAST = 0x7e3f;
export const isPointCode = (code: unknown) => typeof code === 'number' && code >= POINT_BLOCK_FIRST && code <= POINT_BLOCK_LAST;
export const POINT_KEYS: PointKey[] = [
    ...['L', 'R'].flatMap((side, sideIndex) => [1, 2, 3, 4].flatMap((slot, index) => ['HOLD', 'TOGGLE'].map((activation, mode) => ({
        code: 0x7e00 + sideIndex * 8 + index * 2 + mode,
        name: `SV_POINT_${side}_TOOL${slot}_${activation}`,
        label: `${side} T${slot}\n${mode ? 'TG' : 'Hold'}`,
        title: `${sideIndex ? 'Right' : 'Left'} pointer: Tool ${slot} (${mode ? 'toggle' : 'hold'})`, side: sideIndex,
    })))),
    { code: 0x7e10, name: 'SV_POINT_STOP_ALL', label: 'Stop\nall', title: 'Stop all pointing tools and cancel task switching', side: -1 },
    // Diagnostic: the code stays reserved, Keybard doesn't offer it.
    { code: 0x7e11, name: 'SV_POINT_TRACE', label: 'Point\ntrace', title: 'Print pointing tool counters to the console', side: -1, hidden: true },
    { code: 0x7e12, name: 'SV_POINT_FINER', label: 'Step\n½', title: 'Finer: halve the travel per step until the next save', side: -1 },
    { code: 0x7e13, name: 'SV_POINT_COARSER', label: 'Step\n×2', title: 'Coarser: double the travel per step until the next save', side: -1 },
    // Reserved for later pointing tools keys; the board swallows them.
    ...Array.from({length: POINT_BLOCK_LAST - 0x7e13}, (_, i) => {
        const code = 0x7e14 + i;
        return { code, name: `SV_POINT_RESERVED_${code.toString(16).toUpperCase()}`, label: 'Point\nres.', title: 'Reserved pointing tools code (does nothing)', side: -1, hidden: true };
    }),
];
/** The keys Keybard's picker offers: the slot keys, Stop all, Finer and Coarser. */
export const PICKER_POINT_KEYS = POINT_KEYS.filter(key => !key.hidden);
/** Names from earlier test builds, still read from layout files. */
export const POINT_KEY_ALIASES: Record<string, string> = {
    SV_POINT_CANCEL: 'SV_POINT_STOP_ALL',
    ...Object.fromEntries(['L', 'R'].flatMap(side => ['VOLUME', 'ARROWS', 'TABS', 'TASKS'].flatMap((old, slot) =>
        ['HOLD', 'TOGGLE'].map(mode => [`SV_POINT_${side}_${old}_${mode}`, `SV_POINT_${side}_TOOL${slot + 1}_${mode}`])))),
};
export function pointKey(value: string | number) {
    if (typeof value === 'string') value = POINT_KEY_ALIASES[value] ?? value;
    return POINT_KEYS.find(key => typeof value === 'number' ? key.code === value : key.name === value);
}
export function validatePointControls(value: unknown): asserts value is PointControls {
    const v = value as PointControls;
    if ((v?.version === 4 || v?.version === 5) && (!Array.isArray(v.profiles) || v.profiles.some(p => !p || !Number.isInteger(p.action) || p.action! < 0 || p.action! >= (v.version===4?7:POINT_ACTIONS.length) || typeof p.invertHorizontal !== 'boolean' || typeof p.invertVertical !== 'boolean'))) throw new Error('Invalid pointing tool preset or direction settings.');
    if (v?.version === 2 || v?.version === 3 || v?.version === 4 || v?.version === 5) {
        const validSpeed = (s?: PointSpeed) => s && [s.horizontal,s.vertical].every(n=>Number.isInteger(n)&&n>=0&&n<=63) && typeof s.linked==='boolean' && (!s.linked || s.horizontal===s.vertical);
        if (!validSpeed(v.defaults) || typeof v.universal!=='boolean' || !Array.isArray(v.profiles) || v.profiles.some(p=>!validSpeed(p?.speed)||typeof p?.useDefaults!=='boolean')) throw new Error('Invalid pointing speed settings.');
    }
    if (!v || ![1, 2, 3, 4, 5].includes(v.version) || !Array.isArray(v.profiles) || v.profiles.length !== 4 || v.profiles.some(p =>
        !p || !Number.isInteger(p.distance) || p.distance < 8 || p.distance > 1024 ||
        !Number.isInteger(p.interval) || (v.version >= 3 ? p.interval !== 0 && p.interval < 4 : p.interval < 40) || p.interval > 250 ||
        !Number.isInteger(p.reversal) || p.reversal < 1 || p.reversal > 64 || (v.version === 1 && p.reversal > p.distance))) {
        throw new Error('Invalid pointing tools: check motion distance, rate and reversal tolerance.');
    }
}

// 64 logarithmic speed positions: 1024 down to 8 normalized counts per action.
export const POINT_DISTANCES = Array.from({length:64}, (_, i) => Math.round(1024 * 2 ** (-i / 9)));
export const speedDistance = (speed: number) => POINT_DISTANCES[speed];
export const nearestSpeed = (distance: number) => POINT_DISTANCES.reduce((best, d, i) => Math.abs(d-distance) < Math.abs(POINT_DISTANCES[best]-distance) ? i : best, 0);
export function effectiveSpeed(value: PointControls, index: number): PointSpeed {
    return value.universal || value.profiles[index].useDefaults ? value.defaults! : value.profiles[index].speed!;
}
export function upgradePointControls(value: PointControls, target: 3 | 4 | 5 = 5): PointControls {
    if (target>=4) {
        const next=upgradePointControls(value,3);
        return {...next,version:target,profiles:next.profiles.map((p,i)=>({...p,action:p.action??i,invertHorizontal:p.invertHorizontal??false,invertVertical:p.invertVertical??false}))};
    }
    if (value.version !== 1) return {...structuredClone(value),version:3};
    const defaults = {horizontal:36, vertical:36, linked:true};
    return {version:3, defaults, universal:false, profiles:value.profiles.map(p => {
        const speed = nearestSpeed(p.distance);
        return {...p, speed:{horizontal:speed,vertical:speed,linked:true}, useDefaults:speed===36};
    })};
}
export function encodePointControls(value: PointControls): number[] {
    validatePointControls(value);
    const bytes = new Array(16).fill(0); let bit = 0;
    const put = (v: number, width: number) => { for(let i=0;i<width;i++,bit++) bytes[bit>>3] |= ((v>>i)&1) << (bit&7); };
    const speed = (s: PointSpeed) => { put(s.horizontal,6); put(s.vertical,6); put(+s.linked,1); };
    speed(value.defaults!); put(+value.universal!,1);
    value.profiles.forEach(p => { speed(p.speed!); put(+p.useDefaults!,1); put(p.interval,8); put(p.reversal-1,6); });
    if(value.version>=4) {
        let options=0;value.profiles.forEach((p,i)=>options|=(p.action! | +p.invertHorizontal!<<3 | +p.invertVertical!<<4)<<(i*5));
        bytes.push(options&255,(options>>8)&255,(options>>16)&255);
    }
    return bytes;
}
export function decodePointControls(bytes: ArrayLike<number>, version: 2 | 3 | 4 | 5 = 3): PointControls {
    if(bytes.length < (version>=4?19:16))throw new Error('Incomplete pointing settings.');
    if(bytes[15]&0xC0 || version>=4 && bytes[18]&0xF0)throw new Error('Invalid reserved pointing bits.');
    let bit=0; const get=(width:number) => { let v=0;for(let i=0;i<width;i++,bit++)v|=((bytes[bit>>3]>>(bit&7))&1)<<i;return v; };
    const speed=():PointSpeed=>({horizontal:get(6),vertical:get(6),linked:!!get(1)});
    const defaults=speed(), universal=!!get(1);
    const profiles=Array.from({length:4},()=>{const s=speed(),useDefaults=!!get(1),interval=get(8),reversal=get(6)+1;return {distance:speedDistance(s.horizontal),speed:s,useDefaults,interval,reversal};});
    const value:PointControls={version,defaults,universal,profiles};
    if(version>=4){const options=bytes[16]|bytes[17]<<8|bytes[18]<<16;value.profiles.forEach((p,i)=>{p.action=(options>>(i*5))&7;p.invertHorizontal=!!(options&(1<<(i*5+3)));p.invertVertical=!!(options&(1<<(i*5+4)));});}
    validatePointControls(value);return value;
}
