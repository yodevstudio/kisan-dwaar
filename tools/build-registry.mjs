// K10: generates the public, versioned api/v1/ registry from
// data/schemes.json. api/v1/ is entirely generated output — CONTEXT.md's
// repo layout says so explicitly ("generated registry — do not
// hand-edit") — and is committed to the repository, since the static
// core has no server-side build step at deploy time by design. Run this
// after any change to data/schemes.json and commit what it writes.
//
// Structural validation runs first and BLOCKS the build on any error —
// a stronger guarantee than tools/validate-data.mjs alone (a checker
// someone could forget to run): the registry itself cannot be built from
// a record that fails docs/DATA_SPEC.md's schema, subsidy_rule included.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateScheme, parseRatePolicyVocabulary } from './validate-data-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCHEMES_PATH = path.join(ROOT, 'data', 'schemes.json');
const SPEC_PATH = path.join(ROOT, 'docs', 'DATA_SPEC.md');
const API_DIR = path.join(ROOT, 'api', 'v1');
const INDEX_PATH = path.join(API_DIR, 'index.json');
const SCHEMES_DIR = path.join(API_DIR, 'schemes');
const DIFF_DIR = path.join(API_DIR, 'diff');

function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '.');
}

// Same YYYY.MM.DD-N shape as a scheme's own dataset_version (DATA_SPEC.md
// §1), applied here to the registry as a whole rather than to one record.
function nextRegistryVersion(previousVersion) {
  const today = todayKey();
  const m = (previousVersion || '').match(/^(\d{4}\.\d{2}\.\d{2})-(\d+)$/);
  if (!m) return `${today}-1`;
  const [, prevDate, prevN] = m;
  return prevDate === today ? `${today}-${Number(prevN) + 1}` : `${today}-1`;
}

function shallowChangedKeys(oldScheme, newScheme) {
  const keys = new Set([...Object.keys(oldScheme || {}), ...Object.keys(newScheme || {})]);
  const changed = [];
  for (const k of keys) {
    if (JSON.stringify(oldScheme?.[k]) !== JSON.stringify(newScheme?.[k])) changed.push(k);
  }
  return changed;
}

// Diffs the *previously generated* api/v1/schemes/*.json files against
// the new data/schemes.json content — not data/schemes.json against
// itself, which would trivially show no change. This is a shallow,
// top-level-key diff (which fields on a record changed), not a deep
// recursive one — enough to say "eligibility and benefit changed on
// RJ_TARBANDI," not exactly which line, which keeps this a build tool
// rather than a second data-authoring surface.
function buildDiff(oldSchemesById, newSchemes) {
  const newIds = new Set(newSchemes.map((s) => s.scheme_id));
  const oldIds = new Set(oldSchemesById.keys());
  const added = [...newIds].filter((id) => !oldIds.has(id));
  const removed = [...oldIds].filter((id) => !newIds.has(id));
  const changed = [];
  for (const scheme of newSchemes) {
    const old = oldSchemesById.get(scheme.scheme_id);
    if (!old) continue;
    const keys = shallowChangedKeys(old, scheme);
    if (keys.length > 0) changed.push({ scheme_id: scheme.scheme_id, changed_fields: keys });
  }
  return { added, removed, changed };
}

function loadOldIndex() {
  return existsSync(INDEX_PATH) ? JSON.parse(readFileSync(INDEX_PATH, 'utf8')) : null;
}

function loadAllOldSchemeRecords() {
  const byId = new Map();
  if (!existsSync(SCHEMES_DIR)) return byId;
  for (const file of readdirSync(SCHEMES_DIR)) {
    if (!file.endsWith('.json')) continue;
    byId.set(file.replace(/\.json$/, ''), JSON.parse(readFileSync(path.join(SCHEMES_DIR, file), 'utf8')));
  }
  return byId;
}

function main() {
  if (!existsSync(SCHEMES_PATH)) {
    console.error(`build-registry: ${SCHEMES_PATH} does not exist.`);
    process.exit(1);
  }
  const schemes = JSON.parse(readFileSync(SCHEMES_PATH, 'utf8'));
  const ratePolicyValues = parseRatePolicyVocabulary(readFileSync(SPEC_PATH, 'utf8'));

  let totalErrors = 0;
  for (const scheme of schemes) {
    const errors = validateScheme(scheme, ratePolicyValues);
    if (errors.length > 0) {
      totalErrors += errors.length;
      console.error(`build-registry: ${scheme.scheme_id || '(missing scheme_id)'} — ${errors.length} error(s):`);
      errors.forEach((e) => console.error(`  - ${e}`));
    }
  }
  if (totalErrors > 0) {
    console.error(`build-registry: FAILED — ${totalErrors} error(s) across ${schemes.length} scheme(s). Registry not built.`);
    process.exit(1);
  }

  const oldIndex = loadOldIndex();
  const oldSchemesById = loadAllOldSchemeRecords();
  const diff = buildDiff(oldSchemesById, schemes);
  const isFirstBuild = !oldIndex;
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;

  if (!hasChanges && !isFirstBuild) {
    console.log(`build-registry: no change since registry_version ${oldIndex.registry_version} — nothing written.`);
    return;
  }

  const registryVersion = isFirstBuild ? `${todayKey()}-1` : nextRegistryVersion(oldIndex.registry_version);

  mkdirSync(SCHEMES_DIR, { recursive: true });
  // Remove per-scheme files for records no longer in the dataset, so the
  // generated directory never carries a stale file forward.
  for (const id of oldSchemesById.keys()) {
    if (!schemes.some((s) => s.scheme_id === id)) rmSync(path.join(SCHEMES_DIR, `${id}.json`), { force: true });
  }
  for (const scheme of schemes) {
    writeFileSync(path.join(SCHEMES_DIR, `${scheme.scheme_id}.json`), JSON.stringify(scheme, null, 2) + '\n');
  }

  // T2: the dataset mixes schemes issued by Agriculture with schemes from
  // other departments (rural housing, health, food security, LPG, rural
  // employment) — scheme_count alone would restate the "N agriculture
  // schemes" headline claim without it actually being true. Both group
  // counts are exposed here so every consumer of the index (the UI, a
  // third party building on this API) sees the honest split, not just a
  // bare total.
  const agricultureCount = schemes.filter((s) => s.scheme_group === 'agriculture').length;
  const relatedWelfareCount = schemes.filter((s) => s.scheme_group === 'related_welfare').length;

  const index = {
    registry_version: registryVersion,
    generated_at: new Date().toISOString(),
    scheme_count: schemes.length,
    agriculture_count: agricultureCount,
    related_welfare_count: relatedWelfareCount,
    schemes: schemes.map((s) => ({
      scheme_id: s.scheme_id,
      name_hi: s.name_hi,
      name_en: s.name_en,
      keywords_hi: s.keywords_hi,
      department: s.department,
      scheme_group: s.scheme_group,
      dataset_version: s.dataset_version,
      last_verified: s.last_verified,
      has_subsidy_rule: !!s.subsidy_rule,
      url: `schemes/${s.scheme_id}.json`,
    })),
  };
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');

  if (!isFirstBuild) {
    const fromDir = path.join(DIFF_DIR, oldIndex.registry_version);
    mkdirSync(fromDir, { recursive: true });
    const diffPath = path.join(fromDir, `${registryVersion}.json`);
    writeFileSync(diffPath, JSON.stringify({ from: oldIndex.registry_version, to: registryVersion, ...diff }, null, 2) + '\n');
    console.log(`build-registry: diff written to api/v1/diff/${oldIndex.registry_version}/${registryVersion}.json`);
  }

  console.log(`build-registry: OK — registry_version ${registryVersion}, ${schemes.length} scheme(s) written to api/v1/.`);
}

main();
