document.addEventListener("DOMContentLoaded", async () => {

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  const hostname = new URL(tab.url).hostname;

  document.getElementById("currentSite").innerText = hostname;

  // stato autoclean
  const settings = await chrome.storage.sync.get({
    autoClean: true,
    clearCookies: true,
    clearLocalStorage: false,
    clearCache: false
  });

  const autoCleanToggle = document.getElementById("autoClean");
  const autoCleanStatus = document.getElementById("autoCleanStatus");

  autoCleanToggle.checked = settings.autoClean;
  autoCleanStatus.textContent = settings.autoClean ? "ACTIVE" : "INACTIVE";
  if (!settings.autoClean) autoCleanStatus.classList.add("inactive");

  autoCleanToggle.addEventListener("change", async () => {
    const val = autoCleanToggle.checked;
    await chrome.storage.sync.set({ autoClean: val });
    autoCleanStatus.textContent = val ? "ACTIVE" : "INACTIVE";
    autoCleanStatus.classList.toggle("inactive", !val);
  });

  // bottoni dati con stato attivo
  const cookieBtn = document.getElementById("cookieBtn");
  const storageBtn = document.getElementById("storageBtn");
  const cacheBtn = document.getElementById("cacheBtn");

  if (settings.clearCookies) cookieBtn.classList.add("active");
  if (settings.clearLocalStorage) storageBtn.classList.add("active");
  if (settings.clearCache) cacheBtn.classList.add("active");

  const toggleDataBtn = async (btn, key) => {
    const current = (await chrome.storage.sync.get({ [key]: false }))[key];
    await chrome.storage.sync.set({ [key]: !current });
    btn.classList.toggle("active", !current);
  };

  cookieBtn.addEventListener("click", () => toggleDataBtn(cookieBtn, "clearCookies"));
  storageBtn.addEventListener("click", () => toggleDataBtn(storageBtn, "clearLocalStorage"));
  cacheBtn.addEventListener("click", () => toggleDataBtn(cacheBtn, "clearCache"));

  // pulizia manuale
  document.getElementById("cleanBtn")
    .addEventListener("click", async () => {
      chrome.runtime.sendMessage({ action: "clean", url: tab.url });
    });

  // aggiungi/proteggi sito
  document.getElementById("addSiteBtn")
    .addEventListener("click", async () => {
      chrome.runtime.sendMessage({ action: "addCurrentSite", domain: hostname });
      alert(hostname + " aggiunto alla lista");
    });

});
