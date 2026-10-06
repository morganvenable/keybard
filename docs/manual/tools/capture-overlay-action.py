"""Actual native shared renderer receiving controlled layer reports, not a desktop capture."""
import os,json,io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1200,'height':460});page.goto(os.environ.get('KEYBARD_CAPTURE_URL','http://127.0.0.1:5188/'))
 raw=(ROOT.parents[1]/'src/default-layouts/sval-default.svil').read_text()
 state=page.evaluate('''async raw=>{const {fileService}=await import('/keybard-ng/services/file.service.ts');const {DEFAULTS,PRESETS}=await import('/keybard-ng/features/trainer/core.ts');const board=fileService.parseContent(raw);return {apiVersion:1,config:{...DEFAULTS,appearance:PRESETS.Light,effect:'Short fade',duration:300,highlightPressed:true,manualDefault:1},revision:1,layoutRevision:1,board:{...board,trainerLabels:{}},selectedDevice:'manual-example',status:'Example',devices:[],active:0,default:1,valid:true,pressed:[],practiceHidden:[],practiceTarget:null,matrixAvailable:true,visible:true,arrange:true,session:'manual-example'};}''',raw)
 page.add_init_script('window.__keybardNativeState=true;setInterval(()=>dispatchEvent(new Event("keybard-host-heartbeat")),200)')
 page.route('**/api/host/**',lambda r:r.fulfill(json={'apiVersion':1,'token':'manual'} if '/bootstrap' in r.request.url else state))
 page.goto(os.environ.get('KEYBARD_CAPTURE_URL','http://127.0.0.1:5188/').rstrip('/')+'/?hostOverlay=1');page.wait_for_selector('svg[aria-label="Trainer keyboard preview"]')
 frames=[];texts=[]
 for active,pressed in [(0,[]),(2,[]),(4,[]),(0,[8,9,10]),(0,[])]:
  state.update(active=active,pressed=pressed);page.evaluate('(state)=>dispatchEvent(new CustomEvent("keybard-host-state",{detail:state}))',state)
  for _ in range(10):
   page.wait_for_timeout(100);frames.append(Image.open(io.BytesIO(page.screenshot())).convert('RGB'))
  texts.append(page.locator('svg[aria-label="Trainer keyboard preview"]').text_content())
 assert texts[0]!=texts[1] and texts[1]!=texts[2]
 frames[-1].save(ROOT/'assets/overlay-layers-still.png');palette=frames[0].quantize(colors=192);frames=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
 frames[0].save(ROOT/'assets/overlay-layers.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,optimize=True)
 (ROOT/'evidence/action-overlay-layers.json').write_text(json.dumps({'clip':'overlay-layers','physicalHID':False,'source':'Actual HostOverlay renderer with controlled layer and matrix reports; not a captured desktop or hardware test','verifiedResult':'Base, symbols and function reports produced distinct resolved legend sets; held-key report then cleared','frames':len(frames)},indent=2)+'\n');b.close()
