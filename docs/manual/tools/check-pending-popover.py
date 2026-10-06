"""Browser layout regression using the controlled connected-board fixture."""
import os,json
from playwright.sync_api import sync_playwright
from action_recorder import Recorder,ROOT
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
 for width in [1440,900]:
  r=Recorder(b,connected=True);page=r.page;page.set_viewport_size({'width':width,'height':950})
  page.get_by_role('button',name='Settings',exact=True).first.click();page.get_by_role('button',name='QMK Settings...',exact=True).click()
  field=page.get_by_role('spinbutton').first;field.fill('210');field.press('Tab');page.get_by_role('button',name='Close details panel',exact=True).click()
  trigger=page.get_by_role('button',name='Pending (1)',exact=True);trigger.scroll_into_view_if_needed()
  toolbar=trigger.locator('xpath=ancestor::div[contains(@class,"overflow-x-auto")][1]')
  metrics='e=>({width:e.clientWidth,height:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight})'
  before=toolbar.evaluate(metrics);trigger.click();review=page.get_by_role('dialog',name='Pending changes',exact=True);review.wait_for()
  assert review.get_by_role('listitem').all_text_contents()==['QMK setting 7']
  assert toolbar.evaluate(metrics)==before,(width,before,toolbar.evaluate(metrics))
  assert not toolbar.evaluate('(e)=>e.contains(document.querySelector("[role=dialog]"))')
  box=review.bounding_box();assert box and box['x']>=0 and box['x']+box['width']<=width and box['y']+box['height']<=950
  review.screenshot(path=str(ROOT/f'evidence/pending-popover-{width}.png'))
  page.keyboard.press('Escape');assert not review.count();assert trigger.evaluate('e=>e===document.activeElement')
  results.append({'width':width,'toolbarUnchanged':before,'content':['QMK setting 7'],'escapeRestoresFocus':True});page.close()
 b.close()
(ROOT/'evidence/pending-popover.json').write_text(json.dumps(results,indent=2)+'\n');print('PASS: correct pending edit, unchanged toolbar scroll dimensions, visible portal and Escape focus at both widths')
