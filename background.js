
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

async function getSettings() {
  return await chrome.storage.sync.get(DEFAULT_SETTINGS);
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

  // login protetti
  if (matchesDomain(domain, settings.protectedLogins)) {
    return false;
  }

  const listed = matchesDomain(domain, settings.siteList);

  // whitelist = non pulire quelli nella lista
  if (settings.mode === "whitelist") {
    return !listed;
  }

  // blacklist = pulire solo quelli nella lista
  return listed;
}

async function clearSiteData(tabUrl) {
  const settings = await getSettings();

  if (!tabUrl || !tabUrl.startsWith("http")) return;

  const url = new URL(tabUrl);
  const domain = url.hostname;

  const allowed = await shouldClean(domain);

  if (!allowed) {
    console.log("Protetto:", domain);
    return;
  }

  // COOKIE
  if (settings.clearCookies) {
    const cookies = await chrome.cookies.getAll({ domain });

    for (const cookie of cookies) {
      const protocol = cookie.secure ? "https:" : "http:";

      const cookieUrl =
        protocol + "//" +
        cookie.domain.replace(/^\./, "") +
        cookie.path;

      try {
        await chrome.cookies.remove({
          url: cookieUrl,
          name: cookie.name,
          storeId: cookie.storeId
        });
      } catch (e) {
        console.error(e);
      }
    }
  }

  // CACHE/STORAGE
  const removalOptions = {
    origins: [url.origin]
  };

  const dataToRemove = {};

  if (settings.clearCache) {
    dataToRemove.cache = true;
  }

  if (settings.clearLocalStorage) {
    dataToRemove.localStorage = true;
    dataToRemove.indexedDB = true;
    dataToRemove.serviceWorkers = true;
  }

  if (Object.keys(dataToRemove).length > 0) {
    try {
      await chrome.browsingData.remove(
        removalOptions,
        dataToRemove
      );
    } catch (e) {
      console.error(e);
    }
  }

  // HISTORY
  if (settings.clearHistory) {
    try {
      await chrome.history.deleteUrl({
        url: tabUrl
      });
    } catch (e) {
      console.error(e);
    }
  }

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: "Site Cleaner Pro",
    message: "Pulizia completata: " + domain
  });
}

// pulizia manuale
chrome.runtime.onMessage.addListener(async (message) => {

  if (message.action === "clean") {
    await clearSiteData(message.url);
  }

  if (message.action === "addCurrentSite") {

    const settings = await getSettings();

    if (!settings.siteList.includes(message.domain)) {

      settings.siteList.push(message.domain);

      await chrome.storage.sync.set({
        siteList: settings.siteList
      });
    }
  }
});

// salva url tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {

  if (!tab.url) return;

  await chrome.storage.session.set({
    ["tab_" + tabId]: tab.url
  });
});

// autoclean chiusura tab
chrome.tabs.onRemoved.addListener(async (tabId) => {

  const settings = await getSettings();

  if (!settings.autoClean) return;

  const data = await chrome.storage.session.get(
    "tab_" + tabId
  );

  const url = data["tab_" + tabId];

  if (!url) return;

  await clearSiteData(url);
});
