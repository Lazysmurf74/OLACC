const DEFAULT_SETTINGS = {
  autoClean: true,
  clearCookies: true,
  clearCache: false,
  clearLocalStorage: false,
  clearHistory: false,
  blockCookieBanners: true,
  cookieBannerExceptions: [],
  mode: "whitelist",
  protectedLogins: ["google.com","youtube.com","gmail.com","openai.com"],
  siteList: []
};

const DEFAULT_STATS = {
  totalCleans: 0,
  totalCookiesRemoved: 0,
  uniqueDomains: [],
  lastClean: null   // { domain, timestamp }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Pulizia ───────────────────────────────────────────────────────────────────

async function clearSiteData(tabUrl) {
  const settings = await getSettings();
  if (!tabUrl || !tabUrl.startsWith("http")) return;

  const url    = new URL(tabUrl);
  const domain = url.hostname;

  if (!(await shouldClean(domain))) {
    console.log("[SCP] Protetto:", domain);
    return;
  }

  let removedCookies = 0;

  if (settings.clearCookies) {
    const cookies = await chrome.cookies.getAll({ domain });
    removedCookies = cookies.length;
    for (const cookie of cookies) {
      const protocol  = cookie.secure ? "https:" : "http:";
      const cookieUrl = protocol + "//" + cookie.domain.replace(/^\./, "") + cookie.path;
      try { await chrome.cookies.remove({ url: cookieUrl, name: cookie.name, storeId: cookie.storeId }); }
      catch (e) { console.error(e); }
    }
  }

  const dataToRemove = {};
  if (settings.clearCache)        dataToRemove.cache = true;
  if (settings.clearLocalStorage) {
    dataToRemove.localStorage  = true;
    dataToRemove.indexedDB     = true;
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

  chrome.notifications.create({
    type: "basic", iconUrl: "icons/icon48.png",
    title: "Site Cleaner Pro",
    message: "Pulizia completata: " + domain
  });
}

// ── Rules (I don't care about cookies) ───────────────────────────────────────

const RULES_URL     = "https://raw.githubusercontent.com/OhMyGuus/I-Dont-Care-About-Cookies/master/src/rules.js";
const RULES_TTL     = 24 * 60 * 60 * 1000;

async function fetchAndCacheRules() {
  try {
    const res = await fetch(RULES_URL);
    if (!res.ok) return null;
    const text = await res.text();
    const rulesMatch   = text.match(/const rules\s*=\s*(\{[\s\S]*?\});\s*\n/);
    const commonsMatch = text.match(/const commons\s*=\s*(\{[\s\S]*?\});\s*\n/);
    if (!rulesMatch || !commonsMatch) return null;
    const rules   = new Function("return " + rulesMatch[1])();
    const commons = new Function("return " + commonsMatch[1])();
    const cached  = { rules, commons, fetchedAt: Date.now() };
    await chrome.storage.local.set({ rulesCache: cached });
    console.log("[SCP] Rules aggiornate:", Object.keys(rules).length, "siti");
    return cached;
  } catch (e) {
    console.error("[SCP] Errore fetch rules:", e);
    return null;
  }
}

async function getRules() {
  const data   = await chrome.storage.local.get("rulesCache");
  const cached = data.rulesCache;
  if (cached && (Date.now() - cached.fetchedAt) < RULES_TTL) return cached;
  fetchAndCacheRules(); // aggiorna in background
  return cached || null;
}

chrome.runtime.onInstalled.addListener(() => fetchAndCacheRules());

// ── Unico listener messaggi ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === "clean") {
    clearSiteData(message.url);
    return false;
  }

  if (message.action === "addCurrentSite") {
    getSettings().then(s => {
      if (!s.siteList.includes(message.domain)) {
        s.siteList.push(message.domain);
        chrome.storage.sync.set({ siteList: s.siteList });
      }
    });
    return false;
  }

  if (message.action === "getStats") {
    getStats().then(stats => sendResponse(stats));
    return true; // risposta asincrona
  }

  if (message.action === "resetStats") {
    chrome.storage.local.set({ stats: DEFAULT_STATS })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.action === "getRules") {
    getRules().then(data => sendResponse(data || null));
    return true;
  }

});

// ── Tab tracking ──────────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;
  await chrome.storage.session.set({ ["tab_" + tabId]: tab.url });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const settings = await getSettings();
  if (!settings.autoClean) return;
  const data = await chrome.storage.session.get("tab_" + tabId);
  const url  = data["tab_" + tabId];
  if (!url) return;
  await clearSiteData(url);
});
