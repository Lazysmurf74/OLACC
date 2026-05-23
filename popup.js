document.addEventListener("DOMContentLoaded", async () => {

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  const hostname = new URL(tab.url).hostname;
  document.getElementById("currentSite").innerText = hostname;

  // --- AUTO CLEAN TOGGLE ---
  const settings = await chrome.storage.sync.get({
    autoClean: true,
    clearCookies: true,
    clearLocalStorage: false,
    clearCache: false
  });

  const autoCleanToggle = document.getElementById("autoClean");
  const autoCleanStatus = document.getElementById("autoCleanStatus");

  autoCleanToggle.checked = settings.autoClean;
  updateAutoCleanStatus(settings.autoClean);

  autoCleanToggle.addEventListener("change", async () => {
    const val = autoCleanToggle.checked;
    await chrome.storage.sync.set({ autoClean: val });
    updateAutoCleanStatus(val);
  });

  function updateAutoCleanStatus(active) {
    autoCleanStatus.textContent = active ? "ACTIVE" : "INACTIVE";
    autoCleanStatus.classList.toggle("inactive", !active);
  }

  // --- DATA BUTTONS ---
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

  // --- CLEAN BUTTON ---
  const cleanBtn = document.getElementById("cleanBtn");
  const cleanBtnText = document.getElementById("cleanBtnText");

  cleanBtn.addEventListener("click", async () => {
    cleanBtn.classList.add("loading");
    cleanBtnText.textContent = "Pulizia...";
    cleanBtn.disabled = true;

    chrome.runtime.sendMessage({ action: "clean", url: tab.url });

    setTimeout(async () => {
      cleanBtnText.textContent = "✓ Completata";
      cleanBtn.classList.remove("loading");
      cleanBtn.classList.add("done");

      await loadStats();

      setTimeout(() => {
        cleanBtnText.textContent = "Clean now";
        cleanBtn.classList.remove("done");
        cleanBtn.disabled = false;
      }, 2000);
    }, 1000);
  });

  // --- PROTECT SITE ---
  document.getElementById("addSiteBtn").addEventListener("click", async () => {
    chrome.runtime.sendMessage({ action: "addCurrentSite", domain: hostname });

    const btn = document.getElementById("addSiteBtn");
    btn.textContent = "✓ " + hostname + " protetto";
    btn.disabled = true;

    setTimeout(() => {
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2L3 4.5V8c0 2.8 2 5.2 5 6 3-0.8 5-3.2 5-6V4.5L8 2z"
            stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
        Protect site`;
      btn.disabled = false;
    }, 2500);
  });

  // --- STATISTICHE ---
  async function loadStats() {
    chrome.runtime.sendMessage({ action: "getStats" }, (stats) => {
      if (!stats) return;

      document.getElementById("statCleans").textContent =
        stats.totalCleans.toLocaleString();

      document.getElementById("statCookies").textContent =
        stats.totalCookiesRemoved.toLocaleString();

      document.getElementById("statSites").textContent =
        (stats.uniqueDomains || []).length.toLocaleString();

      if (stats.lastClean) {
        const date = new Date(stats.lastClean.timestamp);
        const formatted = date.toLocaleDateString("it-IT", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        });
        document.getElementById("statLast").textContent =
          "Ultimo: " + stats.lastClean.domain + " · " + formatted;
      }
    });
  }

  loadStats();

  // --- RESET STATS ---
  document.getElementById("resetStatsBtn").addEventListener("click", async () => {
    if (!confirm("Azzerare tutte le statistiche?")) return;
    chrome.runtime.sendMessage({ action: "resetStats" }, () => {
      loadStats();
    });
  });

});
