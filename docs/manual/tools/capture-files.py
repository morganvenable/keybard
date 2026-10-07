import os
from env import KEYBARD_URL
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox','--disable-gpu'])
 page=b.new_page(viewport={'width':1440,'height':1000});page.goto(KEYBARD_URL);page.get_by_role('button',name='QWERTY Example',exact=True).click();page.wait_for_timeout(400)
 page.get_by_role('button',name='Show Multiple Layers',exact=True).click();page.wait_for_timeout(300);page.screenshot(path=str(root/'assets/layers.png'))
 page.get_by_role('button',name='Export Layout',exact=True).click();page.wait_for_timeout(250);page.get_by_role('dialog').screenshot(path=str(root/'assets/export.png'));print('EXPORT',page.get_by_role('dialog').inner_text());page.keyboard.press('Escape')
 with page.expect_file_chooser() as fc:page.get_by_role('button',name='Import Layout',exact=True).click()
 fc.value.set_files(str(root.parents[1]/'src/default-layouts/sval-default.svil'));page.wait_for_timeout(350);page.get_by_role('dialog').screenshot(path=str(root/'assets/import.png'));print('IMPORT',page.get_by_role('dialog').inner_text())
 b.close()
