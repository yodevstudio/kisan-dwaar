// Data-entry gate for K3: run against a single record while hand-typing
// data/schemes.json, or against the whole file as a pre-build check.
//
// The actual validation rules live in ./validate-data-core.mjs, a Node-free
// module shared with S5's CMS (which runs in a browser) — this file is now
// just the Node-specific shell around it: reading files, parsing CLI args,
// printing results. See validate-data-core.mjs's header for why the split
// exists.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateScheme, parseRatePolicyVocabulary } from './validate-data-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SPEC_PATH = path.join(ROOT, 'docs', 'DATA_SPEC.md');
const SCHEMES_PATH = path.join(ROOT, 'data', 'schemes.json');

function loadRatePolicyVocabulary() {
  return parseRatePolicyVocabulary(readFileSync(SPEC_PATH, 'utf8'));
}

// --id resolves against a per-record file first (either candidate location
// named in the task), falling back to a scheme_id lookup inside the shared
// data/schemes.json array once records start landing there.
function findRecord(id) {
  const candidates = [
    path.join(ROOT, 'data', 'schemes', `${id}.json`),
    path.join(ROOT, 'api', 'v1', 'schemes', `${id}.json`),
  ];
  for (const file of candidates) {
    if (existsSync(file)) return { scheme: JSON.parse(readFileSync(file, 'utf8')), source: file };
  }
  if (existsSync(SCHEMES_PATH)) {
    const schemes = JSON.parse(readFileSync(SCHEMES_PATH, 'utf8'));
    const match = schemes.find((s) => s.scheme_id === id);
    if (match) return { scheme: match, source: `${SCHEMES_PATH} (scheme_id: ${id})` };
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const idIndex = args.indexOf('--id');
  const id = idIndex !== -1 ? args[idIndex + 1] : null;

  const ratePolicyValues = loadRatePolicyVocabulary();

  if (id) {
    const found = findRecord(id);
    if (!found) {
      console.error(`validate-data: no record found for --id ${id}.`);
      console.error(`  checked: data/schemes/${id}.json`);
      console.error(`  checked: api/v1/schemes/${id}.json`);
      console.error(`  checked: scheme_id inside ${SCHEMES_PATH}`);
      process.exit(1);
    }
    const errors = validateScheme(found.scheme, ratePolicyValues);
    if (errors.length > 0) {
      console.error(`validate-data: ${id} — ${errors.length} error(s) (${found.source}):`);
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log(`validate-data: OK — ${id} passed (${found.source}).`);
    return;
  }

  if (!existsSync(SCHEMES_PATH)) {
    console.error(`validate-data: ${SCHEMES_PATH} does not exist yet.`);
    console.error('  pass --id <SCHEME_ID> to validate a single record, or create data/schemes.json first.');
    process.exit(1);
  }

  const schemes = JSON.parse(readFileSync(SCHEMES_PATH, 'utf8'));
  let totalErrors = 0;
  for (const scheme of schemes) {
    const errors = validateScheme(scheme, ratePolicyValues);
    if (errors.length > 0) {
      totalErrors += errors.length;
      console.error(`validate-data: ${scheme.scheme_id || '(missing scheme_id)'} — ${errors.length} error(s):`);
      for (const e of errors) console.error(`  - ${e}`);
    }
  }
  if (totalErrors > 0) {
    console.error(`validate-data: FAILED — ${totalErrors} error(s) across ${schemes.length} scheme(s).`);
    process.exit(1);
  }
  console.log(`validate-data: OK — ${schemes.length} scheme(s) checked, 0 errors.`);
}

main();
