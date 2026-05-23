const SETTINGS_KEYS = [
  "autoClean",
  "clearCookies",
  "clearCache",
  "clearLocalStorage",
  "clearHistory",
  "mode",
  "siteList",
  "protectedLogins"
];

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
  const settings = await chrome.storage.sync.get(defaults);

  document.getElementById("mode").value = settings.mode;
  document.getElementById("clearCookies").checked = settings.clearCookies;
  document.getElementById("clearCache").checked = settings.clearCache;
  document.getElementById("clearLocalStorage").checked = settings.clearLocalStorage;
  document.getElementById("clearHistory").checked = settings.clearHistory;
  document.getElementById("siteList").value = settings.siteList.join("\n");
  document.getElementById("protectedLogins").value = settings.protectedLogins.join("\n");
}

function getFormValues() {
  return {
    mode: document.getElementById("mode").value,
    clearCookies: document.getElementById("clearCookies").checked,
    clearCache: document.getElementById("clearCache").checked,
    clearLocalStorage: document.getElementById("clearLocalStorage").checked,
    clearHistory: document.getElementById("clearHistory").checked,
    siteList: document.getElementById("siteList").value
      .split("\n").map(v => v.trim()).filter(Boolean),
    protectedLogins: document.getElementById("protectedLogins").value
      .split("\n").map(v => v.trim()).filter(Boolean)
  };
}

function applyToForm(settings) {
  if (settings.mode !== undefined)
    document.getElementById("mode").value = settings.mode;
  if (settings.clearCookies !== undefined)
    document.getElementById("clearCookies").checked = settings.clearCookies;
  if (settings.clearCache !== undefined)
    document.getElementById("clearCache").checked = settings.clearCache;
  if (settings.clearLocalStorage !== undefined)
    document.getElementById("clearLocalStorage").checked = settings.clearLocalStorage;
  if (settings.clearHistory !== undefined)
    document.getElementById("clearHistory").checked = settings.clearHistory;
  if (Array.isArray(settings.siteList))
    document.getElementById("siteList").value = settings.siteList.join("\n");
  if (Array.isArray(settings.protectedLogins))
    document.getElementById("protectedLogins").value = settings.protectedLogins.join("\n");
}

function showMessage(text, type = "success") {
  const el = document.getElementById("ioMessage");
  el.textContent = text;
  el.className = "io-message " + type;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3500);
}

// SALVA
document.getElementById("saveBtn").addEventListener("click", async () => {
  await chrome.storage.sync.set(getFormValues());
  showMessage("✓ Impostazioni salvate");
});

// ESPORTA
document.getElementById("exportBtn").addEventListener("click", async () => {
  const settings = await chrome.storage.sync.get(defaults);

  const exportData = {
    _version: 1,
    _exported: new Date().toISOString(),
    ...settings
  };

  const blob = new Blob(
    [JSON.stringify(exportData, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = "site-cleaner-settings-" + date + ".json";
  a.click();
  URL.revokeObjectURL(url);

  showMessage("✓ Impostazioni esportate");
});

// IMPORTA — apri file picker
document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

// IMPORTA — leggi file
document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // reset input per poter reimportare lo stesso file
  e.target.value = "";

  let parsed;

  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    showMessage("✗ File JSON non valido", "error");
    return;
  }

  // validazione campi attesi
  const validKeys = new Set(SETTINGS_KEYS);
  const hasValidKey = Object.keys(parsed).some(k => validKeys.has(k));

  if (!hasValidKey) {
    showMessage("✗ File non riconosciuto come backup valido", "error");
    return;
  }

  // filtra solo le chiavi conosciute
  const toSave = {};
  for (const key of SETTINGS_KEYS) {
    if (parsed[key] !== undefined) toSave[key] = parsed[key];
  }

  await chrome.storage.sync.set(toSave);
  applyToForm(toSave);
  showMessage("✓ Impostazioni importate correttamente");
});

load();
