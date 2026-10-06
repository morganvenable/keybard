"""Assemble the standalone manual from reviewed content fragments (stdlib only)."""
from pathlib import Path
import re, struct, hashlib
ROOT=Path(__file__).resolve().parents[1]
raw='\n'.join((ROOT/'content'/name).read_text() for name in ('start.html','features.html'))
sections={m.group(1):m.group(0) for m in re.finditer(r'<section id="([^"]+)"[\s\S]*?</section>',raw)}
order=[('start','Choose your starting point'),('connect','Connect your board'),('first-edit','Your first edit'),('layers','Work with layers'),('behaviors','Build useful behaviors'),('pointing','Pointing & mouse keys'),('settings','Settings & diagnostics'),('files','Backups & reusable layouts'),('trainer','The desktop Trainer'),('returning','Return to your work'),('troubleshooting','Troubleshooting')]
nav=''.join(f'<a href="#{key}">{i:02} &nbsp; {title}</a>' for i,(key,title) in enumerate(order,1))
body=[]
for i,(key,title) in enumerate(order,1):
 s=sections[key].replace('<section ', '<section class="chapter" ',1)
 s=re.sub(r'(<h2[^>]*>)\d+\.\s*',r'\1',s)
 s=re.sub(r'<p class="eyebrow">.*?</p>','',s,count=1)
 s=s.replace('<h2',f'<span class="chapter-label">Chapter {i:02} / {title}</span>\n<h2',1)
 s=re.sub(r'(<table[\s\S]*?</table>)',r'<div class="table-wrap">\1</div>',s)
 if key=='layers':
  demo='''<div class="layer-demo" aria-labelledby="layer-demo-title"><h3 id="layer-demo-title">Transparent keeps the key underneath. Blank turns it off.</h3><p>Suppose a position types <strong>A</strong> on your base layer. You hold a key to activate another layer. What should that same position do while you hold it?</p><div class="fallthrough-examples"><article><h4>Keep typing A</h4><p>Set that position to <strong>Transparent</strong> on the upper layer.</p><div class="layer-stack"><div><small>Upper layer · active while held</small><strong>▽ Transparent</strong><span>Use the assignment underneath ↓</span></div><div><small>Base layer · underneath</small><strong>A</strong></div></div><p class="typed-result">Press this position → <strong>A</strong></p></article><article><h4>Make this position do nothing</h4><p>Set that position to <strong>Blank</strong> on the upper layer.</p><div class="layer-stack"><div><small>Upper layer · active while held</small><strong>Blank</strong><span>Stop here. Do not use the key underneath.</span></div><div class="blocked-base"><small>Base layer · blocked</small><strong>A</strong></div></div><p class="typed-result">Press this position → <strong>nothing</strong></p></article></div><p><strong>Release the layer key:</strong> you return to the base layer, so this position types A again in both cases. Blank disables it only while the upper layer applies.</p><p>If you assign a different key—such as <strong>1</strong>—on the upper layer, the position types 1 while that layer is active.</p></div>'''
  s=s.replace('</section>',demo+'</section>')
 body.append(s)
hero='''<header class="hero" id="top"><div class="eyebrow">Svalboard-QMK launch edition</div><h1>The Keybard<br>user manual.</h1><p class="hero-lead">Connect your board, make your first change, and learn every part of Keybard.</p><div class="hero-meta"><span>11 chapters</span><span>Illustrated walkthroughs</span><span>Browser editor + desktop Trainer</span></div><div class="hero-actions"><a class="button-link" href="#start">Start the walkthrough ↓</a><a class="button-link secondary" href="https://keybard.svalboard.com/" target="_blank" rel="noopener">Open Keybard ↗</a></div><div class="route-cards"><a class="route-card" href="#start"><small>New to Keybard</small><strong>Try it before you connect.</strong><span>Explore an example and learn how editing works.</span></a><a class="route-card" href="#files"><small>Bringing an existing layout</small><strong>Keep what you already know.</strong><span>Understand backups, migration and import limits.</span></a><a class="route-card" href="#returning"><small>Returning user</small><strong>Pick up where you left off.</strong><span>Reconnect, reopen a draft or reuse a saved layer.</span></a></div><figure class="hero-figure" id="demo-opening-drag" data-animation="assets/opening-drag.gif" data-poster="assets/opening-drag-still.png"><img src="assets/opening-drag-still.png" alt="Open Standard Keys and drag A directly onto Q to replace its binding"><figcaption><strong>Open the panel. Drag a letter. See the change.</strong> Open Standard Keys, drag A onto Q, and release. The key now shows A. Actual offline example; no keyboard writes.</figcaption></figure><p class="review-note">Written against launch Keybard <code>6d9bd1f</code>. Screenshots use the bundled example and may show fewer behavior slots than current firmware. Connected hardware exposes additional controls. All screenshots can be enlarged.</p></header>'''
html=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="The illustrated Keybard user manual: connection, layouts, macros, settings, backups and the native Trainer overlay."><title>Keybard — Launch user manual</title><link rel="icon" href="assets/keybard-logo.svg" type="image/svg+xml"><link rel="stylesheet" href="manual.css"></head><body>
<a class="skip" href="#start">Skip to the manual</a><div class="mobile-head"><a href="#top" aria-label="Keybard manual home"><img src="assets/keybard-logo.svg" alt="Keybard"></a><button id="menu-toggle" aria-controls="manual-navigation" aria-expanded="false">Contents & search</button></div>
<aside class="rail" id="manual-navigation" aria-label="Manual navigation"><a class="brand" href="#top"><img src="assets/keybard-logo.svg" alt="Keybard manual home"></a><div class="edition">The launch manual</div><label class="search-label" for="manual-search">Find a topic</label><input class="search-input" id="manual-search" type="search" placeholder="Try “macro” or “backup”" aria-controls="search-results"><p class="search-status" id="search-status" role="status"></p><ul class="search-results" id="search-results"></ul><nav class="chapter-nav" aria-label="Chapters">{nav}</nav><div class="rail-footer"><a href="keybard-user-manual.pdf">Download the PDF</a><br><button type="button" data-print>Print / Save as PDF</button><br><a href="https://keybard.svalboard.com/">Open Keybard ↗</a><br><a href="README.md">Sources & review record</a></div></aside>
<main class="page">{hero}{''.join(body)}<footer class="manual-footer"><strong>Keybard · Svalboard-QMK launch manual</strong><p>Browser state, files and the board are different places to keep your work. Check the editing target, make one change at a time, and keep an exported copy you have verified.</p><a href="#top">Back to the beginning ↑</a> · <a href="https://github.com/svalboard/keybard/issues">Report an issue</a></footer></main>
<dialog id="image-dialog" aria-labelledby="image-caption"><div class="lightbox-top"><p id="image-caption"></p><a id="full-image" target="_blank" rel="noopener">Open full-size image ↗</a><button id="close-image" type="button">Close image</button></div><img id="large-image" alt=""></dialog><script src="manual.js"></script></body></html>'''
def dimensions(match):
    tag=match.group(0)

    src=re.search(r'src="([^"]+)"',tag)
    if src and src.group(1).endswith('.png'):
        path=ROOT/src.group(1)
        if not path.exists():raise FileNotFoundError(path)
        w,h=struct.unpack('>II',path.read_bytes()[16:24])
        tag=re.sub(r' (?:width|height)="[^"]*"','',tag)
        tag=tag[:-1]+f' width="{w}" height="{h}" style="width:100%;max-width:{w}px;aspect-ratio:{w}/{h}">'
    return tag
html=re.sub(r'<img\b[^>]*>',dimensions,html)
# GIFs are the default HTML source, so autoplay does not depend on scripting.
for animation,poster in re.findall(r'data-animation="([^"]+)" data-poster="([^"]+)"',html):
    html=html.replace(f'src="{poster}"',f'src="{animation}"')
for asset in ['manual.js','manual.css']:
    version=hashlib.sha256((ROOT/asset).read_bytes()).hexdigest()[:12]
    html=html.replace(f'"{asset}"',f'"{asset}?v={version}"')
(ROOT/'index.html').write_text(html)
print('Built manual:',len(body),'chapters')
