import { useEffect, useRef, useState, useId } from 'react';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { useChanges } from '@/contexts/ChangesContext';
import { POINT_PRESETS, POINT_ACTIONS, POINT_ACTION_DEFAULTS, PROPORTIONAL_ACTION, describeActionDefaults, formatPace, formatTravel, actionStepCounts, pointAction, pointSlotName, type PointControls, type PointSpeed, POINT_DEFAULTS, effectiveSpeed, upgradePointControls, speedDistance, validatePointControls, supportsPointControls } from '@/constants/point-controls';
import { pointControlsService, type PointStatus } from '@/services/point-controls.service';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** How long a run of edits (a slider drag, typing a number) settles before it is written. */
export const POINT_WRITE_DELAY_MS = 300;

/**
 * Shared by the pointing sidebar and bottom bar; never emits motion on selection.
 * Edits follow the same save model as every other setting: each settled edit goes
 * into the keyboard state and the change queue, which writes it at once with Live
 * Updating on and waits for Apply with it off.
 */
export default function PointControlSettings({ compact }: { compact?: boolean }) {
    const { keyboard, setKeyboard, isConnected, connectionSessionId } = useKeyboard();
    const { queue } = useChanges();
    const [index, setIndex] = useState(-1);
    const [draft, setDraft] = useState<PointControls | null>(null);
    const [status, setStatus] = useState<PointStatus | null>(null);
    const [error, setError] = useState('');
    const [stopping, setStopping] = useState(false);
    const deadZoneId = useId();
    const session = useRef(connectionSessionId);
    session.current = connectionSessionId;
    const draftRef = useRef<PointControls | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const writeRef = useRef<() => void>(() => {});
    writeRef.current = () => {
        timer.current = null;
        const value = draftRef.current && structuredClone(draftRef.current);
        if (!value || !keyboard?.pointing_controls) return;
        if (JSON.stringify(value) === JSON.stringify(upgradePointControls(keyboard.pointing_controls))) { setError(''); return; }
        try { validatePointControls(value); } catch (e) { setError((e as Error).message); return; }
        setError('');
        setKeyboard(current => current ? {...current, pointing_controls: value} : current);
        if (isConnected) void queue('Pointing tools settings', () => pointControlsService.save(value), {type:'setting', writeKey:'pointing-controls'});
    };
    useEffect(() => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        const next = keyboard?.pointing_controls ? upgradePointControls(keyboard.pointing_controls) : null;
        draftRef.current = next;
        setDraft(next);
        setError('');
    }, [keyboard?.pointing_controls, connectionSessionId]);
    // Leaving the panel mid-edit still records the edit.
    useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); writeRef.current(); } }, []);
    useEffect(() => {
        setStatus(null);
        setStopping(false);
        if (!isConnected || !supportsPointControls(keyboard)) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            try { const next = await pointControlsService.status(); if (!cancelled) setStatus(next); }
            catch { if (!cancelled) setStatus(null); }
            if (!cancelled) timer = setTimeout(poll, 750);
        };
        void poll();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [isConnected, connectionSessionId, keyboard?.feature_flags2]);
    if (!draft || !keyboard?.pointing_controls) return null;
    const stop = async () => {
        const targetSession = session.current;
        setStopping(true); setError('');
        try { await pointControlsService.stop(); }
        catch (e) { if (session.current === targetSession) setError((e as Error).message); }
        finally { if (session.current === targetSession) setStopping(false); }
    };
    const needsUpdate = isConnected && keyboard.pointing_controls.version !== 5;
    const toolName = (i:number) => pointSlotName(draft,i);
    const current = index < 0 ? draft.defaults! : effectiveSpeed(draft,index);
    const inherited = index >= 0 && (draft.universal || draft.profiles[index].useDefaults);
    const change = (edit: (next:PointControls)=>void) => {
        const next=structuredClone(draftRef.current ?? draft);edit(next);
        draftRef.current=next;setDraft(next);
        if(timer.current)clearTimeout(timer.current);
        timer.current=setTimeout(()=>writeRef.current(),POINT_WRITE_DELAY_MS);
    };
    const setSpeed = (axis:'horizontal'|'vertical', value:number) => change(next=>{
        const speed=index<0?next.defaults!:next.profiles[index].speed!;
        speed[axis]=value;if(speed.linked)speed[axis==='horizontal'?'vertical':'horizontal']=value;
        if(index>=0)next.profiles[index].distance=speedDistance(speed.horizontal);
    });
    const differs = (i:number) => {
        const speed=effectiveSpeed(draft,i), p=draft.profiles[i];
        return speed.horizontal!==draft.defaults!.horizontal || speed.vertical!==draft.defaults!.vertical || speed.linked!==draft.defaults!.linked || p.interval!==0 || p.reversal!==POINT_DEFAULTS[i].reversal || p.action!==i || p.invertHorizontal || p.invertVertical;
    };
    const revert = (i:number) => change(next=>{
        next.profiles[i]={...POINT_DEFAULTS[i],action:i,invertHorizontal:false,invertVertical:false,interval:0,speed:{...next.defaults!},useDefaults:true};
    });
    const resetAll = () => change(next=>{next.universal=true;next.profiles=POINT_DEFAULTS.map((p,i)=>({...p,action:i,invertHorizontal:false,invertVertical:false,interval:0,speed:{...next.defaults!},useDefaults:true}));});
    const overrideCount=draft.profiles.filter((_,i)=>differs(i)).length;
    const slider = (axis:'horizontal'|'vertical') => <label className="flex flex-col gap-1 text-sm">
        <span className="flex justify-between gap-2"><span>{axis==='horizontal'?'Horizontal':'Vertical'} speed</span><output>{(64/speedDistance(current[axis])).toFixed(2)}×</output></span>
        <input className="w-full accent-primary disabled:opacity-40" type="range" min="0" max="63" step="1" aria-label={`${axis==='horizontal'?'Horizontal':'Vertical'} speed`} value={current[axis]} disabled={inherited||needsUpdate} onChange={e=>setSpeed(axis,Number(e.target.value))}/>
        <span className="flex justify-between text-xs text-muted-foreground"><span>Slower · fewer steps</span><span>Faster · more steps</span></span>
    </label>;
    const actionOf = (i:number) => draft.profiles[i].action ?? i;
    const proportional = (i:number) => actionOf(i)===PROPORTIONAL_ACTION;
    // With no limit set, the firmware paces each action by its own default (none for Volume).
    const pace = (i:number) => formatPace(actionOf(i));
    // The tool's default step and pace for its action, and the step its speed gives now.
    const toolDefaults = (i:number) => {
        const action=actionOf(i), speed=effectiveSpeed(draft,i);
        const position=POINT_ACTION_DEFAULTS[action]?.vertical ? speed.vertical : speed.horizontal;
        const multiplier=64/speedDistance(position);
        const now=action!==PROPORTIONAL_ACTION && position!==36 ? ` At ${multiplier.toFixed(2)}×: ${formatTravel(actionStepCounts(action,position))} a step.` : '';
        return <p key={i} className="text-xs text-muted-foreground" data-testid={`tool-defaults-${i+1}`}>{describeActionDefaults(action)}{now}</p>;
    };
    const rateControl = (i:number) => <div key={i} className="rounded border p-2 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.profiles[i].interval!==0} disabled={needsUpdate} onChange={e=>change(next=>{next.profiles[i].interval=e.target.checked?(POINT_ACTION_DEFAULTS[next.profiles[i].action ?? i]?.pace || 80):0;})}/>Limit {toolName(i)} {proportional(i)?'speed':'action rate'}</label>
        {draft.profiles[i].interval!==0 ? <label className="text-sm">{toolName(i)} maximum {proportional(i)?'wheel steps / second (per axis)':'actions / second'}<Input type="number" min={4} max={250} step={0.25} disabled={needsUpdate} value={Number((1000/draft.profiles[i].interval).toFixed(2))} onChange={e=>change(next=>{const n=Number(e.target.value);next.profiles[i].interval=n>0?Math.round(1000/n):-1;})}/></label> : <p className="text-xs text-muted-foreground">{pace(i)?`Default: ${pace(i)}.`:'Uncapped — USB and the application determine throughput.'}</p>}
    </div>;
    return <section className={`flex flex-col gap-3 rounded-lg border border-kb-gray-medium p-3 ${compact ? 'w-80' : ''}`} aria-label="Pointing tools tuning">
        <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Tool speeds</h3>
            {isConnected && <Button variant="secondary" size="sm" disabled={stopping} onClick={stop}>Stop tools</Button>}
        </div>
        {needsUpdate && <div role="status" className="rounded border border-kb-gray-medium p-2 text-sm">
            Update the firmware on both halves for these pointing tools, then reconnect. Existing bindings and tuning are kept.
        </div>}
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.universal} disabled={needsUpdate} onChange={e=>change(next=>{next.universal=e.target.checked;})}/>Use shared speeds for every tool</label>
        <p className="text-xs text-muted-foreground">Shared speeds are the default. Turn this off to customize individual tools. Turning it back on keeps overrides for later; Revert all clears them.</p>
        <nav className="flex flex-wrap gap-1" aria-label="Tool speed selection">
            <Button variant={index<0?'default':'secondary'} size="sm" onClick={()=>setIndex(-1)}>Shared defaults</Button>
            {POINT_PRESETS.map((_,i)=><Button key={i} size="sm" variant={index===i?'default':'secondary'} onClick={()=>setIndex(i)}>{toolName(i)}{differs(i)&&<AlertTriangle size={14} aria-label={`${toolName(i)} differs from defaults`}/>}</Button>)}
        </nav>
        {index>=0 && <>
            <label className="flex flex-col gap-1 text-sm">Tool {index+1} action
                <select aria-label={`Tool ${index+1} action`} className="rounded border bg-background p-2" disabled={needsUpdate} value={draft.profiles[index].action} onChange={e=>change(next=>{next.profiles[index].action=Number(e.target.value);})}>
                    {POINT_ACTIONS.map((action,i)=><option key={i} value={i}>{action.name}</option>)}
                </select>
            </label>
            <p className="text-xs text-muted-foreground">Bindings stay with this tool slot. Changing its action keeps its speeds and rate; keys update their labels to match.</p>
            <div className="flex flex-wrap gap-3 text-sm">
                <label><input type="checkbox" disabled={needsUpdate} checked={draft.profiles[index].invertHorizontal} onChange={e=>change(next=>{next.profiles[index].invertHorizontal=e.target.checked;})}/> Reverse horizontal direction</label>
                <label><input type="checkbox" disabled={needsUpdate} checked={draft.profiles[index].invertVertical} onChange={e=>change(next=>{next.profiles[index].invertVertical=e.target.checked;})}/> Reverse vertical direction</label>
            </div>
            {proportional(index) && <div className="rounded border p-2 flex flex-col gap-1">
                <div className="flex justify-between text-sm"><label htmlFor={deadZoneId}>Center dead zone</label><output aria-label="Dead zone value">{draft.profiles[index].reversal-1} counts</output></div>
                <input id={deadZoneId} className="w-full accent-primary disabled:opacity-40" type="range" min={0} max={63} step={1} disabled={needsUpdate} value={draft.profiles[index].reversal-1} onChange={e=>change(next=>{next.profiles[index].reversal=Number(e.target.value)+1;})}/>
                <p className="text-xs text-muted-foreground">A circular neutral area in 2D, projected onto the scrolling axis when locked. Zero removes the dead zone. Counts are normalized to 800 CPI.</p>
            </div>}
            <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.profiles[index].useDefaults} disabled={draft.universal||needsUpdate} onChange={e=>change(next=>{
                    const p=next.profiles[index];p.useDefaults=e.target.checked;
                    if(!p.useDefaults)p.speed={...next.defaults!};
                })}/>Use shared defaults for {toolName(index)}</label>
                <Button variant="ghost" size="sm" disabled={needsUpdate} onClick={()=>revert(index)} aria-label={`Revert ${toolName(index)} to defaults`}><RotateCcw size={14}/></Button>
            </div>
            <p className="text-xs text-muted-foreground">Default mapping: {pointAction(draft,index).description} Direction switches reverse this mapping.{inherited?' Following shared speeds.':''}</p>
        </>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={current.linked} disabled={inherited||needsUpdate} onChange={e=>change(next=>{
            const speed:PointSpeed=index<0?next.defaults!:next.profiles[index].speed!;speed.linked=e.target.checked;if(speed.linked)speed.vertical=speed.horizontal;
        })}/>Link horizontal and vertical speeds</label>
        {slider('horizontal')}{slider('vertical')}
        <p className="text-xs text-muted-foreground">Linking uses the horizontal value for both axes. {index>=0&&proportional(index)?'Speeds set scroll velocity per displacement: at 1×, 64 counts beyond the dead zone gives 20 wheel steps/second. Staying off-center keeps scrolling.':'Each action has its own default step; the speed multiplies it: twice the speed, half the ball travel per step.'} Your existing free-scroll / axis-lock policy stays in charge.</p>
        <section aria-label="Tool defaults" className="flex flex-col gap-1">
            <h4 className="font-semibold text-sm">Defaults for each action</h4>
            {index<0?POINT_PRESETS.map((_,i)=>toolDefaults(i)):toolDefaults(index)}
        </section>
        <section aria-label="Output rate limits" className="flex flex-col gap-2">
            <h4 className="font-semibold text-sm">Output rate limits</h4>
            <p className="text-xs text-muted-foreground">These optional limits cap each tool’s output. Discrete actions stop with motion; proportional scrolling continues while displaced and stops when centered or switched off. Limits discard excess output without a catch-up queue. With no limit set, each action keeps its own default pace; Volume and Proportional scroll have none.</p>
            {index<0?POINT_PRESETS.map((_,i)=>rateControl(i)):rateControl(index)}
            <Button size="sm" variant="secondary" disabled={needsUpdate} onClick={()=>change(next=>{next.profiles.forEach(p=>p.interval=0);})}>Remove all action rate limits</Button>
        </section>
        {index>=0 && !proportional(index) && <details><summary className="text-xs cursor-pointer">Reversal tolerance</summary>
            <label className="text-sm">Reversal tolerance<Input type="number" min={1} max={64} disabled={needsUpdate} value={draft.profiles[index].reversal} onChange={e=>change(next=>{next.profiles[index].reversal=Number(e.target.value);})}/></label>
        </details>}
        <div className="flex flex-wrap items-center gap-2"><Button variant="secondary" size="sm" disabled={needsUpdate} onClick={resetAll}><RotateCcw size={14}/>Revert all tools to defaults</Button><span className="text-xs text-muted-foreground">{overrideCount ? `${overrideCount} tools differ` : 'All tools match defaults'}</span></div>
        <p className="text-xs text-muted-foreground">Revert restores the original actions and directions while keeping shared speeds. Both pointers share these tools and speeds. Changes save like every other setting, on the USB-connected half and in layout exports. Stop active tools before changing them.</p>

        {status && <div className="text-xs text-muted-foreground" role="status">
            <p>Active tool: {status.left||status.right?pointSlotName(upgradePointControls(keyboard.pointing_controls),(status.left||status.right)-1):'None'}</p>
            <p>{status.locked ? `Axis lock: ${status.axes === 2 ? 'vertical' : 'horizontal'}` : 'Free scrolling'}{status.session ? ' · Task switcher open' : ''}</p>
            <p>{status.recognized} steps recognized · {status.admitted} actions admitted · {status.dropped} coalesced/dropped</p>
        </div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>;
}
