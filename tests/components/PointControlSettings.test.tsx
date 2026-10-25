import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { POINT_CONTROL_FLAG } from '@/constants/point-controls';
import { POINT_DEFAULTS, upgradePointControls } from '@/constants/point-controls';
import PointControlSettings from '@/layout/SecondarySidebar/Panels/PointControlSettings';
const state=vi.hoisted(()=>({keyboard:null as any,isConnected:true,connectionSessionId:1,setKeyboard:vi.fn(),queue:vi.fn(),save:vi.fn(),stop:vi.fn(),status:vi.fn()}));
vi.mock('@/contexts/KeyboardContext',()=>({useKeyboard:()=>state}));
vi.mock('@/contexts/ChangesContext',()=>({useChanges:()=>({queue:state.queue,isInstant:false,isSaving:false})}));
vi.mock('@/services/point-controls.service',()=>({pointControlsService:{save:state.save,stop:state.stop,status:state.status}}));
beforeEach(()=>{
    vi.clearAllMocks();seen=0;state.isConnected=true;
    const config=upgradePointControls({version:1,profiles:structuredClone(POINT_DEFAULTS)});
    config.universal=true;config.profiles.forEach(p=>{p.useDefaults=true;p.interval=0;});
    state.keyboard={feature_flags2:POINT_CONTROL_FLAG,pointing_controls:config};
    state.queue.mockResolvedValue(undefined);state.save.mockResolvedValue(undefined);state.stop.mockResolvedValue(undefined);
    state.status.mockResolvedValue({left:0,right:0,axes:3,locked:false,session:false,recognized:0,admitted:0,dropped:0});
});
afterEach(cleanup);
const slide=(label:string,value:number)=>fireEvent.change(screen.getByLabelText(label),{target:{value:String(value)}});
const check=(label:string)=>fireEvent.click(screen.getByLabelText(label));
// Edits settle on their own (no save button): wait for the next queued write.
let seen=0;
async function save(){await waitFor(()=>expect(state.queue.mock.calls.length).toBeGreaterThan(seen));seen=state.queue.mock.calls.length;return state.setKeyboard.mock.calls.at(-1)![0](state.keyboard).pointing_controls;}
describe('shared pointing speeds',()=>{
    it.each([false,true])('links axes and queues the complete configuration, compact=%s',async compact=>{
        render(<PointControlSettings compact={compact}/>);slide('Vertical speed',45);
        expect(screen.getByLabelText('Horizontal speed')).toHaveValue('45');
        const value=await save();expect(value.defaults).toEqual({horizontal:45,vertical:45,linked:true});expect(state.save).not.toHaveBeenCalled();
        await state.queue.mock.calls.at(-1)![1]();expect(state.save).toHaveBeenCalledWith(value);
    });
    it('supports independent shared axes inherited by every tool',async()=>{
        render(<PointControlSettings/>);check('Link horizontal and vertical speeds');slide('Vertical speed',54);
        fireEvent.click(screen.getByRole('button',{name:'Tool 2 · Arrows'}));expect(screen.getByLabelText('Vertical speed')).toHaveValue('54');expect(screen.getByLabelText('Horizontal speed')).toHaveValue('36');expect(screen.getByLabelText('Vertical speed')).toBeDisabled();
        const value=await save();expect(value.defaults.linked).toBe(false);
    });
    it('marks overrides, preserves drafts across tools and reverts to shared defaults',async()=>{
        render(<PointControlSettings/>);check('Use shared speeds for every tool');fireEvent.click(screen.getByRole('button',{name:'Tool 1 · Volume'}));check('Use shared defaults for Tool 1 · Volume');slide('Vertical speed',54);
        expect(screen.getByLabelText('Tool 1 · Volume differs from defaults')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button',{name:'Tool 4 · Tasks'}));fireEvent.click(screen.getByRole('button',{name:/^Tool 1 · Volume/}));expect(screen.getByLabelText('Vertical speed')).toHaveValue('54');
        fireEvent.click(screen.getByRole('button',{name:'Revert all tools to defaults'}));expect(screen.queryByLabelText('Tool 1 · Volume differs from defaults')).not.toBeInTheDocument();expect(screen.getByLabelText('Use shared speeds for every tool')).toBeChecked();
    });
    it('keeps dormant custom speeds when universal mode is temporarily enabled',()=>{
        render(<PointControlSettings/>);check('Use shared speeds for every tool');fireEvent.click(screen.getByRole('button',{name:'Tool 1 · Volume'}));check('Use shared defaults for Tool 1 · Volume');slide('Vertical speed',54);
        check('Use shared speeds for every tool');expect(screen.getByLabelText('Vertical speed')).toHaveValue('36');check('Use shared speeds for every tool');expect(screen.getByLabelText('Vertical speed')).toHaveValue('54');
    });
    it('requires firmware upgrade before saving v2 onto the original preview',()=>{
        state.keyboard.pointing_controls={version:1,profiles:structuredClone(POINT_DEFAULTS)};render(<PointControlSettings/>);
        expect(screen.getByText(/Update the firmware on both halves/)).toBeInTheDocument();expect(screen.getByLabelText('Horizontal speed')).toBeDisabled();expect(state.queue).not.toHaveBeenCalled();
    });
    it('shows the one active tool every pointer follows, with no side and no Finer / Coarser note',async()=>{
        state.status.mockResolvedValue({left:2,right:2,axes:1,locked:true,session:false,recognized:1,admitted:1,dropped:0});
        render(<PointControlSettings/>);
        expect(await screen.findByText('Active tool: Tool 2 · Arrows')).toBeInTheDocument();
        expect(screen.queryByText(/Left|Right|Temporary key adjustment/)).toBeNull();
    });
    it('rejects invalid advanced limits and stops controls immediately',async()=>{
        render(<PointControlSettings/>);fireEvent.click(screen.getByRole('button',{name:'Tool 1 · Volume'}));slide('Reversal tolerance',0);expect(await screen.findByRole('alert')).toHaveTextContent('Invalid');expect(state.queue).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Stop tools'}));await waitFor(()=>expect(state.stop).toHaveBeenCalledOnce());
    });
});

it('shows per-tool rate limits outside Advanced and removes them without changing sensitivity',async()=>{
    state.keyboard.pointing_controls.profiles[1].interval=80;
    render(<PointControlSettings/>);
    check('Limit Tool 1 · Volume action rate');
    slide('Tool 1 · Volume maximum actions / second',100);
    const value=await save();expect(value.profiles[0].interval).toBe(10);expect(value.defaults.horizontal).toBe(36);
    fireEvent.click(screen.getByRole('button',{name:'Remove all action rate limits'}));
    const unlimited=await save();expect(unlimited.profiles.every((p:any)=>p.interval===0)).toBe(true);
});

it('gives every action its firmware default rate when no limit is set; Volume stays uncapped',()=>{
    render(<PointControlSettings/>);
    // Volume, Arrows, Tabs, Tasks.
    expect(screen.getAllByText(/^Uncapped/)).toHaveLength(1);
    expect(screen.getByText('Default: about 15 a second.')).toBeInTheDocument();
    expect(screen.getAllByText('Default: about 7 a second.')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button',{name:'Tool 1 · Volume'}));
    // A selected tool shows only its own rate control, and it follows the action.
    expect(screen.getByText(/^Uncapped/)).toBeInTheDocument();
    const expected:[string,RegExp][]=[['1',/^Default: about 15 a second\.$/],['2',/^Default: about 7 a second\.$/],['3',/^Default: about 7 a second\.$/],['4',/^Default: about 10 a second\.$/],['5',/^Default: about 7 a second\.$/],['6',/^Default: about 7 a second\.$/],['7',/^Uncapped/],['0',/^Uncapped/]];
    for(const [action,text] of expected){
        fireEvent.change(screen.getByLabelText('Tool 1 action'),{target:{value:action}});
        expect(screen.getByText(text)).toBeInTheDocument();
        expect(screen.getAllByText(/^(Default: about|Uncapped)/)).toHaveLength(1);
    }
});

it('shows each tool its own default step and pace, following its action and speed',async()=>{
    render(<PointControlSettings/>);
    expect(screen.getByTestId('tool-defaults-1')).toHaveTextContent('Volume: default about 2 mm a step, no default limit.');
    expect(screen.getByTestId('tool-defaults-2')).toHaveTextContent('Arrows: default about 5 mm a step, about 15 a second.');
    expect(screen.getByTestId('tool-defaults-3')).toHaveTextContent('Tabs: default about 10 mm a step, about 7 a second.');
    expect(screen.getByTestId('tool-defaults-4')).toHaveTextContent('Tasks: default about 10 mm a step, about 7 a second.');
    // The shared speed multiplies every action's step: at 2.00x a step takes half the travel.
    slide('Horizontal speed',45);
    expect(screen.getByTestId('tool-defaults-2')).toHaveTextContent('Arrows: default about 5 mm a step, about 15 a second. At 2.00×: about 2.5 mm a step.');
    expect(screen.getByTestId('tool-defaults-1')).toHaveTextContent('At 2.00×: about 1 mm a step.');
    fireEvent.click(screen.getByRole('button',{name:/^Tool 2 · Arrows/}));
    fireEvent.change(screen.getByLabelText('Tool 2 action'),{target:{value:'4'}});
    expect(screen.getByTestId('tool-defaults-2')).toHaveTextContent('Zoom: default about 6 mm a step, about 10 a second. At 2.00×: about 3 mm a step.');
    fireEvent.change(screen.getByLabelText('Tool 2 action'),{target:{value:'5'}});
    expect(screen.getByTestId('tool-defaults-2')).toHaveTextContent('Undo / Redo: default about 8 mm a step, about 7 a second.');
    fireEvent.change(screen.getByLabelText('Tool 2 action'),{target:{value:'7'}});
    expect(screen.getByTestId('tool-defaults-2')).toHaveTextContent('Proportional scroll: continuous, no steps; the speed sets how fast it scrolls.');
    // Turning a limit on starts from the action's own default pace.
    fireEvent.change(screen.getByLabelText('Tool 2 action'),{target:{value:'1'}});
    check('Limit Tool 2 · Arrows action rate');
    expect(screen.getByLabelText('Tool 2 · Arrows maximum actions / second')).toHaveValue(15.38);
    const value=await save();expect(value.profiles[1]).toMatchObject({action:1,interval:65});
});

it.each([false,true])('configures a zoom slot and direction without changing its tuning, compact=%s',async compact=>{
    render(<PointControlSettings compact={compact}/>);
    fireEvent.click(screen.getByRole('button',{name:'Tool 1 · Volume'}));
    slide('Tool 1 action',4);check('Reverse vertical direction');
    expect(screen.getByText(/Ctrl.=.*zoom in/)).toBeInTheDocument();
    const value=await save();expect(value.version).toBe(5);expect(value.profiles[0]).toMatchObject({action:4,invertVertical:true,interval:0});
    expect(value.defaults).toEqual(state.keyboard.pointing_controls.defaults);
});

it.each([false,true])('exposes proportional dead zone, independent speeds and wheel speed cap, compact=%s',async compact=>{
    render(<PointControlSettings compact={compact}/>);
    fireEvent.click(screen.getByRole('button',{name:'Tool 1 · Volume'}));
    slide('Tool 1 action',7);
    expect(screen.getByText(/Staying off-center keeps scrolling/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Reversal tolerance')).not.toBeInTheDocument();
    slide('Center dead zone',0);
    check('Use shared speeds for every tool');check('Use shared defaults for Tool 1 · Proportional scroll');
    check('Link horizontal and vertical speeds');slide('Horizontal speed',45);
    check('Limit Tool 1 · Proportional scroll speed');
    slide('Tool 1 · Proportional scroll maximum wheel steps / second (per axis)',25);
    const value=await save();expect(value.profiles[0]).toMatchObject({action:7,reversal:1,interval:40,speed:{horizontal:45,vertical:36,linked:false}});
});

describe('save model: the same as every other setting',()=>{
    it('has no separate save button',()=>{
        render(<PointControlSettings/>);
        expect(screen.queryByRole('button',{name:/Save tuning|Queue tuning|Keep tuning/})).toBeNull();
    });
    it('turns a slider drag into one queued write once it settles',async()=>{
        render(<PointControlSettings/>);
        for(const v of [37,40,44,48])slide('Horizontal speed',v);
        expect(state.queue).not.toHaveBeenCalled();
        const value=await save();expect(value.defaults).toEqual({horizontal:48,vertical:48,linked:true});
        expect(state.queue).toHaveBeenCalledOnce();
        expect(state.queue.mock.calls[0][0]).toBe('Pointing tools settings');
        expect(state.queue.mock.calls[0][2]).toEqual({type:'setting',writeKey:'pointing-controls'});
    });
    it.each([
        ['tool action',()=>{fireEvent.click(screen.getByRole('button',{name:'Tool 2 · Arrows'}));slide('Tool 2 action',4);},(v:any)=>expect(v.profiles[1].action).toBe(4)],
        ['rate limit',()=>check('Limit Tool 3 · Tabs action rate'),(v:any)=>expect(v.profiles[2].interval).toBe(140)], // starts at Tabs' default pace
        ['reverse direction',()=>{fireEvent.click(screen.getByRole('button',{name:'Tool 1 · Volume'}));check('Reverse horizontal direction');},(v:any)=>expect(v.profiles[0].invertHorizontal).toBe(true)],
        ['dead zone',()=>{fireEvent.click(screen.getByRole('button',{name:'Tool 1 · Volume'}));slide('Tool 1 action',7);slide('Center dead zone',12);},(v:any)=>expect(v.profiles[0]).toMatchObject({action:7,reversal:13})],
    ])('queues a %s change with no extra step',async(_,act,verify)=>{
        render(<PointControlSettings/>);act();
        const value=await save();verify(value);
        await state.queue.mock.calls.at(-1)![1]();expect(state.save).toHaveBeenCalledWith(value);
    });
    it('keeps an edit when the panel closes before it settles',()=>{
        const {unmount}=render(<PointControlSettings/>);slide('Horizontal speed',50);
        unmount();
        expect(state.queue).toHaveBeenCalledOnce();
        expect(state.setKeyboard.mock.calls.at(-1)![0](state.keyboard).pointing_controls.defaults.horizontal).toBe(50);
    });
    it('keeps tuning in the layout without queueing a board write while disconnected',async()=>{
        state.isConnected=false;render(<PointControlSettings/>);slide('Horizontal speed',50);
        await waitFor(()=>expect(state.setKeyboard).toHaveBeenCalled());
        expect(state.setKeyboard.mock.calls.at(-1)![0](state.keyboard).pointing_controls.defaults.horizontal).toBe(50);
        expect(state.queue).not.toHaveBeenCalled();
    });
    it('writes nothing when an edit is undone before it settles',async()=>{
        render(<PointControlSettings/>);slide('Horizontal speed',50);slide('Horizontal speed',36);
        await new Promise(r=>setTimeout(r,450));
        expect(state.queue).not.toHaveBeenCalled();expect(state.setKeyboard).not.toHaveBeenCalled();
    });
});

describe('device gains: a temporary control until the UX study picks the design', () => {
    it('is absent on firmware without gains (version 5)', () => {
        render(<PointControlSettings/>);
        expect(screen.queryByTestId('temporary-device-gains')).toBeNull();
    });
    it('shows both gains on a version 6 board, marked temporary, and queues an edit like any setting', async () => {
        state.keyboard = {...state.keyboard, pointing_controls: upgradePointControls(state.keyboard.pointing_controls, 6)};
        render(<PointControlSettings/>);
        expect(screen.getByText('Device gains (temporary control)')).toBeTruthy();
        expect(screen.getByLabelText('Touchpad gain')).toHaveValue(2);
        expect(screen.getByLabelText('TrackPoint gain')).toHaveValue(2);
        fireEvent.change(screen.getByLabelText('Touchpad gain'), {target: {value: '3'}});
        const value = await save();
        expect(value.version).toBe(6);
        expect(value.gains).toEqual({touchpad: 48, trackpoint: 32});
        await state.queue.mock.calls.at(-1)![1]();
        expect(state.save).toHaveBeenCalledWith(value);
    });
    it('keeps a gain inside 1/16 to almost 16', async () => {
        state.keyboard = {...state.keyboard, pointing_controls: upgradePointControls(state.keyboard.pointing_controls, 6)};
        render(<PointControlSettings/>);
        fireEvent.change(screen.getByLabelText('TrackPoint gain'), {target: {value: '40'}});
        expect((await save()).gains.trackpoint).toBe(255);
    });
});
