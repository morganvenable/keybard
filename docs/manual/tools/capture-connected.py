"""Capture production controls with a controlled in-browser test board fixture.

Run against Vite, not a production bundle. No USB chooser, real HID device,
physical board reads, or writes are used. Browser module replacements die with
this isolated page; production source is untouched.

KEYBARD_CAPTURE_URL and CHROMIUM_PATH may override defaults.
Requires Python playwright plus an installed Chromium browser.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('KEYBARD_CAPTURE_URL', 'http://127.0.0.1:5188/keybard-ng/')
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
    page.evaluate("""async (fixturePath) => {
      const root = '/keybard-ng/';
      const {fileService} = await import(root+'services/file.service.ts');
      const {usbInstance} = await import(root+'services/usb.service.ts');
      const {keyboardService} = await import(root+'services/keyboard.service.ts');
      const {qmkService} = await import(root+'services/qmk.service.ts');
      const {customValueService} = await import(root+'services/custom-value.service.ts');
      const {keyService} = await import(root+'services/key.service.ts');
      const {svalService} = await import(root+'services/sval.service.ts');
      const {SVALBOARD_POINTING_MENU} = await import(root+'@fs'+fixturePath);
      const content = await (await fetch(root+'default-layouts/sval-default.svil')).text();
      const fixture = await fileService.loadFile(new File([content], 'controlled-example.svil'));
      fixture.name = 'test board'; fixture.svil_proto = 3;
      fixture.menus = SVALBOARD_POINTING_MENU;
      fixture.settings = Object.fromEntries(Array.from({length:29}, (_,i)=>[i+1,0]).filter(([i])=>i!==8));
      Object.assign(fixture.settings, {1:200,2:50,4:5000,7:200,19:80,20:5,25:200,28:300});
      fixture.custom_values = customValueService.extractAllItemsWithRefs(fixture.menus).map(({ref}) => ({...ref, data:[({id_left_dpi:3,id_right_dpi:3,id_automouse_timeout:3,id_automouse_threshold:100,id_automouse_decay:10,id_left_automouse:1,id_right_automouse:1})[ref.key] || 0]}));
      svalService.setupCosmeticLayerNames(fixture); keyService.generateAllKeycodes(fixture);
      usbInstance.open = async () => true;
      usbInstance.close = async () => {};
      usbInstance.getDeviceName = () => 'test board';
      usbInstance.getAllLayerColors = async () => [];
      usbInstance.send = usbInstance.sendSvil = async () => {throw new Error('Unmocked HID command blocked');};
      keyboardService.init = async () => {};
      keyboardService.load = async () => structuredClone(fixture);
      keyboardService.getActiveLayerIndex = async () => 0;
      qmkService.get = async (keyboard) => {keyboard.settings = {...fixture.settings};};
      customValueService.loadAllMenuValues = async () => structuredClone(fixture.custom_values);
      window.documentationFixture = {source:'bundled QWERTY + pointing-menu test fixture', realHID:false};
    }""", str(ROOT.parents[1]/'tests/fixtures/pointing-menu.fixture.ts'))
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
