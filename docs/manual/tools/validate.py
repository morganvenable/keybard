"""Browser acceptance checks for the standalone manual, with a JSON evidence report."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('MANUAL_URL','http://127.0.0.1:5190/')
BROWSER=os.environ.get('CHROMIUM_PATH')
checks=[]
def record(name,detail):checks.append({'check':name,'passed':True,'detail':detail})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--disable-gpu'])
 for width in [360,390,768,1280,1600]:
  page=b.new_page(viewport={'width':width,'height':900},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(URL);page.wait_for_timeout(250)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  assert page.locator('main>.chapter').count()==11
  ids=page.locator('[id]').evaluate_all('(es)=>es.map(e=>e.id)');assert len(ids)==len(set(ids))
  bad=page.locator('img[src$=".png"]').evaluate_all('(es)=>es.filter(e=>!e.hasAttribute("width")||!e.hasAttribute("height")).map(e=>e.src)');assert not bad,bad
  if width<761:page.locator('#menu-toggle').click()
  page.locator('#manual-search').fill('backup');assert page.locator('#search-results a').count()>0
  page.locator('#manual-search').fill('zzzznonexistent');assert 'No matching' in page.locator('#search-status').inner_text()
  page.locator('#manual-search').fill('');page.locator('.chapter-nav a[href="#layers"]').click();page.wait_for_timeout(150)
  assert not page.locator('.rail').evaluate('(e)=>e.classList.contains("open")')
  page.get_by_role('button',name='Activate Layer 1',exact=True).click();assert page.locator('.demo-key span').all_text_contents()==['1','B','—']
  page.get_by_role('button',name='Base only',exact=True).click();assert page.locator('.demo-key span').all_text_contents()==['A','B','C']
  page.locator('figure .figure-button').first.click();assert page.locator('#image-dialog').is_visible();assert page.locator('#full-image').get_attribute('href')
  page.keyboard.press('Escape');assert not page.locator('#image-dialog').is_visible();assert page.locator('figure .figure-button').first.evaluate('(e)=>document.activeElement===e')
  assert not errors,errors
  record('responsive/search/diagram/lightbox',{'viewport_width':width,'console_errors':errors})
  if width in [390,1280]:
   page.goto(URL);page.screenshot(path=str(ROOT/f'evidence/manual-{width}.png'))
  page.close()
 # Cold deep links must not drift while images load.
 for target in ['settings','files','trainer']:
  page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');page.goto(URL+'#'+target);page.wait_for_timeout(500)
  start=page.locator('#'+target).bounding_box()['y'];page.wait_for_timeout(700);end=page.locator('#'+target).bounding_box()['y']
  assert 50<=end<=130,(target,start,end)
  assert abs(end-start)<2,(target,start,end)
  record('stable mobile deep link',{'target':target,'start':start,'settled':end});page.close()
 page=b.new_page();page.goto(URL)
 links=page.locator('[src],a[href]').evaluate_all('(es)=>es.map(e=>e.getAttribute("src")||e.getAttribute("href"))')
 local=set(x.split('#')[0] for x in links if x and not x.startswith(('#','http:','https:','data:')))
 for asset in local:
  response=page.request.get(URL+asset);assert response.ok,(asset,response.status)
 record('local assets and links',len(local))
 page.locator('img').evaluate_all('(es)=>es.forEach(e=>e.loading="eager")');page.wait_for_function('Array.from(document.images).filter(i=>i.getAttribute("src")).every(i=>i.complete&&i.naturalWidth>0)')
 page.emulate_media(media='print');page.pdf(path=str(ROOT/'keybard-user-manual.pdf'),format='A4',print_background=True,prefer_css_page_size=True)
 record('print PDF','keybard-user-manual.pdf')
 page.close()
 page=b.new_page(java_script_enabled=False);page.goto(URL);assert page.locator('main>.chapter').count()==11;assert len(page.locator('main').inner_text().split())>4500;record('no-JavaScript reading','All eleven chapters remain available');page.close()
 b.close()
(ROOT/'evidence/validation.json').write_text(json.dumps({'checks':checks,'all_passed':True},indent=2)+'\n')
print(json.dumps(checks,indent=2))
