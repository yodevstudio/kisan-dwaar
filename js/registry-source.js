// T4, inverted by R5: publishing in the CMS must still reach citizens
// without a developer copying JSON by hand — but the original shape of
// that fix raced the committed data/schemes.json against the Firestore-
// published registry *before* the first render, which meant every citizen,
// on every load, waited on (and downloaded) the Firebase SDK — the exact
// "no CDN, no dependency" claim this static core is built to make. The
// purity grep in CONTEXT.md's own verification block never caught this,
// because the import sits in this file, one hop away from the five engine
// modules the grep actually names.
//
// R5 inverts the race instead of racing it: loadSchemeRegistry() below
// touches nothing but the committed file — instant, offline, zero SDK,
// zero third-party byte, every time. checkForNewerRegistry() is the other
// half: called only after first paint, never awaited as part of boot, and
// only actually reaching for the Firebase SDK if the browser reports it's
// online at all. A citizen who never has network access, or whose first
// load happens before this ever resolves, never notices it exists.
import { resolvePath } from './paths.js';
import { validateScheme, parseRatePolicyVocabulary } from '../tools/validate-data-core.mjs';

const SERVICES_TIMEOUT_MS = 3000;

// Field-by-field numeric comparison (isNewerVersion below), never a
// string sort — "…-10" must rank above "…-9".
function latestDatasetVersion(schemes) {
  return (schemes || [])
    .map((s) => s.dataset_version)
    .filter(Boolean)
    .reduce((best, v) => (isNewerVersion(v, best) ? v : best), null);
}

// dataset_version is "YYYY.MM.DD-N" (tools/build-registry.mjs, services/
// cms.js's nextDatasetVersion) — compared field-by-field as numbers, not
// as strings, so "...-9" correctly sorts before "...-10". A plain string
// compare gets exactly that case backwards.
function isNewerVersion(candidate, current) {
  if (!candidate) return false;
  if (!current) return true;
  const a = candidate.split(/[.-]/).map(Number);
  const b = current.split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
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

// The entire boot-time contract: read the git-tracked file, nothing else.
// No import of services/cms.js reaches this function at all, so no bundler
// or browser module graph analysis of this call path ever touches the
// Firebase SDK — it is not merely untried, it is unreferenced.
// Returns { schemes, source: 'static', dataset_version }.
export async function loadSchemeRegistry() {
  const response = await fetch(resolvePath('data/schemes.json'));
  if (!response.ok) throw new Error(`data/schemes.json: HTTP ${response.status}`);
  const schemes = await response.json();
  return { schemes, source: 'static', dataset_version: latestDatasetVersion(schemes) };
}

// Call after first render, never awaited as part of it. Resolves to
// { schemes, source: 'services', dataset_version } only if the published
// registry is reachable *and* genuinely newer than currentVersion;
// resolves to null on any failure, timeout, empty result, or a published
// version that isn't newer — never a silent downgrade, never a disruption
// to a citizen already mid-conversation over a same-version registry.
// A CMS publish writes one scheme at a time, so the published collection
// is a set of per-scheme overrides — never a complete registry on its own.
// Each published record replaces the committed record with the same
// scheme_id only if it passes the same validator tools/build-registry.mjs
// runs before anything reaches api/v1/; a record that fails is ignored and
// the committed version stays. Every other committed scheme is kept, so
// publishing one rule can never make the other eleven disappear.
async function mergePublished(baseSchemes, published) {
  let ratePolicyValues;
  try {
    const spec = await (await fetch(resolvePath('docs/DATA_SPEC.md'))).text();
    ratePolicyValues = parseRatePolicyVocabulary(spec);
  } catch (err) {
    console.warn('registry-source: could not load the rate_policy vocabulary — keeping the committed registry:', err);
    return null;
  }
  return mergePublishedRecords(baseSchemes, published, ratePolicyValues);
}

// Pure half of the merge, exported for tests/eligibility.test.html.
// Returns the merged list, or null if no published record was applied.
export function mergePublishedRecords(baseSchemes, published, ratePolicyValues) {
  const byId = new Map(baseSchemes.map((s) => [s.scheme_id, s]));
  let applied = 0;
  for (const record of published) {
    if (!record || typeof record !== 'object') continue;
    const errors = validateScheme(record, ratePolicyValues);
    if (errors.length) {
      console.warn(`registry-source: published ${record.scheme_id || '(no id)'} failed validation and was ignored:`, errors);
      continue;
    }
    const current = byId.get(record.scheme_id);
    if (current && !isNewerVersion(record.dataset_version, current.dataset_version)) continue;
    byId.set(record.scheme_id, record);
    applied += 1;
  }
  return applied ? [...byId.values()] : null;
}

export async function checkForNewerRegistry(currentVersion) {
  // Cheapest possible reachability check, and the one this project's own
  // acceptance test already uses ("turn off the network" — README's
  // verification checklist, EVIDENCE_LEDGER C5): if the browser itself
  // reports no network interface, don't even attempt the import — the
  // Firebase SDK is never requested, not merely allowed to fail.
  if (!navigator.onLine) return null;
  const result = await withTimeout(
    (async () => {
      const { loadPublishedRegistry } = await import('../services/cms.js');
      const schemes = await loadPublishedRegistry();
      return { schemes, dataset_version: latestDatasetVersion(schemes) };
    })(),
    SERVICES_TIMEOUT_MS,
  );
  if (!result || !Array.isArray(result.schemes) || result.schemes.length === 0) return null;
  // No registry-wide version comparison here: a scheme published today can
  // carry a version equal to, or older than, the newest *other* committed
  // scheme and still be newer than its own committed record. The per-scheme
  // comparison in mergePublishedRecords is the one that decides.
  const base = await loadSchemeRegistry().catch(() => null);
  if (!base) return null;
  const merged = await mergePublished(base.schemes, result.schemes);
  if (!merged) return null;
  return { schemes: merged, source: 'services', dataset_version: latestDatasetVersion(merged) };
}
