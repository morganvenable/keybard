"""Capture production controls with a controlled in-browser test board fixture.

Run against Vite, not a production bundle. No USB chooser, real HID device,
physical board reads, or writes are used. Browser module replacements die with
this isolated page; production source is untouched.

KEYBARD_CAPTURE_URL and CHROMIUM_PATH may override defaults (see env.py).
Requires Python playwright plus an installed Chromium browser.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
from env import KEYBARD_URL as URL, BASE
CHROME = os.environ.get('CHROMIUM_PATH')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--disable-gpu'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    # Block all real HID access before the application loads.
    page.add_init_script("""Object.defineProperty(navigator, 'hid', {value: {
      getDevices: async () => [], requestDevice: async () => {throw new Error('Real HID disabled for documentation capture');},
      addEventListener: () => {}, removeEventListener: () => {}
    }, configurable:true});""")
    page.goto(URL)
    page.wait_for_timeout(600)
    page.evaluate((ROOT/'tools/connected-fixture.js').read_text(encoding='utf-8'), [(ROOT.parents[1]/'tests/fixtures/pointing-menu.fixture.ts').as_posix(), BASE])
    page.get_by_role('button', name='Connect Keyboard', exact=True).click()
    page.get_by_role('button', name='Switch to Manual Updates', exact=True).wait_for()
    page.get_by_role('button', name='Switch to Manual Updates', exact=True).click()
    if page.get_by_role('button', name='Collapse navigation', exact=True).count():
        page.get_by_role('button', name='Collapse navigation', exact=True).click()
    page.get_by_role('button', name='Settings', exact=True).click()
    page.get_by_text('QMK Settings...', exact=True).click()
    page.wait_for_timeout(350)
    # A real control interaction stages one setting; no Apply/write is invoked.
    fields = page.get_by_role('spinbutton')
    fields.first.fill('210')
    fields.first.press('Tab')
    page.wait_for_timeout(250)
    evidence = {'fixture':page.evaluate('window.documentationFixture'), 'screens':{}, 'pageErrors':errors}
    for name in ['qmk-settings']:
        page.screenshot(path=str(ROOT/f'assets/{name}.png'))
        evidence['screens'][name] = page.locator('body').inner_text()
    page.get_by_role('button', name='Standard Keys', exact=True).click()
    page.wait_for_timeout(200)
    page.screenshot(path=str(ROOT/'assets/connected-toolbar.png'))
    page.screenshot(path=str(ROOT/'assets/toolbar-detail.png'), clip={'x':590,'y':10,'width':680,'height':112})
    evidence['screens']['connected-toolbar'] = page.locator('body').inner_text()
    page.get_by_role('button', name='Pointing Devices', exact=True).click()
    page.wait_for_timeout(250)
    page.screenshot(path=str(ROOT/'assets/pointing-controls.png'))
    evidence['screens']['pointing-controls'] = page.locator('body').inner_text()
    (ROOT/'evidence/connected-screens.json').write_text(json.dumps(evidence, indent=2))
    assert not errors, errors
    assert 'Apply 1 Change' in evidence['screens']['connected-toolbar']
    assert 'DPI' in evidence['screens']['pointing-controls']
    browser.close()
    print('Captured three controlled connected-UI examples; no real HID access.')
