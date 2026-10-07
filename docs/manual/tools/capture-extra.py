"""Layer, library, diagnostics and supplementary worked examples."""
import os,sys,re,traceback,json
from pathlib import Path
from playwright.sync_api import sync_playwright
from action_recorder import Recorder,ROOT
from env import BASE,FAILURES

def pos(r,x='1',y='1.5'):return r.page.locator(f'[data-key-x="{x}"][data-key-y="{y}"]').first
def layer(r,n):r.click(r.page.get_by_role('button',name=str(n),exact=True).first)
def composed(r,index):return r.page.get_by_text('Mod, Mod-Tap, and One-Shot Mod',exact=True).locator('..').locator('.select-none').nth(index)
def modtap(r):
 r.nav('Standard Keys');r.click(pos(r));r.click(r.picker('a'));r.click(pos(r));r.nav('CTRL');r.click(composed(r,1));assert '_T(KC_A)' in pos(r).get_attribute('data-keycode');return 'Assigned A on tap / Control on hold using the modifier composer'
def oneshot(r):
 r.nav('Standard Keys');r.click(pos(r));r.nav('SHIFT');r.click(composed(r,2));assert 'OSM' in pos(r).get_attribute('data-keycode');return 'Assigned one-shot Shift to the former Q position'
def blank_transparent(r):
 layer(r,3);r.nav('Standard Keys');r.click(pos(r,'1','2.5'))
 choices=r.page.get_by_text('Blank and Transparent',exact=True).locator('..').locator('.select-none')
 r.click(choices.nth(1));assert pos(r,'1','2.5').get_attribute('data-keycode')=='KC_TRNS';r.frame(1400)
 r.click(pos(r,'1','2.5'));r.click(choices.nth(0));assert pos(r,'1','2.5').get_attribute('data-keycode')=='KC_NO';r.frame(1400)
 layer(r,0);assert pos(r,'1','2.5').get_attribute('data-keycode')=='KC_A';return 'Assigned Transparent, then Blank, on layer 3; returning to base confirms A is unchanged'
def navigation(r):
 layer(r,3);r.nav('Standard Keys')
 # Use the physical-key assignment feature for arrow keys, visibly selected destinations.
 for y,key in [('1.5','ArrowLeft'),('2.5','ArrowDown'),('3.5','ArrowRight')]:
  r.click(pos(r,'1',y));r.page.keyboard.press(key);r.frame(700)
 assert 'LEFT' in pos(r).get_attribute('data-keycode')
 layer(r,0);r.click(pos(r));r.nav('Layer Keys');r.click(r.page.locator('.select-none').filter(has_text=re.compile(r'^MO\s*3$')).first)
 assert 'MO(3)'==pos(r).get_attribute('data-keycode');return 'Created arrows on layer 3 with typing-to-assign, then assigned MO(3) on base; other positions stay transparent'
def layertap(r):
 r.nav('Standard Keys');r.click(pos(r));r.click(r.picker('a'));r.click(pos(r));r.nav('Layer Keys');r.nav('LT')
 r.click(r.page.locator('.select-none').filter(has_text=re.compile(r'LT3')).first)
 assert 'LT3(KC_A)'==pos(r).get_attribute('data-keycode');return 'Assigned A on tap and layer 3 on hold'
def swap(r):
 before1=pos(r).get_attribute('data-keycode');before2=pos(r,'1','2.5').get_attribute('data-keycode');r.drag(pos(r),pos(r,'1','2.5'))
 assert pos(r).get_attribute('data-keycode')==before2;assert pos(r,'1','2.5').get_attribute('data-keycode')==before1
 r.drag(pos(r),pos(r,'1','2.5'));assert pos(r).get_attribute('data-keycode')==before1;return 'Swapped Q and A by dragging existing layout keys, then dragged them back'
def library(r):
 r.nav('Actions for layer 0');r.click(r.page.get_by_role('menuitem',name='Save Layer...',exact=True));r.fill(r.page.get_by_label('Layer Name *',exact=True),'My base reference');r.nav('Save');r.page.wait_for_timeout(300);r.nav('Layouts');assert r.page.get_by_text('My base reference',exact=True).count();return 'Saved the base layer in this browser’s Layouts library'
def reuse(r):
 layer(r,3);r.nav('Layouts');source=r.page.get_by_role('button',name='Enlarge Layer 0 preview',exact=True).locator('../..')
 r.drag(source,r.page.get_by_role('button',name='Rename layer 3: Layer 3',exact=True));r.frame(1000)
 print('REUSE',r.page.get_by_role('dialog').inner_text(),flush=True)
 r.click(r.page.get_by_role('dialog').get_by_role('button',name='OK',exact=True).last);r.page.wait_for_timeout(300)
 assert pos(r).get_attribute('data-keycode')=='KC_Q';return 'Dragged a saved base-layer preview onto layer 3 and confirmed replacement'
def keycodes(r):return r.page.locator('[data-keycode]').evaluate_all('(es)=>es.map(e=>e.getAttribute("data-keycode"))')
def bundled(r,n,query,name):
 # Search the bundled layout groups, drag one layer onto the destination layer's name, confirm.
 layer(r,n);before=keycodes(r);r.nav('Layouts');r.fill(r.page.get_by_label('Search layouts',exact=True),query)
 source=r.page.get_by_role('button',name=f'Enlarge {name} preview',exact=True).locator('../..')
 r.drag(source,r.page.get_by_role('button',name=f'Rename layer {n}: Layer {n}',exact=True));r.frame(1000)
 dialog=r.page.get_by_role('dialog');text=dialog.inner_text();print('BUNDLED',text,flush=True)
 r.click(dialog.get_by_role('button',name='OK',exact=True).last);r.page.wait_for_timeout(300);r.frame(900)
 assert keycodes(r)!=before;return text
def alt_alphas(r):
 bundled(r,0,'Dvorak','Dvorak')
 assert pos(r).get_attribute('data-keycode')!='KC_Q';return 'Searched Layouts for Dvorak and dragged the bundled Dvorak layer onto layer 0; the former Q position changed'
def num_sym(r):
 bundled(r,1,'tenkey','Left-hand tenkey + right-hand nav')
 return 'Dragged the bundled left-hand tenkey + right-hand nav layer onto layer 1, replacing its numbers and symbols'
def familiar(r):
 r.nav('Trainer');r.click(r.page.get_by_role('tab',name='Practice',exact=True));select=r.page.get_by_label('Familiar binding',exact=True);value=select.locator('option').nth(1).get_attribute('value');r.select(select,value);r.nav('Mark familiar');r.click(r.page.get_by_label('Hide familiar legends',exact=True));assert r.page.get_by_label('Hide familiar legends',exact=True).get_attribute('aria-checked')=='true';return 'Marked one binding familiar and hid its preview legend'
def trainer_layers(r):
 r.nav('Trainer');r.select(r.page.locator('select').nth(2),'1');r.frame(1200);r.select(r.page.locator('select').nth(2),'2');r.frame(1200);r.select(r.page.locator('select').nth(2),'0');return 'Previewed symbols and function layers, then returned to base; appearance preview only'
def fragments(r):
 r.nav('Settings');r.click(r.page.get_by_text('Fragments',exact=True));control=r.page.get_by_role('combobox').first;before=control.inner_text();r.click(control)
 choice=r.page.get_by_role('option').filter(has_not_text=before).first;after=choice.inner_text();r.click(choice);assert control.inner_text()==after;r.frame(1200)
 r.click(control);r.click(r.page.get_by_role('option',name=before,exact=True));assert control.inner_text()==before
 return 'Changed the offline example’s first finger fragment and restored its original selection; no hardware change'
def manual_apply(r):
 r.page.evaluate("""async(base)=>{const {qmkService}=await import(base+'services/qmk.service.ts');const {keyboardService}=await import(base+'services/keyboard.service.ts');window.documentationWrites=[];qmkService.push=async(kb,id)=>window.documentationWrites.push({id,value:kb.settings[id]});keyboardService.saveSvil=async()=>{};}""",BASE)
 r.nav('Settings');r.nav('QMK Settings...');r.fill(r.page.get_by_role('spinbutton').first,'210',paste=True);r.move(r.page.get_by_text('Pending (1)',exact=True));r.frame(1000);r.nav('Apply 1 Change');r.page.wait_for_timeout(350)
 assert r.page.evaluate('window.documentationWrites.length')==1;assert not r.page.get_by_text('Pending (1)',exact=True).count()
 return 'Staged and applied a QMK setting through the real queue with an explicitly simulated write endpoint; no physical device'
def printing(r):
 r.page.evaluate('window.print=()=>{window.documentationPrintRequested=true}')
 r.nav('Settings');r.nav('Print Layers...')
 dialog=r.page.get_by_role('dialog',name='Print Keyboard Layout',exact=True)
 dialog.wait_for();r.frame(1200);r.click(dialog.get_by_role('button',name='Print',exact=True))
 r.page.wait_for_function('window.documentationPrintRequested===true')
 preview=r.page.locator('.printable-keymap-wrapper');preview.wait_for(state='visible')
 assert preview.locator('.print-layer').count()>0
 r.page.emulate_media(media='print');preview.wait_for(state='visible');r.page.evaluate('scrollTo(0,0)');r.frame(2200)
 assert preview.locator('.print-layer').first.is_visible()
 assert preview.locator('.print-title').inner_text().strip()
 return 'Opened Print Layers review, clicked Print, and verified visible printable layers and title; native print dialog is outside web capture'
def matrix(r):
 r.page.evaluate("""async(base)=>{const {keyboardService}=await import(base+'services/keyboard.service.ts');window.documentationPressed=[];keyboardService.pollMatrix=async(kb)=>Array.from({length:kb.rows},(_,i)=>Array.from({length:kb.cols},(_,j)=>window.documentationPressed.some(([r,c])=>i===r&&j===c)));}""",BASE)
 r.nav('Matrix Tester')
 for keys in [[[0,0]],[[0,1]],[[0,2]],[]]:
  r.page.evaluate('(keys)=>window.documentationPressed=keys',keys);r.page.wait_for_timeout(160);r.frame(900)
 r.nav('Clear Matrix');return 'Actual Matrix Tester displays three simulated switch reports and clears their history; no hardware presses'
def macro_full(r):
 r.open_editor('Macro Keys');r.nav('Text');r.fill(r.page.locator('textarea').first,'hello');r.nav('Close binding editor')
 r.drag(r.page.locator('.select-none').filter(has_text=re.compile('^0$')).filter(visible=True).first,pos(r))
 assert pos(r).get_attribute('data-keycode') in ['M0','MACRO(0)','QK_MACRO_0','MACRO00'];return 'Created hello text macro and assigned Macro 0 to the former Q position'
CASES={'manual-apply':(manual_apply,True),'macro-full':(macro_full,False),'modtap-action':(modtap,False),'oneshot-action':(oneshot,False),'blank-transparent':(blank_transparent,False),'navigation-layer':(navigation,False),'layer-tap-action':(layertap,False),'swap-keys':(swap,False),'save-library':(library,False),'reuse-layer':(reuse,False),'alt-alphas-action':(alt_alphas,False),'num-sym-action':(num_sym,False),'trainer-familiar':(familiar,False),'trainer-layers':(trainer_layers,False),'fragments-action':(fragments,False),'print-action':(printing,False),'matrix-action':(matrix,True)}
if __name__=='__main__':
 failures=[]
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
  for name in sys.argv[1:] or CASES:
   fn,connected=CASES[name];r=Recorder(b,connected)
   try:r.frame(700);r.save(name,fn(r));print('PASS',name,flush=True)
   except Exception as e:
    print('FAIL',name,str(e),flush=True);traceback.print_exc();r.page.screenshot(path=f'{FAILURES}/{name}-failure.png');Path(f'{FAILURES}/{name}-failure.html').write_text(r.page.content(),encoding='utf-8');r.page.close();failures.append(name)
  b.close()
 if failures:raise SystemExit('Failed: '+', '.join(failures))
