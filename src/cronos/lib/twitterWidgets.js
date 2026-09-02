// Loader for X's official public embed script (widgets.js). This is the
// sanctioned client-side embed method — no API key, no bearer token, no
// scraping: the script itself talks to X and turns a plain
// `<a class="twitter-timeline">` (or `<blockquote class="twitter-tweet">`)
// into a live iframe. Idempotent: multiple embeds on one page share a
// single script load.

export const WIDGETS_SRC = "https://platform.twitter.com/widgets.js";

let loadPromise = null;

// Exposed so tests can reset the module-level cache between cases.
export function _resetForTests() {
  loadPromise = null;
}

export function loadTwitterWidgets() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("No window/document available"));
  }
  if (window.twttr?.widgets) return Promise.resolve(window.twttr);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WIDGETS_SRC}"]`);
    if (existing) {
      if (window.twttr?.widgets) {
        resolve(window.twttr);
        return;
      }
      existing.addEventListener("load", () => resolve(window.twttr));
      existing.addEventListener("error", () => reject(new Error("X widgets.js failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = WIDGETS_SRC;
    script.async = true;
    script.charset = "utf-8";
    script.onload = () => resolve(window.twttr);
    script.onerror = () => reject(new Error("X widgets.js failed to load"));
    document.body.appendChild(script);
  }).catch((err) => {
    // Let a later mount retry (e.g. after a transient network failure)
    // instead of caching a permanent rejection.
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}
