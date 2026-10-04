const endpoint = "http://127.0.0.1:19732/context";
const browser = /Edg\//.test(navigator.userAgent) ? "msedge.exe" : "chrome.exe";
let queued = false;
let busy = false;

async function observe() {
  const {token} = await chrome.storage.local.get("token");
  if (!token) return;
  let origin = "";
  let focused = false;
  const win = await chrome.windows.getLastFocused();
  if (win.focused && !win.incognito) {
    const [tab] = await chrome.tabs.query({active: true, windowId: win.id});
    if (tab?.url) {
      const url = new URL(tab.url);
      if (url.protocol === "https:" && (url.hostname === "onshape.com" || url.hostname.endsWith(".onshape.com"))) {
        try {
          const probe = await chrome.tabs.sendMessage(tab.id, {type: "probe-focus"});
          // Recheck after the async probe: a tab/window switch invalidates it.
          const currentWindow = await chrome.windows.get(win.id);
          const currentTab = await chrome.tabs.get(tab.id);
          const currentOrigin = currentTab.url ? new URL(currentTab.url).origin : "";
          focused = Boolean(probe?.focused && currentWindow.focused && currentTab.active && currentOrigin === url.origin);
          if (focused) origin = url.origin;
        } catch { /* Reload/new document without content script: fail closed. */ }
      }
    }
  }
  const saved = await chrome.storage.session.get(["senderSession", "sequence"]);
  const session = saved.senderSession || crypto.randomUUID();
  const sequence = (saved.sequence || 0) + 1;
  await chrome.storage.session.set({senderSession: session, sequence});
  const response = await fetch(endpoint, {
    method: "POST", headers: {"Authorization": `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({origin, focused, browser, session, sequence, sent_at: Date.now()}),
    signal: AbortSignal.timeout(1500)
  });
  if (!response.ok) throw new Error(`Companion returned ${response.status}`);
  await chrome.action.setBadgeText({text: focused ? "ON" : ""});
  await chrome.action.setBadgeBackgroundColor({color: "#46734d"});
}

// Serialize sends, coalesce events, and re-observe current state every time.
async function refresh() {
  queued = true;
  if (busy) return;
  busy = true;
  try {
    while (queued) {
      queued = false;
      try { await observe(); }
      catch { await chrome.action.setBadgeText({text: "!"}).catch(() => {}); }
    }
  } finally { busy = false; }
}
chrome.tabs.onActivated.addListener(refresh);
chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url || change.status === "complete") refresh(); });
chrome.windows.onFocusChanged.addListener(refresh);
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "refresh-context" && sender.tab && sender.id === chrome.runtime.id) refresh();
});
chrome.storage.onChanged.addListener((changes, area) => {
  // Updating our sender sequence must not recursively schedule another send.
  if (area === "local" && changes.token) refresh();
});
chrome.runtime.onStartup.addListener(refresh);
chrome.runtime.onInstalled.addListener(refresh);
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
