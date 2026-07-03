// Injected into every page of the agent viewport webview. Collects console,
// error, and network-failure signals, and exposes __POLY_OBSERVE__ which
// walks the visible DOM into a compact, LLM-friendly observation. It never
// phones home on its own: data leaves the page only when the host evaluates
// __POLY_OBSERVE__ and reads the return value.
(() => {
  "use strict";
  if (window.__POLY_VIEWPORT__) return;
  window.__POLY_VIEWPORT__ = true;

  const consoleErrors = [];
  const consoleWarnings = [];
  const networkFailures = [];
  const push = (arr, value) => {
    if (arr.length < 50) arr.push(String(value).slice(0, 300));
  };

  const origError = console.error.bind(console);
  console.error = (...args) => {
    push(consoleErrors, args.map(String).join(" "));
    origError(...args);
  };
  const origWarn = console.warn.bind(console);
  console.warn = (...args) => {
    push(consoleWarnings, args.map(String).join(" "));
    origWarn(...args);
  };
  window.addEventListener("error", (e) => push(consoleErrors, e.message || "Script error"));
  window.addEventListener("unhandledrejection", (e) =>
    push(consoleErrors, "Unhandled rejection: " + (e.reason && e.reason.message ? e.reason.message : e.reason)),
  );

  const origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = (...args) =>
      origFetch(...args)
        .then((res) => {
          if (!res.ok && networkFailures.length < 30) {
            networkFailures.push({ url: String(res.url).slice(0, 200), status: res.status });
          }
          return res;
        })
        .catch((err) => {
          if (networkFailures.length < 30) {
            networkFailures.push({ url: String(args[0] && args[0].url ? args[0].url : args[0]).slice(0, 200), status: 0 });
          }
          throw err;
        });
  }

  const clean = (text) => (text || "").replace(/\s+/g, " ").trim();
  const visible = (el) => {
    if (typeof el.checkVisibility === "function") return el.checkVisibility();
    return el.offsetParent !== null || el.getClientRects().length > 0;
  };
  const labelFor = (el) => {
    const aria = el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title"));
    if (aria) return clean(aria);
    if (el.labels && el.labels.length) return clean(el.labels[0].textContent);
    if (el.placeholder) return clean(el.placeholder);
    if (el.name) return clean(el.name);
    return clean(el.textContent || el.value || "").slice(0, 80);
  };
  const collect = (selector, mapper, cap) => {
    const out = [];
    for (const el of document.querySelectorAll(selector)) {
      if (out.length >= cap) break;
      if (!visible(el)) continue;
      const item = mapper(el);
      if (item) out.push(item);
    }
    return out;
  };

  // FNV-1a over the structural signal; stable across irrelevant mutations.
  const hash = (text) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  };

  const describe = (el) => {
    if (!el || el === document.body || !el.tagName) return null;
    const role = el.getAttribute && el.getAttribute("role");
    return (
      el.tagName.toLowerCase() +
      (el.id ? "#" + el.id : "") +
      (role ? "[role=" + role + "]" : "") +
      (labelFor(el) ? " “" + labelFor(el).slice(0, 60) + "”" : "")
    );
  };

  window.__POLY_OBSERVE__ = (kind, selector) => {
    try {
      if (kind === "inspect") {
        if (!selector) return { error: "inspect requires a CSS selector" };
        let nodes;
        try {
          nodes = document.querySelectorAll(selector);
        } catch (e) {
          return { error: "Invalid CSS selector: " + selector };
        }
        const elements = [];
        for (const el of nodes) {
          if (elements.length >= 10) break;
          const rect = el.getBoundingClientRect();
          elements.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            role: el.getAttribute("role") || null,
            classes: clean(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 120) || null,
            text: clean(el.textContent).slice(0, 300) || null,
            value: "value" in el && el.type !== "password" ? String(el.value).slice(0, 120) : null,
            href: el.href ? String(el.href).slice(0, 200) : null,
            visible: visible(el),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          });
        }
        return { url: location.href, selector, matches: nodes.length, elements };
      }

      const buttons = collect(
        "button, [role=button], input[type=submit], input[type=button]",
        (el) => labelFor(el) || "(unlabelled button)",
        20,
      );
      const links = collect("a[href]", (el) => clean(el.textContent).slice(0, 80) || null, 25);
      const inputs = collect("input:not([type=hidden]), textarea, select", (el) => ({
        label: labelFor(el),
        type: el.type || el.tagName.toLowerCase(),
        value: el.type === "password" ? "(hidden)" : clean(String(el.value)).slice(0, 80) || null,
      }), 15);
      const headings = collect("h1, h2, h3, h4, h5, h6", (el) => ({
        level: Number(el.tagName[1]),
        text: clean(el.textContent).slice(0, 120),
      }), 15);
      const regions = collect(
        "nav, main, header, footer, aside, [role=dialog], [role=alert], [role=navigation], [role=main]",
        (el) => el.getAttribute("role") || el.tagName.toLowerCase(),
        10,
      );
      const textSummary = clean(document.body ? document.body.innerText : "").slice(0, 600);

      const structure =
        document.title +
        "|" +
        buttons.join(",") +
        "|" +
        headings.map((h) => h.level + h.text).join(",") +
        "|" +
        links.join(",") +
        "|" +
        inputs.map((i) => i.type + i.label + (i.value || "")).join(",") +
        "|" +
        textSummary;

      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        viewport: { width: window.innerWidth, height: window.innerHeight, scrollY: Math.round(window.scrollY) },
        focusedElement: describe(document.activeElement),
        buttons,
        links,
        inputs,
        headings,
        forms: document.forms.length,
        regions: [...new Set(regions)],
        textSummary,
        consoleErrors: consoleErrors.slice(0, 5),
        consoleErrorCount: consoleErrors.length,
        consoleWarnings: consoleWarnings.slice(0, 3),
        consoleWarningCount: consoleWarnings.length,
        networkFailures: networkFailures.slice(0, 5),
        networkFailureCount: networkFailures.length,
        domHash: hash(structure),
      };
    } catch (e) {
      return { error: String(e) };
    }
  };
})();
