(async () => {

  const settings = await chrome.storage.sync.get({
    blockCookieBanners: true,
    cookieBannerExceptions: []
  });

  if (!settings.blockCookieBanners) return;

  const hostname = location.hostname.replace(/^www\./, "");

  const isException = settings.cookieBannerExceptions.some(item => {
    item = item.trim().replace(/^www\./, "");
    if (!item) return false;
    if (item.startsWith("*.")) {
      const base = item.slice(2);
      return hostname === base || hostname.endsWith("." + base);
    }
    return hostname === item || hostname.endsWith("." + item);
  });

  if (isException) return;

  // ── Selettori ─────────────────────────────────────────────────────────────
  const SELECTORS = [
    // Sky / TG24 specifici
    "#sky-consent-layer",
    ".sky-consent-layer",
    "[class*='ConsentLayer']",
    "[class*='consent-layer']",
    "[class*='consentLayer']",
    "[id*='consent-layer']",
    "[class*='PrivacyModal']",
    "[class*='privacy-modal']",
    "[class*='CookieConsent']",
    "[class*='cookieConsent']",
    // Blocco fullscreen generico su sky.it / tg24
    "body > div[class*='Modal']",
    "body > div[class*='Overlay']",
    "body > div[class*='overlay'][style*='fixed']",
    "body > div[class*='modal'][style*='fixed']",
    // OneTrust
    "#onetrust-consent-sdk",
    "#onetrust-banner-sdk",
    ".onetrust-pc-dark-filter",
    "#onetrust-pc-sdk",
    // Cookiebot
    "#CybotCookiebotDialog",
    "#CybotCookiebotDialogBody",
    ".CybotCookiebotFader",
    // Sourcepoint / SP
    "#sp-cc",
    ".sp-message-container",
    "[id^='sp_message']",
    "[class*='sp-message']",
    // Quantcast
    "#qc-cmp2-container",
    ".qc-cmp2-container",
    ".qc-cmp-showing",
    // Didomi
    "#didomi-popup",
    "#didomi-notice",
    ".didomi-popup-container",
    ".didomi-consent-popup-backdrop",
    // iubenda
    ".iubenda-cs-container",
    "#iubenda-cs-banner",
    ".iubenda-backdrop",
    // Cookielaw / CLI
    "#cookielaw-info-bar",
    ".cli-bar-container",
    "#cookie-law-info-bar",
    // Cookie Consent (osano, cc)
    ".cc-window", ".cc-banner", ".cc-floating",
    ".osano-cm-window", ".osano-cm-dialog",
    // Usercentrics
    "#usercentrics-root", ".uc-banner",
    // Axeptio
    "#axeptio_overlay", ".axeptio_widget",
    // Termly
    ".termly-styles", "#termly-code-snippet-support",
    // TrustArc
    "#truste-consent-track", ".truste_box_overlay",
    // Evidon
    "#evidon-banner", ".evidon-banner",
    // CMP generici
    ".cmpbox", ".cmpboxer", "#cmp-container", ".cmp-container",
    "#cmpwrapper", "#cmpbox2",
    // Cookie notice generici per ID
    "[id*='cookie-banner']","[id*='cookie-consent']","[id*='cookie-notice']",
    "[id*='cookie-popup']","[id*='cookie-bar']","[id*='cookie-wall']",
    "[id*='cookie-overlay']","[id*='cookie-modal']",
    "[id*='cookiebanner']","[id*='cookieconsent']","[id*='cookienotice']",
    "[id*='gdpr-banner']","[id*='gdpr-notice']","[id*='gdpr-popup']",
    "[id*='gdpr-consent']","[id*='consent-banner']","[id*='consent-modal']",
    "[id*='consent-popup']","[id*='consent-overlay']",
    "[id*='privacy-banner']","[id*='privacy-notice']",
    // Cookie notice generici per classe
    "[class*='cookie-banner']","[class*='cookie-consent']","[class*='cookie-notice']",
    "[class*='cookie-popup']","[class*='cookie-bar']","[class*='cookie-wall']",
    "[class*='cookie-overlay']","[class*='cookie-modal']",
    "[class*='cookiebanner']","[class*='cookieconsent']",
    "[class*='gdpr-banner']","[class*='gdpr-notice']","[class*='gdpr-popup']",
    "[class*='gdpr-consent']","[class*='consent-banner']","[class*='consent-modal']",
    "[class*='consent-popup']","[class*='consent-overlay']",
    "[class*='privacy-banner']","[class*='privacy-notice']",
    // ARIA
    "[aria-label*='cookie'i]","[aria-label*='gdpr'i]",
    "[aria-label*='consent'i]","[aria-label*='privacy'i]",
  ];

  // CSS iniettato subito (prima del render)
  const style = document.createElement("style");
  style.id = "__scp__";
  style.textContent = SELECTORS.join(",") + "{display:none!important;visibility:hidden!important;opacity:0!important;}";
  (document.head || document.documentElement).appendChild(style);

  // Keyword nel testo per catturare banner non riconosciuti dai selettori
  const KEYWORDS = [
    "apprezziamo la tua privacy",
    "utilizziamo i cookie",
    "usiamo i cookie",
    "we use cookies",
    "cookie policy",
    "gdpr",
    "accetta tutto",
    "accetta i cookie",
    "accept all cookies",
    "gestisci preferenze",
    "continua senza accettare",
  ];

  function textMatches(el) {
    const t = (el.innerText || "").toLowerCase();
    return KEYWORDS.some(k => t.includes(k));
  }

function isOverlay(el) {
  const s = getComputedStyle(el);

  // ignore invisible elements
  if (s.display === "none" || s.visibility === "hidden") {
    return false;
  }

  // safely parse z-index
  const z = parseInt(s.zIndex, 10);

  if (isNaN(z)) return false;

  const rect = el.getBoundingClientRect();

  return (
    ["fixed", "sticky"].includes(s.position) &&
    z > 100 &&
    rect.width > window.innerWidth * 0.3 &&
    rect.height > 40
  );
}

  function cleanBanners() {
    // 1. Selettori CSS
    for (const sel of SELECTORS) {
      try {
        document.querySelectorAll(sel).forEach(el => el.remove());
      } catch (_) {}
    }

    // 2. Heuristica: elementi fissi con testo cookie
    try {
      document.querySelectorAll(
        "body > div, body > section, body > aside, body > dialog"
      ).forEach(el => {
        if (isOverlay(el) && textMatches(el)) {
  el.style.setProperty("display", "none", "important");
}
      });
    } catch (_) {}

    // 3. Ripristina scroll
    if (document.documentElement.style.overflow === "hidden") {
  document.documentElement.style.removeProperty("overflow");
}

if (document.body && document.body.style.overflow === "hidden") {
  document.body.style.removeProperty("overflow");
}
    document.body && document.body.style.removeProperty("overflow");
  }

  cleanBanners();

  const obs = new MutationObserver(cleanBanners);
  obs.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("load", () => {
    cleanBanners();
    setTimeout(() => obs.disconnect(), 20000);
  });

})();
