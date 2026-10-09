import os
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from env import KEYBARD_URL,BASE
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox','--disable-gpu'])
 page=b.new_page(viewport={'width':1200,'height':460});page.goto(KEYBARD_URL)
 raw=Path(str(root.parents[1]/'src/default-layouts/sval-default.svil')).read_text(encoding='utf-8')
 state=page.evaluate('''async ([raw,base])=>{const {fileService}=await import(base+'services/file.service.ts');const {DEFAULTS,PRESETS}=await import(base+'features/trainer/core.ts');const board=fileService.parseContent(raw);return {apiVersion:1,config:{...DEFAULTS,appearance:PRESETS.Light,highlightPressed:false,manualDefault:1},revision:1,layoutRevision:1,board:{...board,trainerLabels:{}},selectedDevice:'manual-example',status:'Example',devices:[],active:0,default:1,valid:true,pressed:[],practiceHidden:[],practiceTarget:null,matrixAvailable:true,visible:true,arrange:true,session:'manual-example'};}''',[raw,BASE])
 page.add_init_script('window.__keybardNativeState = true;')
 def route(r):r.fulfill(json={'apiVersion':1,'token':'manual'} if '/bootstrap' in r.request.url else state)
 page.route('**/api/host/**',route)
 page.goto(KEYBARD_URL+'?hostOverlay=1');page.wait_for_selector('svg[aria-label="Overlay keyboard preview"]');page.wait_for_timeout(150)
 page.screenshot(path=str(root/'assets/overlay-renderer.png'),omit_background=True)
 print('Actual shared native renderer captured with bundled example, simulated host state; no real board used')
 b.close()
