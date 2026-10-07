import os
"""Capture the real production UI using its bundled offline QWERTY example."""
import json
from env import KEYBARD_URL
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
PANELS = [('Standard Keys','standard-keys'),('Layer Keys','layer-keys'),('Tap Dance Keys','tap-dance'),('Macro Keys','macros'),('Alt-Repeat','alt-repeat'),('Leaders','leaders'),('Combos','combos'),('Overrides','overrides'),('Layouts','layouts'),('Pointing Devices','pointing'),('Settings','settings'),('Trainer','trainer')]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox','--disable-gpu'])
 page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(KEYBARD_URL);page.wait_for_timeout(600)
 page.screenshot(path=str(ROOT/'assets/landing.png'))
 page.get_by_role('button',name='QWERTY Example',exact=True).click();page.wait_for_timeout(800)
 page.screenshot(path=str(ROOT/'assets/workspace.png'))
 evidence={}
 for title,name in PANELS:
  page.get_by_role('button',name=title,exact=True).click();page.wait_for_timeout(250)
  page.screenshot(path=str(ROOT/f'assets/{name}.png'))
  evidence[name]={'text':page.locator('body').inner_text(),'buttons':page.get_by_role('button').evaluate_all('(es)=>es.map(e=>({text:e.innerText,label:e.getAttribute("aria-label"),title:e.title}))')}
 page.get_by_role('tab',name='Practice',exact=True).click();page.wait_for_timeout(200);page.screenshot(path=str(ROOT/'assets/trainer-practice.png'))
 evidence['trainer-practice']={'text':page.locator('body').inner_text()}
 (ROOT/'evidence/screenshot-ui.json').write_text(json.dumps(evidence,indent=2))
 print('Captured',len(PANELS)+3,'actual offline product screens; JS errors:',errors)
 assert not errors,errors
 b.close()
