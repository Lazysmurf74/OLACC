document.addEventListener("DOMContentLoaded", async () => {

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let hostname = "";
  try { hostname = new URL(tab.url).hostname; } catch (_) {}

  document.getElementById("currentSite").textContent = hostname || "—";

  const s = await chrome.storage.sync.get({
    autoClean: true,
    clearCookies: true, clearCache: false,
    clearLocalStorage: false, clearHistory: false,
    blockCookieBanners: true, cookieBannerExceptions: []
  });

  // ── Auto clean ─────────────────────────────────────────────────────────
  const acEl  = document.getElementById("autoClean");
  const acSub = document.getElementById("autoSub");
  const badge = document.getElementById("statusBadge");

  function setAC(v) {
    acEl.checked = v;
    acSub.textContent = v ? "ATTIVO" : "INATTIVO";
    acSub.classList.toggle("on", v);
    badge.textContent = v ? "ON" : "OFF";
    badge.style.color = v ? "var(--green)" : "var(--muted)";
    badge.style.background = v ? "rgba(74,222,128,.12)" : "rgba(96,96,160,.12)";
    badge.style.borderColor = v ? "rgba(74,222,128,.25)" : "rgba(96,96,160,.2)";
  }
  setAC(s.autoClean);
  acEl.addEventListener("change", async () => { await chrome.storage.sync.set({ autoClean: acEl.checked }); setAC(acEl.checked); });

  // ── Chips ──────────────────────────────────────────────────────────────
  document.querySelectorAll(".chip").forEach(chip => {
    const k = chip.dataset.key;
    if (s[k]) chip.classList.add("on");
    chip.addEventListener("click", async () => {
      const v = chip.classList.toggle("on");
      await chrome.storage.sync.set({ [k]: v });
    });
  });

  // ── Banner toggle ──────────────────────────────────────────────────────
  const bbEl  = document.getElementById("blockBanners");
  const bbSub = document.getElementById("bannerSub");
  function setBB(v) {
    bbEl.checked = v;
    bbSub.textContent = v ? "ATTIVO" : "INATTIVO";
    bbSub.classList.toggle("on", v);
  }
  setBB(s.blockCookieBanners);
  bbEl.addEventListener("change", async () => { await chrome.storage.sync.set({ blockCookieBanners: bbEl.checked }); setBB(bbEl.checked); });

  // ── Eccezione banner ───────────────────────────────────────────────────
  const excBtn = document.getElementById("addExcBtn");
  const excMsg = document.getElementById("excMsg");
  const clean  = hostname.replace(/^www\./, "");
  const already = s.cookieBannerExceptions.some(e => e.trim().replace(/^www\./, "") === clean);
  if (already) { excBtn.textContent = "✓ Eccezione già presente"; excBtn.disabled = true; }

  excBtn.addEventListener("click", async () => {
    const fr = await chrome.storage.sync.get({ cookieBannerExceptions: [] });
    if (!fr.cookieBannerExceptions.includes(clean)) {
      fr.cookieBannerExceptions.push(clean);
      await chrome.storage.sync.set({ cookieBannerExceptions: fr.cookieBannerExceptions });
    }
    excMsg.style.display = "block";
    excMsg.textContent = "✓ " + clean + " aggiunto — ricarica la pagina";
    excBtn.textContent = "✓ Eccezione già presente";
    excBtn.disabled = true;
  });

  // ── Pulisci ────────────────────────────────────────────────────────────
  document.getElementById("cleanBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "clean", url: tab.url });
  });

  // ── Proteggi ───────────────────────────────────────────────────────────
  const protBtn = document.getElementById("addSiteBtn");
  protBtn.addEventListener("click", async () => {
    chrome.runtime.sendMessage({ action: "addCurrentSite", domain: hostname });
    protBtn.textContent = "✓ Sito protetto";
    protBtn.disabled = true;
  });

  // ── Stats ──────────────────────────────────────────────────────────────
  async function loadStats() {
    const st = await chrome.runtime.sendMessage({ action: "getStats" });
    document.getElementById("sCleans").textContent  = st.totalCleans;
    document.getElementById("sCookies").textContent = st.totalCookiesRemoved;
    document.getElementById("sSites").textContent   = st.uniqueDomains.length;
    if (st.lastClean) {
      const d = new Date(st.lastClean.timestamp);
      document.getElementById("lastClean").textContent =
        "Ultimo: " + st.lastClean.domain + " · " +
        d.toLocaleDateString("it-IT", { day: "numeric", month: "short" }) +
        " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    }
  }
  loadStats();
  document.getElementById("refreshStats").addEventListener("click", loadStats);

});
