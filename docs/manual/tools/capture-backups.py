"""Automatic backups, recorded through the real Settings > Backups controls.

Uses the controlled test board (connected-fixture.js): no physical HID access.
A fake clock gives the history reproducible dates. Two earlier snapshots are
seeded through the real backup service, as if the board had been connected and
edited on earlier days; everything after that is the application's own
behavior. The folder recording replaces the operating system's folder chooser
with an in-memory folder, so nothing is written to disk.
Run names individually or all.
"""
import json,os,re,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
from action_recorder import Recorder,ROOT
from env import BASE,FAILURES

FIRST='2026-09-20T09:15:00-07:00'   # first connection: "As loaded"
EDITED='2026-10-03T14:05:00-07:00'  # an earlier editing session
CONNECT='2026-10-06T18:40:00-07:00' # connect "yesterday"
TODAY='2026-10-07T10:30:00-07:00'

SEED="""async ([base, step]) => {
  const {getBackupService} = await import(base+'services/backup/backup.service.ts');
  const {serializeForBackup} = await import(base+'contexts/BackupContext.tsx');
  const {keyboardService} = await import(base+'services/keyboard.service.ts');
  const svc = getBackupService(); await svc.init();
  const kb = await keyboardService.load();
  // Match what Keybard reads on connect: the board's pointing values, and no
  // layer colors (the test board reports none).
  const {customValueService} = await import(base+'services/custom-value.service.ts');
  kb.custom_values = await customValueService.loadAllMenuValues(kb.menus);
  kb.layer_colors = [];
  const layer = kb.keymap[0];
  const at = (code) => layer.indexOf(code);
  // Earlier states of the same board: an older tapping term and Q position,
  // and before that two more keys swapped (KC_Q 0x14, KC_A 0x04, KC_W 0x1A, KC_E 0x08).
  kb.settings = {...kb.settings, 1: 180};
  layer[at(0x14)] = 0x04;
  if (step === 'first') { const w = at(0x1A), e = at(0x08); [layer[w], layer[e]] = [layer[e], layer[w]]; }
  await svc.saveSnapshot({boardKey: 'sval:0123456789ABCDEF', boardName: 'test board', svil: serializeForBackup(kb), kind: step === 'first' ? 'connected' : 'edited', pendingCount: 0});
}"""

def history(page):
 page.evaluate(SEED,[BASE,'first'])
 page.clock.set_system_time(EDITED);page.evaluate(SEED,[BASE,'edited'])
 page.clock.set_system_time(CONNECT)

def rows(r):return r.page.get_by_test_id('backup-row')
def open_backups(r):
 r.page.clock.set_system_time(TODAY)
 r.nav('Settings');r.click(r.page.get_by_role('button',name='Backups',exact=True))
 rows(r).first.wait_for()

def snapshot(r):
 r.page.clock.set_system_time(TODAY)
 r.nav('Standard Keys');target=r.page.locator('[data-keycode="KC_Q"]').first
 x,y=target.get_attribute('data-key-x'),target.get_attribute('data-key-y')
 r.drag(r.picker('a'),target)
 assert r.page.locator(f'[data-key-x="{x}"][data-key-y="{y}"]').get_attribute('data-keycode')=='KC_A'
 # Keybard saves an "Edited" snapshot about ten seconds after edits stop.
 r.page.clock.fast_forward(11000);r.page.wait_for_timeout(300)
 open_backups(r);r.frame(900)
 first=rows(r).first.inner_text()
 assert 'Today' in first and 'Edited' in first and '1 key' in first and 'Unsent (1)' in first,first
 assert rows(r).count()==4,rows(r).all_inner_texts()
 return {'result':'Staged one key in Manual mode; ten seconds later a new Edited backup listed "1 key" and Unsent (1) above the earlier history','rows':rows(r).all_inner_texts()}

def restore(r):
 open_backups(r);r.frame(700)
 button=r.page.get_by_role('button',name=re.compile(r'^Restore backup from Oct 3, 2026'))
 r.click(button)
 dialog=r.page.get_by_role('dialog');dialog.get_by_text('Review layout import').wait_for();r.frame(1600)
 review=dialog.inner_text()
 r.click(dialog.get_by_role('button',name='Stage import',exact=True));dialog.wait_for(state='hidden')
 apply=r.page.get_by_role('button',name=re.compile(r'^Apply \d+ Changes?'));apply.wait_for();r.frame(900)
 status=r.page.get_by_role('status').filter(has_text='Import staged').first;r.move(status);r.frame(1200)
 return {'result':'Restore opened the import review for the October 3 backup; Stage import queued its differences as pending changes without writing the board','review':review,'apply':apply.inner_text().strip(),'status':status.inner_text()}

FOLDER="""(() => {
  // In-memory stand-in for the folder the operating system chooser returns.
  const files = {}; window.documentationFolder = files;
  class MemoryFolder {
    constructor(path, name) { this.kind = 'directory'; this.path = path; this.name = name; }
    async getDirectoryHandle(n) { return new MemoryFolder(this.path + n + '/', n); }
    async getFileHandle(n) { const key = this.path + n; return {kind: 'file', name: n, createWritable: async () => { let text = ''; return {write: async (d) => { text += d; }, close: async () => { files[key] = text.length; }}; }}; }
    async removeEntry(n) { delete files[this.path + n]; }
    async queryPermission() { return 'granted'; }
    async requestPermission() { return 'granted'; }
  }
  window.showDirectoryPicker = async () => new MemoryFolder('', 'Keybard backups');
})();"""

def folder(r):
 open_backups(r);r.frame(700)
 r.click(r.page.get_by_role('button',name='Choose backup folder',exact=True))
 r.page.get_by_role('button',name='Stop using folder',exact=True).wait_for();r.page.wait_for_timeout(400);r.frame(1600)
 files=r.page.evaluate('window.documentationFolder')
 board='test board (sval-0123456789ABCDEF)/'
 for name in ['latest.svil','2026-09-20.svil','2026-10-03.svil','2026-10-06.svil']:assert board+name in files,files
 return {'result':'Chose a folder; Keybard wrote latest.svil and one file per day with backups into a folder named after the board','files':sorted(files)}

CASES={'backup-snapshot':(snapshot,''),'backup-restore':(restore,''),'backup-folder':(folder,FOLDER)}
if __name__=='__main__':
 failures=[]
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
  for name in sys.argv[1:] or CASES:
   fn,script=CASES[name];r=Recorder(b,connected=True,clock=FIRST,setup=history,init_script=script)
   try:
    r.frame(700);out=fn(r);entry=r.save(name,out['result'])
    entry.update({k:v for k,v in out.items() if k!='result'},clock='Fake browser clock; history seeded on 2026-09-20 and 2026-10-03 through the real backup service')
    (ROOT/f'evidence/action-{name}.json').write_text(json.dumps(entry,indent=2)+'\n');print('PASS',name,flush=True)
   except Exception as e:
    print('FAIL',name,str(e),flush=True);traceback.print_exc();r.page.screenshot(path=f'{FAILURES}/{name}-failure.png');failures.append(name);r.page.close()
  b.close()
 if failures:raise SystemExit('Failed: '+', '.join(failures))
