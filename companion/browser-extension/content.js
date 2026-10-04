// Only Onshape pages run this script. No text, DOM contents or key events read.
function pageFocused() { return document.visibilityState === "visible" && document.hasFocus(); }
function pulse() { chrome.runtime.sendMessage({type: "refresh-context"}).catch(() => {}); }
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === "probe-focus") respond({focused: pageFocused()});
});
window.addEventListener("focus", pulse);
window.addEventListener("blur", pulse);
document.addEventListener("visibilitychange", pulse);
setInterval(() => { if (document.visibilityState === "visible") pulse(); }, 1000);
pulse();
