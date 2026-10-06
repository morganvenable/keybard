"""Shared, deterministic real-UI recorder. Requires Playwright and Pillow."""
import io,json,os,re
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
class Recorder:
 def __init__(self,browser,connected=False,landing=False):
  self.page=browser.new_page(viewport={'width':1440,'height':950},device_scale_factor=1)
  self.page.set_default_timeout(5000)
  self.page.add_init_script("""window.showSaveFilePicker=undefined;Object.defineProperty(navigator,'hid',{value:{getDevices:async()=>[],requestDevice:async()=>{throw Error('Physical HID blocked for recording')},addEventListener:()=>{},removeEventListener:()=>{}},configurable:true});""")
  self.page.goto(os.environ.get('KEYBARD_CAPTURE_URL','http://127.0.0.1:5188/'))
  self.connected=connected
  if connected:
   self.page.evaluate((ROOT/'tools/connected-fixture.js').read_text(),str(ROOT.parents[1]/'tests/fixtures/pointing-menu.fixture.ts'))
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
 def fill(self,loc,value):
  self.click(loc);loc.fill('');loc.press_sequentially(value,delay=45);self.frame(550);loc.press('Tab');self.frame(400)
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
  palette=self.frames[len(self.frames)//2].quantize(colors=192)
  frames=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in self.frames]
  frames[0].save(ROOT/f'assets/{name}.gif',save_all=True,append_images=frames[1:],duration=self.times,loop=0,optimize=True)
  entry={'clip':name,'verifiedResult':result,'frames':len(frames),'durationMs':sum(self.times),'physicalHID':False,'source':'Real Keybard UI with '+('controlled test-board responses' if self.connected else 'bundled offline layout')+'; orange pointer is a recording aid'}
  (ROOT/f'evidence/action-{name}.json').write_text(json.dumps(entry,indent=2)+'\n');self.page.close();return entry
