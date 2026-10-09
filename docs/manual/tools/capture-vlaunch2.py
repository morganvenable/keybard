"""vLaunch2 UI recordings. Controlled test-board responses; physical HID blocked.

Run with the same Playwright/Pillow environment as capture-walkthroughs.py.
Only the default-layer clip applies a change, to an in-memory board response.
Storage flags and one-shot defaults are seeded before connection.
"""
import json, os, sys, traceback
from playwright.sync_api import sync_playwright
from action_recorder import Recorder, ROOT
from env import BASE, FAILURES


def setup(page, reset=False):
 page.evaluate("""async ([base, reset]) => {
  const {keyboardService: svc} = await import(base+'services/keyboard.service.ts');
  const {qmkService} = await import(base+'services/qmk.service.ts');
  const getSettings = qmkService.get;
  qmkService.get = async kb => {await getSettings(kb); kb.settings[5] = 5; kb.settings[6] = 5000;};
  const load = svc.load;
  svc.load = async () => {const kb = await load(); kb.feature_flags2 = 1; kb.storage_reset = reset;
   kb.settings[5] = 5; kb.settings[6] = 5000; return kb;};
  let defaultLayer = 0;
  window.documentationWrites = [];
  svc.getLayerStateMasks = async () => ({active: 0, default: 1 << defaultLayer});
  svc.setDefaultLayer = async layer => {defaultLayer = layer; window.documentationWrites.push({defaultLayer:layer});};
  svc.clearStorageReset = async () => {window.documentationWrites.push({clearStorageReset:true});};
 }""", [BASE, reset])


def layer_reorder(r):
 # Name a non-default layer so its movement remains visible after renumbering.
 r.click(r.button('1'))
 r.nav('Rename layer 1: Layer 1')
 r.fill(r.page.get_by_label('Rename layer 1',exact=True),'Symbols')
 source=r.page.locator('button[draggable]').filter(has_text='Symbols')
 r.move(source);r.frame(600)
 source.drag_to(r.page.locator('button[draggable]').filter(has_text='3').first)
 r.page.wait_for_timeout(300);r.frame(900)
 dialog=r.page.get_by_role('dialog');dialog.get_by_role('button',name='Move layer',exact=True).wait_for()
 review=dialog.inner_text();assert 'This changes the offline layout.' in review
 r.frame(2500);r.click(dialog.get_by_role('button',name='Move layer',exact=True));dialog.wait_for(state='hidden')
 label=r.page.get_by_role('button',name='Rename layer 5: Symbols',exact=True)
 label.wait_for();r.move(label);r.frame(1600)
 return {'result':'Renamed layer 1 to Symbols, dragged its tab to a later gap, reviewed the move, and verified Symbols is now layer 5 in the offline layout.','review':review}


def default_layer(r):
 r.page.get_by_role('button',name='0, default layer',exact=True).wait_for()
 tab=r.page.locator('button[draggable]').filter(has_text='1').first
 r.move(tab);r.page.mouse.click(*r.xy,button='right');r.frame(1500)
 r.click(r.page.get_by_role('menuitem',name='Make Default Layer',exact=True))
 apply=r.page.get_by_role('button',name='Apply 1 Change',exact=True);apply.wait_for()
 assert r.page.evaluate('window.documentationWrites')==[]
 r.move(apply);r.frame(1600);r.click(apply)
 badge=r.page.get_by_role('button',name='1, default layer',exact=True);badge.wait_for();r.move(badge);r.frame(1600)
 writes=r.page.evaluate('window.documentationWrites');assert writes==[{'defaultLayer':1}],writes
 return {'result':'Right-clicked layer 1, chose Make Default Layer, verified Manual mode staged one change, then applied to the in-memory test board and verified the home/default marker moved to layer 1. Persistence across a physical restart was not tested.','simulatedWrites':writes}


def storage_reset(r):
 # Connect from the welcome page so the reset notice itself is recorded.
 r.page.evaluate((ROOT/'tools/connected-fixture.js').read_text(),[(ROOT.parents[1]/'tests/fixtures/pointing-menu.fixture.ts').as_posix(),BASE])
 setup(r.page,reset=True);r.connected=True
 r.nav('Connect Keyboard')
 dialog=r.page.get_by_role('dialog');dialog.get_by_text("Your keyboard's settings were reset",exact=True).wait_for();r.frame(3000)
 r.click(dialog.get_by_role('button',name='OK',exact=True));dialog.wait_for(state='hidden')
 assert r.page.evaluate('window.documentationWrites')==[{'clearStorageReset':True}]
 r.nav('Switch to Manual Updates')
 with r.page.expect_file_chooser() as chooser:r.nav('Import Layout')
 saved = r.page.evaluate("""async base => {
  const {keyboardService} = await import(base+'services/keyboard.service.ts');
  const {serializeForBackup} = await import(base+'contexts/BackupContext.tsx');
  const kb = await keyboardService.load(); kb.layer_colors = []; kb.settings[1] = 180;
  return serializeForBackup(kb);
 }""", BASE)
 chooser.value.set_files({'name':'test-board-backup.svil','mimeType':'application/json','buffer':saved.encode()})
 dialog=r.page.get_by_role('dialog');dialog.get_by_text('Review layout import',exact=True).wait_for();r.frame(2200)
 assert dialog.get_by_role('button',name='Stage import',exact=True).count()
 return {'result':'A simulated reset flag opened the real reset notice; OK acknowledged it through a controlled service response. Opened a saved layout in Manual mode and stopped at import review, before staging or applying recovery.','review':dialog.inner_text(),'recoveryFile':'Exported controlled test-board layout with tapping term 180 ms, matching board capabilities','simulatedWrites':r.page.evaluate('window.documentationWrites')}


def oneshot(r):
 r.nav('Settings');r.nav('QMK Settings...');r.click(r.page.get_by_text('One Shot Keys',exact=True))
 taps=r.page.get_by_label('Tapping this number of times holds the key until tapped once again',exact=True)
 timeout=r.page.get_by_label('Time (in ms) before the one shot key is released',exact=True)
 assert taps.input_value()=='5';assert timeout.input_value()=='5000';r.frame(1600)
 r.fill(taps,'0',paste=True);r.fill(timeout,'0',paste=True)
 apply=r.page.get_by_role('button',name='Apply 2 Changes',exact=True);apply.wait_for();r.move(apply);r.frame(1400)
 assert r.page.evaluate('window.documentationWrites')==[]
 return {'result':'Changed one-shot tap-to-lock count from 5 to 0 and timeout from 5000 ms to 0, verified Apply 2 Changes, and left both changes staged without writing the test board.'}

CASES={'layer-reorder':(layer_reorder,False,False),'default-layer':(default_layer,True,False),'storage-reset':(storage_reset,False,True),'oneshot-settings-action':(oneshot,True,False)}
if __name__=='__main__':
 failures=[]
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
  for name in sys.argv[1:] or CASES:
   fn,connected,landing=CASES[name]
   r=Recorder(b,connected=connected,landing=landing,setup=setup if connected else None)
   try:
    r.frame(700);out=fn(r);entry=r.save(name,out.pop('result'));entry.update(out)
    (ROOT/f'evidence/action-{name}.json').write_text(json.dumps(entry,indent=2)+'\n');print('PASS',name,flush=True)
   except Exception as e:
    print('FAIL',name,str(e),flush=True);traceback.print_exc()
    r.page.screenshot(path=f'{FAILURES}/{name}-failure.png');failures.append(name);r.page.close()
  b.close()
 if failures:raise SystemExit('Failed: '+', '.join(failures))
