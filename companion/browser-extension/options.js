const tokenField = document.querySelector("#token");
const status = document.querySelector("#status");
chrome.storage.local.get("token").then(x => { tokenField.value = x.token || ""; });
document.querySelector("#save").addEventListener("click", async () => {
  const token = tokenField.value.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { status.textContent = "Paste the full pairing token from the companion."; return; }
  await chrome.storage.local.set({token});
  status.textContent = "Connecting…";
  try {
    const response = await fetch("http://127.0.0.1:19732/health", {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(2000)});
    if (!response.ok) throw new Error(response.status === 403 ? "Pairing token was rejected." : `Companion returned ${response.status}.`);
    const info = await response.json();
    if (info.protocol !== 1 || info.service !== "Keybard Context") throw new Error("Incompatible companion.");
    status.textContent = "Connected. Open or reload Onshape; keep its tab and browser window in focus.";
  } catch (error) { status.textContent = `Saved, but could not connect. Start the companion and check its browser status. ${error.message}`; }
});
