"""Record real offline UI actions as GIFs; only the pointer is a recording aid."""
import io, json, os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('KEYBARD_CAPTURE_URL','http://127.0.0.1:5188/')
evidence=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
 def setup():
  global page,frames,durations,xy
  page=b.new_page(viewport={'width':1200,'height':850},device_scale_factor=1)
  page.add_init_script('window.showSaveFilePicker = undefined;')
  page.goto(URL);page.get_by_role('button',name='QWERTY Example',exact=True).click();page.wait_for_timeout(400)
  page.evaluate('''()=>{const p=document.createElement('div');p.id='recording-pointer';p.style.cssText='position:fixed;left:0;top:0;width:18px;height:18px;border:3px solid #e65b16;border-radius:50%;background:#ffffff90;pointer-events:none;z-index:99999;transform:translate(-50%,-50%)';document.body.append(p)}''')
  frames=[];durations=[];xy=(15,15)
 def frame(ms=140):
  frames.append(Image.open(io.BytesIO(page.screenshot())).convert('RGB'));durations.append(ms)
 def move(loc,steps=9):
  global xy
  box=loc.bounding_box();assert box
  end=(box['x']+box['width']/2,box['y']+box['height']/2);start=xy
  for i in range(1,steps+1):
   xy=(start[0]+(end[0]-start[0])*i/steps,start[1]+(end[1]-start[1])*i/steps)
   page.mouse.move(*xy);page.evaluate('([x,y])=>{let p=document.querySelector("#recording-pointer");p.style.left=x+"px";p.style.top=y+"px"}',xy);frame(80)
 def click(loc):
  move(loc);page.mouse.down();frame(180);page.mouse.up();page.wait_for_timeout(200);frame(800)
 def save(name,result):
  frame(1800)
  frames[-1].save(ROOT/f'assets/{name}-still.png')
  frames[0].save(ROOT/f'assets/{name}.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True)
  evidence.append({'clip':name,'verifiedResult':result,'frames':len(frames),'durationMs':sum(durations),'physicalHID':False,'exportMode':'Browser download fallback (native save picker unavailable)','source':'Real Keybard UI, bundled offline QWERTY example; pointer ring added for visibility'})
  page.close()
 setup();page.get_by_role('button',name='Standard Keys',exact=True).click();page.wait_for_timeout(300)
 source=page.locator('[data-picker-key="a"]:visible').first;target=page.locator('[data-keycode="KC_Q"]').first
 x,y=target.get_attribute('data-key-x'),target.get_attribute('data-key-y')
 frame(1000);move(source);page.mouse.down();frame(500);move(target,20);frame(500);page.mouse.up();page.wait_for_timeout(300)
 changed=page.locator(f'[data-key-x="{x}"][data-key-y="{y}"]');assert changed.get_attribute('data-keycode')=='KC_A'
 save('drag-key','Former Q position now reports KC_A and displays A')
 setup();frame(700);click(page.get_by_role('button',name='Macro Keys',exact=True));click(page.get_by_text('0',exact=True).first);click(page.get_by_role('button',name='Text',exact=True))
 field=page.locator('textarea').first;click(field)
 for chunk in ['Hello ', 'from my ', 'Svalboard.']:
  field.press_sequentially(chunk,delay=50);frame(450)
 field.blur();assert field.input_value()=='Hello from my Svalboard.'
 save('create-macro','Macro 0 Text action contains Hello from my Svalboard.; assignment to a key is a separate step')
 setup();frame(700);click(page.get_by_role('button',name='Export Layout',exact=True))
 print(page.get_by_role('dialog').inner_text(),flush=True)
 export=page.get_by_role('dialog').get_by_role('button',name='Export',exact=True)
 with page.expect_download() as download:click(export)
 d=download.value;assert d.suggested_filename.endswith('.svil');data=json.loads(Path(d.path()).read_text());assert data
 save('export-backup','Export downloaded a nonempty .svil JSON file')
 (ROOT/'evidence/actions.json').write_text(json.dumps(evidence,indent=2));b.close()
