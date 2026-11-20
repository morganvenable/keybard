"""Site rules: app rules for a website, so a rule can follow Onshape in Chrome rather than Chrome.

A site rule's app key is `site:<site>` (`site:onshape.com`): the board stores its hash as the
rule's app ID like any other, and the site itself as the rule's label (13 bytes), so the Host
reads the sites back from the board. A rule counts as a site rule only when its ID is the hash of
`site:` + its label, so a program rule whose label happens to look like a site never does.

The site matches its host name and every host under it: `onshape.com` matches `onshape.com`,
`cad.onshape.com` and `www.onshape.com`, never `notonshape.com`. Where several match, the most
specific (longest) wins. Keybard's src/services/app-rules.ts normalizes sites the same way.
"""
import hashlib
import re
import threading
import time

from .address_bar import BROWSERS, KEEP
from .foreground import app_id, app_key

SITE_PREFIX = 'site:'
LABEL_BYTES = 13
_SCHEME = re.compile(r'^[a-z][a-z0-9+.-]*://', re.I)


def normalize_site(text):
    """A site as typed ("https://www.Onshape.com/documents", "*.onshape.com:443") as the bare name
    it matches ("onshape.com"): no scheme, user, port, path, `www.`, `*.` or trailing dot; ASCII
    lowercased (an IDN stays as typed, punycode or not). '' when nothing is left."""
    text = (text or '').strip(' \t')
    if text[:len(SITE_PREFIX)].lower() == SITE_PREFIX: text = text[len(SITE_PREFIX):].strip(' \t')
    text = _SCHEME.sub('', text)
    text = re.split(r'[/?#\\]', text, maxsplit=1)[0].rsplit('@', 1)[-1]
    text = re.sub(r':\d*$', '', text)
    text = app_key(text)
    while text.startswith('*.'): text = text[2:]
    text = text.strip('.').lstrip('*')
    if text.startswith('www.') and text.count('.') > 1: text = text[4:]
    return text.strip('.')


def site_key(site):
    """The app key of a site rule: `site:onshape.com`."""
    site = normalize_site(site)
    return SITE_PREFIX + site if site else ''


def site_id(site):
    key = site_key(site)
    return app_id(key) if key else 0


def site_rules(rules):
    """[(site, app ID)] of the site rules among [(app ID, label)], in board order."""
    out = []
    for rule_id, label in rules:
        site = normalize_site(label)
        if site and rule_id and site_id(site) == rule_id and (site, rule_id) not in out: out.append((site, rule_id))
    return out


def host_matches(host, site):
    return bool(host and site) and (host == site or host.endswith('.' + site))


def match_site(host, sites):
    """The app ID of the most specific site rule that matches the host name, or None."""
    best = None
    for site, rule_id in sites:
        if host_matches(host, site) and (best is None or len(site) > len(best[0])): best = (site, rule_id)
    return best[1] if best else None


def choose_id(program, host, sites):
    """The app ID to send: the site rule's for a matching host, else the program's (0: none)."""
    if host and sites:
        found = match_site(host, sites)
        if found is not None: return found
    return app_id(program) if program else 0


PENDING = object()  # the address is being read: keep what the board has


class SiteWatcher:
    """Which host the browser in front shows, read off the caller's thread (TimedReader).

    host_for(window, program, title) returns the host name, None (not a browser, nothing read, or
    the read failed or took too long: the program applies) or PENDING (a read under `timeout`
    old is running). It reads again when another window or tab comes to the front (the title
    changes with the tab), and every `reread` seconds. Titles are kept only as a hash, hosts
    only per window, in memory; nothing is logged.
    """

    def __init__(self, reader_factory, notify=None, clock=time.monotonic, timeout=0.15, reread=5.0):
        self.clock, self.timeout, self.reread, self.notify = clock, timeout, reread, notify
        self.lock = threading.Lock()
        self.windows = {}   # window -> dict(title=hash, host=..., read_at=..., asked_at=..., token=...)
        self.serial = 0
        self.reader = reader_factory(self._done)

    @staticmethod
    def title_hash(title):
        return hashlib.blake2s((title or '').encode('utf-8', 'replace'), digest_size=8).digest()

    def _done(self, token, host):
        with self.lock:
            entry = next((e for e in self.windows.values() if e.get('token') == token), None)
            if entry is None: return
            entry['token'], entry['read_at'] = None, self.clock()
            if entry['asked_title'] != entry['title']: return  # another tab came up meanwhile: read again
            if host != KEEP:
                entry['host'], entry['host_title'] = host, entry['title']
            elif entry.get('host_title') != entry['title']:
                # KEEP is the person typing an address: the last host stands only for the tab it was read
                # on. Another tab (a new tab, a tab whose address bar has the keyboard) has no host yet,
                # so the program applies until its address is read: never the last tab's site rule.
                entry['host'], entry['host_title'] = None, entry['title']
            entry['known'] = True
        if self.notify: self.notify()

    def host_for(self, window, program, title):
        browser = app_key(program)
        if not window or browser not in BROWSERS: return None
        now = self.clock()
        title = self.title_hash(title)
        with self.lock:
            entry = self.windows.get(window)
            if entry is None:
                if len(self.windows) >= 32: self.windows.pop(next(iter(self.windows)))
                entry = self.windows[window] = dict(title=title, host=None, host_title=None, known=False, read_at=None, asked_at=None, asked_title=None, token=None)
            changed = entry['title'] != title
            if changed:
                entry['title'], entry['known'] = title, False
            due = not entry['known'] or now - entry['read_at'] >= self.reread
            if due and entry['token'] is None:
                self.serial += 1
                token = self.serial
                if self.reader.request(token, window, browser):
                    entry['token'], entry['asked_at'], entry['asked_title'] = token, now, title
            if entry['known']: return entry['host']
            if entry['token'] is not None and now - entry['asked_at'] <= self.timeout: return PENDING
            return None  # the read failed, timed out, or couldn't start: the program applies

    def forget(self, window):
        with self.lock: self.windows.pop(window, None)
        self.reader.forget(window)

    def close(self):
        self.reader.close()
