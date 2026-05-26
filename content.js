(async () => {

  // ── 1. Controlla impostazioni ─────────────────────────────────────────────
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

  // ── Costanti (dichiarate prima di tutto il codice esecutivo) ──────────────

  const REMOVE_SELECTORS = [
    "#onetrust-consent-sdk","#CybotCookiebotDialog","#sp-cc",
    "#qc-cmp2-container","#didomi-popup","#usercentrics-root",
    "#axeptio_overlay",".iubenda-cs-container","#cookielaw-info-bar",
    "[id*='cookie-banner']","[id*='cookie-consent']","[id*='gdpr-banner']",
    "[class*='ConsentLayer']","[class*='CookieConsent']","[class*='CookieBar']",
  ];

  const KEYWORDS = [
    "rispettiamo la tua privacy","apprezziamo la tua privacy",
    "utilizziamo i cookie","usiamo i cookie","cookie tecnici",
    "accetta tutti","rifiuta tutti","accetta tutto",
    "we use cookies","accept all cookies","reject all",
    "cookie policy","gestisci preferenze","continua senza accettare",
    "preferenze cookie","consenso cookie",
  ];

  // ── Funzioni (hoistate, ma meglio dichiararle qui per chiarezza) ──────────

  function injectCSS(css) {
    const el = document.createElement("style");
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function injectGenericCSS() {
    injectCSS(`
      #onetrust-consent-sdk,#onetrust-banner-sdk,.onetrust-pc-dark-filter,
      #CybotCookiebotDialog,#CybotCookiebotDialogBody,.CybotCookiebotFader,
      #sp-cc,.sp-message-container,[id^='sp_message'],[class*='sp-message'],
      #qc-cmp2-container,.qc-cmp2-container,.qc-cmp-showing,
      #didomi-popup,#didomi-notice,.didomi-popup-container,.didomi-consent-popup-backdrop,
      .iubenda-cs-container,#iubenda-cs-banner,.iubenda-backdrop,
      #usercentrics-root,.uc-banner,#axeptio_overlay,.axeptio_widget,
      .cc-window,.cc-banner,.cc-floating,
      .osano-cm-window,.osano-cm-dialog,
      #truste-consent-track,.truste_box_overlay,
      #evidon-banner,.evidon-banner,
      .cmpbox,.cmpboxer,#cmp-container,.cmp-container,#cmpwrapper,#cmpbox2,
      #cookielaw-info-bar,.cli-bar-container,
      [id*='cookie-banner'],[id*='cookie-consent'],[id*='cookie-notice'],
      [id*='cookie-popup'],[id*='cookie-bar'],[id*='cookie-wall'],
      [id*='cookie-overlay'],[id*='cookie-modal'],[id*='cookiebanner'],
      [id*='cookieconsent'],[id*='cookienotice'],[id*='gdpr-banner'],
      [id*='gdpr-notice'],[id*='gdpr-popup'],[id*='gdpr-consent'],
      [id*='consent-banner'],[id*='consent-modal'],[id*='consent-popup'],
      [id*='consent-overlay'],[id*='privacy-banner'],[id*='privacy-notice'],
      [class*='cookie-banner'],[class*='cookie-consent'],[class*='cookie-notice'],
      [class*='cookie-popup'],[class*='cookie-bar'],[class*='cookiebanner'],
      [class*='cookieconsent'],[class*='gdpr-banner'],[class*='gdpr-popup'],
      [class*='gdpr-consent'],[class*='consent-banner'],[class*='consent-modal'],
      [class*='consent-popup'],[class*='consent-overlay'],
      [class*='privacy-banner'],[class*='privacy-notice'],
      [class*='ConsentLayer'],[class*='consent-layer'],[class*='consentLayer'],
      [class*='PrivacyModal'],[class*='privacy-modal'],
      [class*='CookieConsent'],[class*='cookieConsent'],
      [class*='CookieBar'],[class*='cookie-wall'],
      [aria-label*='cookie' i],[aria-label*='gdpr' i],
      [aria-label*='consent' i],[aria-label*='privacy' i]
      { display: none !important; visibility: hidden !important; }
    `);
  }

  function cleanBySelectors() {
    for (const sel of REMOVE_SELECTORS) {
      try { document.querySelectorAll(sel).forEach(el => el.remove()); }
      catch (_) {}
    }
  }

  function textMatches(el) {
    const t = (el.innerText || "").toLowerCase();
    return KEYWORDS.some(k => t.includes(k));
  }

  function isOverlay(el) {
    try {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return false;
      const z = parseInt(s.zIndex, 10);
      if (isNaN(z) || z < 100) return false;
      const rect = el.getBoundingClientRect();
      return ["fixed","sticky"].includes(s.position) &&
             rect.width > window.innerWidth * 0.25 &&
             rect.height > 50;
    } catch (_) { return false; }
  }

  function cleanByHeuristic() {
    try {
      document.querySelectorAll(
        "body > div, body > section, body > aside, body > dialog, body > nav"
      ).forEach(el => {
        if (isOverlay(el) && textMatches(el))
          el.style.setProperty("display", "none", "important");
      });
    } catch (_) {}
  }

  function restoreScroll() {
    try {
      if (document.documentElement.style.overflow === "hidden")
        document.documentElement.style.removeProperty("overflow");
      if (document.body && document.body.style.overflow === "hidden")
        document.body.style.removeProperty("overflow");
    } catch (_) {}
  }

  function runHandler(key) {
    switch (key) {
      case "0_defaultClickHandler":
      case "5_clickHandler":
        setTimeout(() => {
          const rejectTexts = [
            "rifiuta tutti","rifiuta","continua senza accettare",
            "reject all","reject","decline","no thanks","non accettare"
          ];
          for (const text of rejectTexts) {
            const btn = [...document.querySelectorAll("button,a")]
              .find(b => b.innerText?.trim().toLowerCase() === text);
            if (btn) { btn.click(); return; }
          }
        }, 800);
        break;
      case "2_sessionStorageHandler":
        try { sessionStorage.setItem("cookieConsent","true"); } catch(_){}
        break;
      case "3_localStorageHandler":
        try { localStorage.setItem("cookieConsent","true"); } catch(_){}
        break;
      case "6_cookieHandler":
        document.cookie = "cookieconsent_status=dismiss; max-age=31536000; path=/";
        document.cookie = "cookie_consent=1; max-age=31536000; path=/";
        break;
      case "8_googleHandler":
        try { localStorage.setItem("CONSENT","YES+"); } catch(_){}
        break;
    }
  }

  // ── 2. CSS generico iniettato subito ──────────────────────────────────────
  injectGenericCSS();

  // ── 3. Regole specifiche per dominio dal database ─────────────────────────
  const rulesData = await chrome.runtime.sendMessage({ action: "getRules" });

  if (rulesData) {
    const { rules, commons } = rulesData;
    let siteRule = null;
    for (const key of Object.keys(rules)) {
      if (hostname === key || hostname.endsWith("." + key)) {
        siteRule = rules[key];
        break;
      }
    }
    if (siteRule) {
      const cssRules = [];
      const jsHandlers = [];
      for (const entry of siteRule) {
        if (entry.s) cssRules.push(entry.s);
        if (entry.c !== undefined) cssRules.push(commons[entry.c]);
        if (entry.j !== undefined) jsHandlers.push(entry.j);
      }
      if (cssRules.length) injectCSS(cssRules.filter(Boolean).join("\n"));
      for (const h of jsHandlers) runHandler(h);
    }
  }

  // ── 4. Pulizia DOM + observer ─────────────────────────────────────────────
  cleanBySelectors();
  cleanByHeuristic();
  restoreScroll();

  const obs = new MutationObserver(() => {
    cleanBySelectors();
    cleanByHeuristic();
    restoreScroll();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("load", () => {
    cleanBySelectors();
    cleanByHeuristic();
    restoreScroll();
    setTimeout(() => obs.disconnect(), 20000);
  });

})();
