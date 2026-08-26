// T4: closes the "officer publishes in the CMS, a developer still has to
// copy-paste into data/schemes.json" gap — WITHOUT making the static core
// depend on the services layer. This module is the only place besides
// js/app.js and js/disclosure.js that ever mentions the services layer for
// scheme data; js/eligibility.js, assemble.js, explainer.js, router.js and
// normalise.js only ever receive schemes as a plain array argument.
//
// loadSchemeRegistry() tries the CMS's published Firestore registry first,
// racing it against a 3-second timeout, and falls back to the git-tracked
// data/schemes.json on any failure, empty result, or timeout — same
// degrade-gracefully idiom js/app.js already uses for services/telemetry.js
// (dynamic import + catch, never a static import that could take the whole
// page down with it).
import { resolvePath } from './paths.js';

const SERVICES_TIMEOUT_MS = 3000;

function latestDatasetVersion(schemes) {
  const versions = (schemes || []).map((s) => s.dataset_version).filter(Boolean).sort();
  return versions.length ? versions[versions.length - 1] : null;
}

async function loadFromServices() {
  const { loadPublishedRegistry } = await import('../services/cms.js');
  const schemes = await loadPublishedRegistry();
  return { schemes, dataset_version: latestDatasetVersion(schemes) };
}

async function loadFromStatic() {
  const schemes = await (await fetch(resolvePath('data/schemes.json'))).json();
  return { schemes, dataset_version: latestDatasetVersion(schemes) };
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(null); }
    }, ms);
    promise.then(
      (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } },
      () => { if (!settled) { settled = true; clearTimeout(timer); resolve(null); } },
    );
  });
}

// Returns { schemes, source: 'services' | 'static', dataset_version }.
// `source` and `dataset_version` exist so the disclosure panel can state
// plainly which one a citizen is actually looking at — never silently.
export async function loadSchemeRegistry() {
  const servicesResult = await withTimeout(loadFromServices(), SERVICES_TIMEOUT_MS);
  if (servicesResult && Array.isArray(servicesResult.schemes) && servicesResult.schemes.length > 0) {
    return { schemes: servicesResult.schemes, source: 'services', dataset_version: servicesResult.dataset_version };
  }
  const staticResult = await loadFromStatic();
  return { schemes: staticResult.schemes, source: 'static', dataset_version: staticResult.dataset_version };
}
