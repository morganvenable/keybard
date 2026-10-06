import os
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]; evidence={}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox','--disable-gpu'])
 for title,name in [('Macro Keys','macros'),('Tap Dance Keys','tap-dance'),('Combos','combos'),('Overrides','overrides'),('Leaders','leaders'),('Alt-Repeat','alt-repeat')]:
  page=b.new_page(viewport={'width':1440,'height':1000});page.goto(os.environ.get('KEYBARD_CAPTURE_URL','http://127.0.0.1:5188/'));page.get_by_role('button',name='QWERTY Example',exact=True).click();page.wait_for_timeout(400)
  page.get_by_role('button',name=title,exact=True).click();page.get_by_text('0',exact=True).first.click();page.wait_for_timeout(250)
  if name=='macros':
   page.get_by_role('button',name='Text',exact=True).click();page.wait_for_timeout(100)
   fields=page.locator('textarea');
   if fields.count():fields.first.fill('Hello from my Svalboard.');fields.first.blur()
  box=page.locator('[aria-label="Binding editor"]')
  evidence[name]={'text':box.inner_text(),'inputs':box.locator('input,textarea').evaluate_all('(es)=>es.map(e=>({type:e.type,placeholder:e.placeholder,aria:e.getAttribute("aria-label")}))')}
  box.screenshot(path=str(root/f'assets/{name}.png'))
  page.close()
 (root/'evidence/editor-ui.json').write_text(json.dumps(evidence,indent=2))
 print('Captured six focused actual editors')
 b.close()
