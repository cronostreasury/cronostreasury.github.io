// URL <-> slug helpers for the dynamic /cronos/protocol/<slug>/ route.
//
// GitHub Pages serves static files only, so a pretty path like
// /cronos/protocol/tectonic/ has no real file behind it. public/404.html
// catches that request and redirects to
// /cronos/protocol/index.html?slug=tectonic&redirect=1; this module reads
// the slug back out (from the query string, or from the path itself when
// running locally where the dev server *can* rewrite) and restores the
// pretty URL in the address bar via history.replaceState.

export function readProtocolSlugFromLocation(loc = window.location) {
  const params = new URLSearchParams(loc.search);
  const fromQuery = params.get("slug");
  if (fromQuery) return decodeURIComponent(fromQuery);

  // Fallback: /cronos/protocol/<slug>/ or /cronos/protocol/<slug>
  const match = loc.pathname.match(/\/cronos\/protocol\/([^/]+)\/?$/);
  if (match && match[1] && match[1] !== "index.html") return decodeURIComponent(match[1]);

  return null;
}

export function protocolDetailHref(slug) {
  return `/cronos/protocol/${encodeURIComponent(slug)}/`;
}

// Rewrite the visible URL to the pretty form after we've read the slug out
// of the redirect query string, without triggering a navigation.
export function restorePrettyProtocolUrl(slug, loc = window.location, historyImpl = window.history) {
  const pretty = protocolDetailHref(slug);
  if (loc.pathname === pretty) return;
  historyImpl.replaceState(null, "", pretty);
}
