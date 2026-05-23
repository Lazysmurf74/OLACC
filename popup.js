
document.addEventListener("DOMContentLoaded", async () => {

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  const hostname = new URL(tab.url).hostname;

  document.getElementById("currentSite").innerText =
    "Sito corrente: " + hostname;

  // stato autoclean
  const settings = await chrome.storage.sync.get({
    autoClean: true
  });

  const autoClean =
    document.getElementById("autoClean");

  autoClean.checked = settings.autoClean;

  autoClean.addEventListener("change", async () => {

    await chrome.storage.sync.set({
      autoClean: autoClean.checked
    });

  });

  // pulizia manuale
  document.getElementById("cleanBtn")
    .addEventListener("click", async () => {

      chrome.runtime.sendMessage({
        action: "clean",
        url: tab.url
      });

    });

  // aggiungi sito
  document.getElementById("addSiteBtn")
    .addEventListener("click", async () => {

      chrome.runtime.sendMessage({
        action: "addCurrentSite",
        domain: hostname
      });

      alert(hostname + " aggiunto");
    });

});
