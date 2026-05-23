
const defaults = {
  autoClean: true,
  clearCookies: true,
  clearCache: false,
  clearLocalStorage: false,
  clearHistory: false,
  mode: "whitelist",
  siteList: [],
  protectedLogins: [
    "google.com",
    "youtube.com",
    "gmail.com",
    "openai.com"
  ]
};

async function load() {

  const settings =
    await chrome.storage.sync.get(defaults);

  document.getElementById("mode").value =
    settings.mode;

  document.getElementById("clearCookies").checked =
    settings.clearCookies;

  document.getElementById("clearCache").checked =
    settings.clearCache;

  document.getElementById("clearLocalStorage").checked =
    settings.clearLocalStorage;

  document.getElementById("clearHistory").checked =
    settings.clearHistory;

  document.getElementById("siteList").value =
    settings.siteList.join("\n");

  document.getElementById("protectedLogins").value =
    settings.protectedLogins.join("\n");
}

document.getElementById("saveBtn")
.addEventListener("click", async () => {

  await chrome.storage.sync.set({

    mode:
      document.getElementById("mode").value,

    clearCookies:
      document.getElementById("clearCookies").checked,

    clearCache:
      document.getElementById("clearCache").checked,

    clearLocalStorage:
      document.getElementById("clearLocalStorage").checked,

    clearHistory:
      document.getElementById("clearHistory").checked,

    siteList:
      document.getElementById("siteList")
      .value
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean),

    protectedLogins:
      document.getElementById("protectedLogins")
      .value
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean)

  });

  alert("Impostazioni salvate");

});

load();
