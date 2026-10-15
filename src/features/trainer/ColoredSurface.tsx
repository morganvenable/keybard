import { useEffect, useState, type CSSProperties } from 'react';
import { KeyFace } from '@/components/KeyFace';
import { UNIT_SIZE } from '@/constants/svalboard-layout';
import { THUMB_OFFSET_U } from '@/constants/keyboard-visuals';
import { getColorByName, headerClasses } from '@/utils/colors';
import type { SurfaceKey } from './OverlaySurface';
import { keyLayerColor, topLayer, type ColoredLook, type ColoredPreferences, type Preferences } from './core';

/**
 * The colored overlay: the layout drawn with the editor's own keys (KeyFace), filled with
 * layer colors, for showing the board on screen as a deliberate element (product videos).
 * The looks are offered for review; see COLORED_LOOKS in core.ts.
 */
interface Props {
    keys: SurfaceKey[];
    layerColors?: Record<string, string>;
    colorBy: ColoredPreferences['colorBy'];
    look: ColoredLook;
    /** 0-100, for the whole surface. */
    opacity: number;
    active: number;
    defaults: number;
    held: Set<number>;
    changed: Set<number>;
    effect: Preferences['effect'];
    duration: number;
    /** The changed-key highlight color from the Host's appearance. */
    changedColor: string;
    hidden: Set<number>;
    layoutId: string;
}

const U = UNIT_SIZE;
/** Room around the keys for the panel looks, in key units. */
const PANEL_PAD_U = 0.45;
/** The editor's 3D underlay: the key's layer color darkened, 4px below it. */
const UNDERLAY_OFFSET_PX = 4;
/** The tilted look: the board seen on a desk, leaning back. */
const TILT_DEG = 34;
const TILT_PERSPECTIVE_PX = 1800;
const TILT = `perspective(${TILT_PERSPECTIVE_PX}px) rotateX(${TILT_DEG}deg)`;

/** The editor's key position: thumbs' lower row moved down by its thumb offset (Keyboard.tsx getYPos). */
export function coloredPosition(k: Pick<SurfaceKey, 'x' | 'y'>) {
    return { x: k.x, y: k.y >= 6 ? k.y + THUMB_OFFSET_U : k.y };
}

function hexFor(color: string) {
    return getColorByName(color)?.hex ?? getColorByName('green')!.hex;
}

/** A darker shade of a layer color, as the editor's 3D underlay draws it. */
export function darkerHex(hex: string, by = 0.7) {
    return '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * by).toString(16).padStart(2, '0')).join('');
}

function useWindowSize() {
    const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
    useEffect(() => {
        const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    return size;
}

export function ColoredSurface({ keys, layerColors, colorBy, look, opacity, active, defaults, held, changed, effect, duration, changedColor, hidden, layoutId }: Props) {
    const view = useWindowSize();
    if (!keys.length) return null;
    const placed = keys.map(k => ({ ...k, ...coloredPosition(k) }));
    const panels = look !== 'flat';
    const pad = panels ? PANEL_PAD_U : 0.1;
    const minX = Math.min(...placed.map(k => k.x)) - pad, minY = Math.min(...placed.map(k => k.y)) - pad;
    const width = (Math.max(...placed.map(k => k.x + k.w)) + pad - minX) * U;
    const height = (Math.max(...placed.map(k => k.y + k.h)) + pad - minY) * U + (look === 'flat' ? 0 : UNDERLAY_OFFSET_PX);
    // The tilted look leans back: about cos(tilt) as tall, its far edge narrower and its near edge
    // magnified by the perspective, so it's fitted by its near edge.
    const tilt = TILT_DEG * Math.PI / 180;
    const nearEdge = TILT_PERSPECTIVE_PX / (TILT_PERSPECTIVE_PX - height / 2 * Math.sin(tilt));
    const projected = look === 'tilted' ? { width: width * nearEdge, height: height * Math.cos(tilt) * nearEdge } : { width, height };
    const scale = Math.min(view.width / projected.width, view.height / projected.height) * 0.98;
    const topColor = hexFor(keyLayerColor(layerColors, 'active', 0, active, defaults));
    const panelStyle: CSSProperties = {
        position: 'absolute', borderRadius: 18,
        background: `color-mix(in srgb, ${topColor} 30%, var(--kb-surface))`,
        boxShadow: '0 10px 28px rgb(0 0 0 / 0.28)',
    };
    const fade = effect === 'Short fade';
    return <div className="trainer-colored-surface" data-look={look} data-color-by={colorBy} data-top-layer={topLayer(active, defaults)}
        style={{ opacity: opacity / 100 }}>
        <div style={{ width: projected.width * scale, height: projected.height * scale, position: 'relative' }}>
            <div style={{
                position: 'absolute', width, height, left: '50%', top: '50%',
                transform: `translate(-50%, -50%) scale(${scale})${look === 'tilted' ? ' ' + TILT : ''}`,
                filter: look === 'raised' ? 'drop-shadow(0 6px 10px rgb(0 0 0 / 0.35))' : undefined,
            }}>
                {/* One board panel behind both halves, tinted with the top layer's color like the editor's 3D backdrop. */}
                {panels && look !== 'raised' && <div data-board-panel="true" aria-hidden="true" style={{ ...panelStyle, left: 0, top: 0, width, height }} />}
                {placed.map(k => {
                    const color = keyLayerColor(layerColors, colorBy, k.layer, active, defaults);
                    const left = (k.x - minX) * U, top = (k.y - minY) * U;
                    const isHidden = hidden.has(k.id);
                    const legend = k.legend;
                    const single = legend && [...legend.displayLabel].length === 1;
                    // Single characters follow the Host's Shift and Caps Lock; everything else is the editor's label.
                    const label = isHidden ? '' : single ? legend!.displayLabel : legend?.editorLabel ?? k.label;
                    return <div key={k.id} data-key-id={k.id} data-layer-color={color} data-held={held.has(k.id) || undefined}>
                        {look !== 'flat' && look !== 'panel' && <div aria-hidden="true" style={{
                            position: 'absolute', left, top: top + UNDERLAY_OFFSET_PX, width: k.w * U, height: k.h * U,
                            borderRadius: 6, background: darkerHex(hexFor(color)), opacity: 0.65,
                        }} />}
                        <KeyFace x={(k.x - minX)} y={(k.y - minY)} w={k.w} h={k.h} unitSize={U}
                            keycode={isHidden ? 'KC_NO' : legend?.keycode ?? ''} label={label}
                            keyContents={isHidden ? undefined : legend?.keyContents} internationalLayout={layoutId}
                            layerColor={color} headerClassName={headerClasses[color] || headerClasses.primary}
                            selected={held.has(k.id)} disableHover className="pointer-events-none" />
                        {changed.has(k.id) && effect !== 'Off' && <div aria-hidden="true" className={fade ? 'trainer-fade' : undefined} style={{
                            position: 'absolute', left, top, width: k.w * U, height: k.h * U, borderRadius: 6,
                            background: `color-mix(in srgb, ${changedColor} 55%, transparent)`, boxShadow: `0 0 0 2px ${changedColor}`,
                            animationDuration: `${duration}ms`, pointerEvents: 'none',
                        }} />}
                    </div>;
                })}
            </div>
        </div>
    </div>;
}
