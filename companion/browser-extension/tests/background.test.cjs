const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup(options = {}) {
  const event = () => ({listeners: [], addListener(fn) { this.listeners.push(fn); }});
  const events = {storage: event(), activated: event(), updated: event(), focus: event(), message: event(), startup: event(), installed: event(), click: event()};
  const session = {}, requests = [], badges = [];
  let stores = 0;
  const chrome = {
    storage: {
      local: {get: async () => ({token: options.noToken ? '' : 'secret-token'})},
      session: {get: async () => ({...session}), set: async change => {
        if (++stores > 3) throw new Error('Recursive storage event');
        Object.assign(session, change);
        for (const fn of events.storage.listeners) fn(change, 'session');
      }}, onChanged: events.storage
    },
    windows: {getLastFocused: async () => ({id: 5, focused: !options.unfocused, incognito: !!options.incognito}),
      get: async () => ({focused: !options.lostFocus}), onFocusChanged: events.focus},
    tabs: {query: async () => [{id: 9, url: options.otherTab ? undefined : 'https://cad.onshape.com/documents/private-model?w=secret'}],
      sendMessage: async () => ({focused: !options.pageBlurred}),
      get: async () => ({active: !options.inactiveTab, url: options.changedOrigin ? 'https://elsewhere.example' : 'https://cad.onshape.com/documents/private-model'}),
      onActivated: events.activated, onUpdated: events.updated},
    runtime: {id: 'a'.repeat(32), onMessage: events.message, onStartup: events.startup, onInstalled: events.installed, openOptionsPage: async () => {}},
    action: {onClicked: events.click, setBadgeText: async x => badges.push(x.text), setBadgeBackgroundColor: async () => {}}
  };
  const context = vm.createContext({chrome, navigator: {userAgent: options.edge ? 'Edg/150' : 'Chrome/150'},
    URL, AbortSignal, Date, crypto: {randomUUID: () => '00000000-0000-0000-0000-000000000001'},
    fetch: async (url, request) => { requests.push({url, ...request}); return {ok: !options.rejected, status: 403}; }});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8'), context);
  return {context, requests, badges, events, get stores() { return stores; }};
}

test('focused Onshape sends origin only and sequence writes do not loop', async () => {
  const s = setup(); await s.context.refresh();
  assert.equal(s.requests.length, 1); assert.equal(s.stores, 1);
  const payload = JSON.parse(s.requests[0].body);
  assert.equal(payload.origin, 'https://cad.onshape.com'); assert.equal(payload.focused, true);
  assert.equal(payload.browser, 'chrome.exe'); assert.equal(payload.sequence, 1);
  assert.equal(s.requests[0].headers.Authorization, 'Bearer secret-token');
  assert(!s.requests[0].body.includes('private-model')); assert(!s.requests[0].body.includes('secret'));
  assert.deepEqual(s.badges, ['ON']);
});
test('unfocused, incognito, other tab, and blurred canvas clear context', async () => {
  for (const flag of ['unfocused', 'incognito', 'otherTab', 'pageBlurred']) {
    const s = setup({[flag]: true}); await s.context.refresh();
    const payload = JSON.parse(s.requests[0].body);
    assert.equal(payload.origin, '', flag); assert.equal(payload.focused, false, flag);
  }
});
test('focus, tab and origin are rechecked after async probe', async () => {
  for (const flag of ['lostFocus', 'inactiveTab', 'changedOrigin']) {
    const s = setup({[flag]: true}); await s.context.refresh();
    assert.equal(JSON.parse(s.requests[0].body).focused, false, flag);
  }
});
test('no pairing token means no request', async () => {
  const s = setup({noToken: true}); await s.context.refresh(); assert.equal(s.requests.length, 0);
});
test('Edge identifies its native process; pairing rejection shows failure badge', async () => {
  const s = setup({edge: true, rejected: true}); await s.context.refresh();
  assert.equal(JSON.parse(s.requests[0].body).browser, 'msedge.exe'); assert.deepEqual(s.badges, ['!']);
});
test('successive requests increment sequence without sending browsing content', async () => {
  const s = setup(); await s.context.refresh(); await s.context.refresh();
  assert.deepEqual(s.requests.map(r => JSON.parse(r.body).sequence), [1, 2]);
});
