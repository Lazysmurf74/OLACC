const defaults = {
  autoClean: true,
  clearCookies: true, clearCache: false,
  clearLocalStorage: false, clearHistory: false,
  mode: "whitelist",
  siteList: [],
  cookieBannerExceptions: [],
  protectedLogins: ["google.com","youtube.com","gmail.com","openai.com"]
};

async function load() {
  const s = await chrome.storage.sync.get(defaults);
  document.getElementById("mode").value                    = s.mode;
  document.getElementById("clearCookies").checked         = s.clearCookies;
  document.getElementById("clearCache").checked           = s.clearCache;
  document.getElementById("clearLocalStorage").checked    = s.clearLocalStorage;
  document.getElementById("clearHistory").checked         = s.clearHistory;
  document.getElementById("siteList").value               = s.siteList.join("\n");
  document.getElementById("protectedLogins").value        = s.protectedLogins.join("\n");
  document.getElementById("cookieBannerExceptions").value = s.cookieBannerExceptions.join("\n");
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  const lines = id => document.getElementById(id).value.split("\n").map(v=>v.trim()).filter(Boolean);
  await chrome.storage.sync.set({
    mode:                   document.getElementById("mode").value,
    clearCookies:           document.getElementById("clearCookies").checked,
    clearCache:             document.getElementById("clearCache").checked,
    clearLocalStorage:      document.getElementById("clearLocalStorage").checked,
    clearHistory:           document.getElementById("clearHistory").checked,
    siteList:               lines("siteList"),
    protectedLogins:        lines("protectedLogins"),
    cookieBannerExceptions: lines("cookieBannerExceptions")
  });
  const btn = document.getElementById("saveBtn");
  btn.textContent = "✓ Salvato!";
  setTimeout(() => { btn.textContent = "💾 Salva impostazioni"; }, 2000);
});

load();
