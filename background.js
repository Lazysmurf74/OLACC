const DEFAULT_SETTINGS = {
  autoClean: true,
  clearCookies: true,
  clearCache: false,
  clearLocalStorage: false,
  clearHistory: false,
  mode: "whitelist",
  protectedLogins: [
    "google.com",
    "youtube.com",
    "gmail.com",
    "openai.com"
  ],
  siteList: []
};

const DEFAULT_STATS = {
  totalCleans: 0,
  totalCookiesRemoved: 0,
  uniqueDomains: [],
  lastClean: null
};

async function getSettings() {
  return await chrome.storage.sync.get(DEFAULT_SETTINGS);
}

async function getStats() {
  const data = await chrome.storage.local.get({ stats: DEFAULT_STATS });
  return data.stats;
}

async function updateStats(domain, cookiesRemoved) {
  const stats = await getStats();
  stats.totalCleans += 1;
  stats.totalCookiesRemoved += cookiesRemoved;
  if (!stats.uniqueDomains.includes(domain)) {
    stats.uniqueDomains.push(domain);
  }
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
  const settings = await getSettings();
  if (matchesDomain(domain, settings.protectedLogins)) return false;
  const listed = matchesDomain(domain, settings.siteList);
  if (settings.mode === "whitelist") return !listed;
  return listed;
}

async function clearSiteData(tabUrl) {
  const settings = await getSettings();
  if (!tabUrl || !tabUrl.startsWith("http")) return;

  const url = new URL(tabUrl);
  const domain = url.hostname;

  if (!(await shouldClean(domain))) {
    console.log("Protetto:", domain);
    return;
  }

  let cookiesRemoved = 0;

  if (settings.clearCookies) {
    const cookies = await chrome.cookies.getAll({ domain });
    cookiesRemoved = cookies.length;
    for (const cookie of cookies) {
      const protocol = cookie.secure ? "https:" : "http:";
      const cookieUrl = protocol + "//" + cookie.domain.replace(/^\./, "") + cookie.path;
      try {
        await chrome.cookies.remove({ url: cookieUrl, name: cookie.name, storeId: cookie.storeId });
      } catch (e) { console.error(e); }
    }
  }

  const removalOptions = { origins: [url.origin] };
  const dataToRemove = {};
  if (settings.clearCache) dataToRemove.cache = true;
  if (settings.clearLocalStorage) {
    dataToRemove.localStorage = true;
    dataToRemove.indexedDB = true;
    dataToRemove.serviceWorkers = true;
  }
  if (Object.keys(dataToRemove).length > 0) {
    try { await chrome.browsingData.remove(removalOptions, dataToRemove); }
    catch (e) { console.error(e); }
  }

  if (settings.clearHistory) {
    try { await chrome.history.deleteUrl({ url: tabUrl }); }
    catch (e) { console.error(e); }
  }

  await updateStats(domain, cookiesRemoved);

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: "Site Cleaner Pro",
    message: "Pulizia completata: " + domain
  });
}

// listener messaggi — restituisce true SOLO per messaggi asincroni
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === "clean") {
    clearSiteData(message.url);
    return false;
  }

  if (message.action === "addCurrentSite") {
    getSettings().then(settings => {
      if (!settings.siteList.includes(message.domain)) {
        settings.siteList.push(message.domain);
        chrome.storage.sync.set({ siteList: settings.siteList });
      }
    });
    return false;
  }

  if (message.action === "getStats") {
    // risposta asincrona: bisogna restituire true
    getStats().then(stats => sendResponse(stats));
    return true;
  }

  if (message.action === "resetStats") {
    chrome.storage.local.set({ stats: DEFAULT_STATS })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;
  await chrome.storage.session.set({ ["tab_" + tabId]: tab.url });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const settings = await getSettings();
  if (!settings.autoClean) return;
  const data = await chrome.storage.session.get("tab_" + tabId);
  const url = data["tab_" + tabId];
  if (!url) return;
  await clearSiteData(url);
});
