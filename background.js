const DEFAULT_SETTINGS = {
  autoClean: true,
  clearCookies: true,
  clearCache: false,
  clearLocalStorage: false,
  clearHistory: false,
  mode: "whitelist",
  protectedLogins: ["google.com","youtube.com","gmail.com","openai.com"],
  siteList: []
};

const DEFAULT_STATS = {
  totalCleans: 0,
  totalCookiesRemoved: 0,
  uniqueDomains: [],
  lastClean: null
};

async function getSettings() {
  return chrome.storage.sync.get(DEFAULT_SETTINGS);
}

async function getStats() {
  const data = await chrome.storage.local.get({ stats: DEFAULT_STATS });
  return data.stats;
}

async function updateStats(domain, cookiesRemoved) {
  const stats = await getStats();
  stats.totalCleans++;
  stats.totalCookiesRemoved += cookiesRemoved;
  if (!stats.uniqueDomains.includes(domain)) stats.uniqueDomains.push(domain);
  stats.lastClean = { domain, timestamp: Date.now() };
  await chrome.storage.local.set({ stats });
}

function matchesDomain(domain, list) {
  return list.some(item => {
    item = item.trim();
    if (!item) return false;
    if (item.startsWith("*.")) {
      const base = item.replace("*.", "");
      return domain === base || domain.endsWith("." + base);
    }
    return domain === item || domain.endsWith("." + item);
  });
}

async function shouldClean(domain) {
  const s = await getSettings();
  if (matchesDomain(domain, s.protectedLogins)) return false;
  const listed = matchesDomain(domain, s.siteList);
  return s.mode === "whitelist" ? !listed : listed;
}

async function clearSiteData(tabUrl, fromTabClose = false) {
  const settings = await getSettings();
  if (!tabUrl || !tabUrl.startsWith("http")) return;

  const url    = new URL(tabUrl);
  const domain = url.hostname;

  if (!(await shouldClean(domain))) return;

  let removedCookies = 0;

  if (settings.clearCookies) {
    // Pulisce dominio corrente + domini padre
    const domainsToClean = new Set();
    domainsToClean.add(domain);
    const parts = domain.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      domainsToClean.add(parts.slice(i).join("."));
    }

    for (const d of domainsToClean) {
      const cookies = await chrome.cookies.getAll({ domain: d });
      removedCookies += cookies.length;
      for (const cookie of cookies) {
        const protocol  = cookie.secure ? "https:" : "http:";
        const cookieUrl = protocol + "//" + cookie.domain.replace(/^\./, "") + cookie.path;
        try { await chrome.cookies.remove({ url: cookieUrl, name: cookie.name, storeId: cookie.storeId }); }
        catch (e) { console.error(e); }
      }
    }
  }

  const dataToRemove = {};
  if (settings.clearCache)        dataToRemove.cache = true;
  if (settings.clearLocalStorage) {
    dataToRemove.localStorage   = true;
    dataToRemove.indexedDB      = true;
    dataToRemove.serviceWorkers = true;
  }
  if (Object.keys(dataToRemove).length > 0) {
    try { await chrome.browsingData.remove({ origins: [url.origin] }, dataToRemove); }
    catch (e) { console.error(e); }
  }

  if (settings.clearHistory) {
    try { await chrome.history.deleteUrl({ url: tabUrl }); }
    catch (e) { console.error(e); }
  }

  await updateStats(domain, removedCookies);
  await notifyClean(domain, fromTabClose);
}

async function notifyClean(domain, fromTabClose) {
  if (fromTabClose) {
    chrome.notifications.create("scp_autoclean", {
      type: "basic", iconUrl: "icons/icon48.png",
      title: "Site Cleaner Pro",
      message: "✓ Pulizia automatica · " + domain
    });
    setTimeout(() => chrome.notifications.clear("scp_autoclean"), 4000);
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url?.startsWith("http")) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (msg) => {
          document.getElementById("__scp_toast__")?.remove();
          const t = document.createElement("div");
          t.id = "__scp_toast__";
          t.textContent = msg;
          t.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:2147483647;" +
            "background:#1a1a24;color:#f0f0f5;border:1px solid rgba(108,99,255,.4);" +
            "border-left:3px solid #6c63ff;border-radius:10px;padding:11px 16px;" +
            "font:500 13px/1.4 -apple-system,sans-serif;box-shadow:0 4px 24px rgba(0,0,0,.4);" +
            "opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s;" +
            "pointer-events:none;max-width:320px";
          document.body.appendChild(t);
          requestAnimationFrame(() => requestAnimationFrame(() => {
            t.style.opacity = "1"; t.style.transform = "translateY(0)";
          }));
          setTimeout(() => {
            t.style.opacity = "0"; t.style.transform = "translateY(8px)";
            setTimeout(() => t.remove(), 220);
          }, 3000);
        },
        args: ["✓ Pulizia completata · " + domain]
      });
    }
  } catch (_) {}
}

// ── Listener ──────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.action === "clean") {
    clearSiteData(msg.url, false);
    return false;
  }

  if (msg.action === "addCurrentSite") {
    getSettings().then(s => {
      if (!s.siteList.includes(msg.domain)) {
        s.siteList.push(msg.domain);
        chrome.storage.sync.set({ siteList: s.siteList });
      }
    });
    return false;
  }

  if (msg.action === "getStats") {
    getStats().then(stats => sendResponse(stats));
    return true;
  }

  if (msg.action === "resetStats") {
    chrome.storage.local.set({ stats: DEFAULT_STATS })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
});

// ── Context menu ──────────────────────────────────────────────────────────────
chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: "openIncognito",
    title: "Invia pagina in finestra riservata",
    contexts: ["page"]
  });
});

// ── Context menu click ────────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openIncognito" && tab.url) {

    // Verifica che l'URL sia valido
    if (tab.url.startsWith("http") || tab.url.startsWith("file")) {
      chrome.windows.create({
        url: tab.url,
        incognito: true
      });

      chrome.tabs.remove(tab.id);
    }
  }
});

// ── Salvataggio URL tab ───────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;

  await chrome.storage.session.set({
    ["tab_" + tabId]: tab.url
  });
});

// ── Pulizia automatica ────────────────────────────────────────────────────────
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const settings = await getSettings();

  if (!settings.autoClean) return;

  const data = await chrome.storage.session.get("tab_" + tabId);
  const url = data["tab_" + tabId];

  if (!url) return;

  await clearSiteData(url, true);
});