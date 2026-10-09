"""Shared, deterministic real-UI recorder. Requires Playwright and Pillow."""
import io,json,os,re
from env import KEYBARD_URL,BASE
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
class Recorder:
 def __init__(self,browser,connected=False,landing=False,clock=None,setup=None,init_script=''):
  # clock: optional fake start time (ISO string) so dated UI such as backups is reproducible.
  # setup(page): optional step after the fixture is installed and before Connect Keyboard.
  self.page=browser.new_page(viewport={'width':1440,'height':950},device_scale_factor=1,**({'timezone_id':'America/Los_Angeles','locale':'en-US'} if clock else {}))
  self.page.set_default_timeout(5000)
  if clock:self.page.clock.install(time=clock)
  self.page.add_init_script("""window.showSaveFilePicker=undefined;Object.defineProperty(navigator,'hid',{value:{getDevices:async()=>[],requestDevice:async()=>{throw Error('Physical HID blocked for recording')},addEventListener:()=>{},removeEventListener:()=>{}},configurable:true});"""+init_script)
  self.page.goto(KEYBARD_URL)
  self.connected=connected
  if connected:
   self.page.evaluate((ROOT/'tools/connected-fixture.js').read_text(encoding='utf-8'),[(ROOT.parents[1]/'tests/fixtures/pointing-menu.fixture.ts').as_posix(),BASE])
   if setup:setup(self.page)
   self.page.get_by_role('button',name='Connect Keyboard',exact=True).click()
   self.page.get_by_role('button',name='Switch to Manual Updates',exact=True).click()
  elif not landing:self.page.get_by_role('button',name='QWERTY Example',exact=True).click()
  self.page.wait_for_timeout(250)
  self.frames=[];self.times=[];self.xy=(25,25)
  self.page.evaluate("""()=>{let p=document.createElement('div');p.id='recording-pointer';p.style.cssText='position:fixed;left:25px;top:25px;width:18px;height:18px;border:3px solid #e65b16;border-radius:50%;background:#ffffff90;pointer-events:none;z-index:99999;transform:translate(-50%,-50%)';document.body.append(p)}""")
 def frame(self,ms=130):
  self.frames.append(Image.open(io.BytesIO(self.page.screenshot())).convert('RGB').resize((1200,792),Image.Resampling.LANCZOS));self.times.append(ms)
 def move(self,loc,n=5):
  loc.scroll_into_view_if_needed();box=loc.bounding_box();assert box
  start=self.xy;end=(box['x']+box['width']/2,box['y']+box['height']/2)
  for i in range(1,n+1):
   self.xy=(start[0]+(end[0]-start[0])*i/n,start[1]+(end[1]-start[1])*i/n)
   self.page.mouse.move(*self.xy);self.page.evaluate('([x,y])=>{let p=document.querySelector("#recording-pointer");p.style.left=x+"px";p.style.top=y+"px"}',self.xy);self.frame(100)
 def click(self,loc):
  self.move(loc);self.page.mouse.down();self.frame(160);self.page.mouse.up();self.page.wait_for_timeout(350);self.frame(650)
 def button(self,name):return self.page.get_by_role('button',name=name,exact=True).first
 def nav(self,name):self.click(self.button(name))
 def fill(self,loc,value,paste=False):
  # Select and type over the old value; clearing a number field first can leave a stray 0.
  # paste=True enters the value in one step. QMK Settings number fields lose focus after
  # the first keystroke (Keybard 8d01073), so typing 210 there leaves 2.
  self.click(loc);loc.press('ControlOrMeta+a')
  if paste:loc.fill(value)
  else:loc.press_sequentially(value,delay=45)
  self.frame(550)
  assert loc.input_value()==value,(loc.input_value(),value)
  loc.press('Tab');self.frame(400)
 def select(self,loc,value):
  self.move(loc);loc.select_option(value);self.frame(850)
 def drag(self,source,target):
  self.move(source);self.page.mouse.down();self.frame(400);self.move(target,12);self.frame(400);self.page.mouse.up();self.page.wait_for_timeout(220);self.frame(900)
 def picker(self,key):
  alias={'esc':'{escape}','backsp':'{backspace}'}.get(key,key)
  loc=self.page.locator('[data-picker-key='+json.dumps(alias)+']').first
  return loc if loc.count() else self.page.get_by_text(re.compile('^'+re.escape(key)+'$',re.I)).filter(visible=True).first
 def slots(self):return self.page.locator('[aria-label="Binding editor"] [class~="group/editorkey"] > .select-none')
 def assign(self,slot,key):self.click(self.slots().nth(slot));self.click(self.picker(key))
 def open_editor(self,panel):
  self.nav(panel);self.click(self.page.get_by_text('0',exact=True).filter(visible=True).first)
  on=self.page.locator('[aria-label="Binding editor"]').get_by_text('ON',exact=True).first
  if on.count():self.click(on)
 def save(self,name,result):
  self.frame(1600);self.frames[-1].save(ROOT/f'assets/{name}-still.png')
  # WebP supports full RGB: an indexed palette needlessly damages text and
  # colors that appear only after a menu or dialog opens.
  frames=self.frames
  frames[0].save(ROOT/f'assets/{name}.webp',save_all=True,append_images=frames[1:],duration=self.times,loop=0,lossless=True,quality=100,method=6)
  entry={'clip':name,'verifiedResult':result,'frames':len(frames),'durationMs':sum(self.times),'physicalHID':False,'source':'Real Keybard UI with '+('controlled test-board responses' if self.connected else 'bundled offline layout')+'; orange pointer is a recording aid'}
  (ROOT/f'evidence/action-{name}.json').write_text(json.dumps(entry,indent=2)+'\n');self.page.close();return entry
