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
    vi.clearAllMocks();state.isConnected=true;
    const config=upgradePointControls({version:1,profiles:structuredClone(POINT_DEFAULTS)});
    config.universal=true;config.profiles.forEach(p=>{p.useDefaults=true;p.interval=0;});
    state.keyboard={feature_flags2:POINT_CONTROL_FLAG,pointing_controls:config};
    state.queue.mockResolvedValue(undefined);state.save.mockResolvedValue(undefined);state.stop.mockResolvedValue(undefined);
    state.status.mockResolvedValue({left:0,right:0,axes:3,locked:false,session:false,recognized:0,admitted:0,dropped:0});
});
afterEach(cleanup);
const slide=(label:string,value:number)=>fireEvent.change(screen.getByLabelText(label),{target:{value:String(value)}});
const check=(label:string)=>fireEvent.click(screen.getByLabelText(label));
async function save(){fireEvent.click(screen.getByRole('button',{name:'Queue tuning for Apply'}));await waitFor(()=>expect(state.queue).toHaveBeenCalled());return state.setKeyboard.mock.calls.at(-1)![0](state.keyboard).pointing_controls;}
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
        render(<PointControlSettings/>);fireEvent.click(screen.getByRole('button',{name:'Tool 1 · Volume'}));slide('Reversal tolerance',0);fireEvent.click(screen.getByRole('button',{name:'Queue tuning for Apply'}));expect(await screen.findByRole('alert')).toHaveTextContent('Invalid');expect(state.queue).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Stop tools'}));await waitFor(()=>expect(state.stop).toHaveBeenCalledOnce());
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
