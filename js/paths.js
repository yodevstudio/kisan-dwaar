// K0c: every fetch/asset path in this app must resolve correctly on two
// origins — Netlify, where the app is served from "/", and the GitHub Pages
// mirror, where it is served from "/kisan-dwaar/". A hard-coded absolute
// path like "/api/v1/index.json" is correct on the first and 404s on the
// second, so nothing in the static core may write one (see CONTEXT.md
// "Deployment facts").
//
// The fix does not depend on document.baseURI, which changes with how deep
// the calling page sits (pages/check/index.html vs. the root shell). This
// module's own import.meta.url is always the browser-resolved absolute URL
// of js/paths.js as actually loaded, and js/paths.js always sits exactly one
// level below the app root on both origins — so climbing one level from it
// gives the correct root on either origin, from any calling page, with
// nothing hard-coded.

const ROOT_URL = new URL('..', import.meta.url);

// Resolves a path like "data/schemes.json" or "api/v1/index.json" against
// the app root and returns an absolute URL string, safe to pass to fetch()
// or assign to an element's src/href. A leading slash is stripped first —
// otherwise the browser would treat it as origin-absolute and skip the
// GitHub Pages "/kisan-dwaar/" segment entirely.
export function resolvePath(relativePath) {
  const clean = String(relativePath).replace(/^\/+/, '');
  return new URL(clean, ROOT_URL).href;
}

// The app root itself, as an absolute URL string ending in "/". For the
// rare caller that needs the root rather than a specific path resolved
// against it.
export function rootUrl() {
  return ROOT_URL.href;
}
