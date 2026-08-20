// Data-entry gate for K3: run against a single record while hand-typing
// data/schemes.json, or against the whole file as a pre-build check.
// Structural rules below are transcribed from docs/DATA_SPEC.md §1 (record
// schema) and §3 (subsidy_rule schema). The §4 rate_policy vocabulary is
// NOT duplicated here — it is parsed straight out of DATA_SPEC.md §4 at
// run time, so the list can only ever have one home and a table edit there
// can never quietly drift out of sync with what this script accepts.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SPEC_PATH = path.join(ROOT, 'docs', 'DATA_SPEC.md');
const SCHEMES_PATH = path.join(ROOT, 'data', 'schemes.json');

const SCHEME_ID_RE = /^RJ_[A-Z0-9_]+$/;
const DATASET_VERSION_RE = /^\d{4}\.\d{2}\.\d{2}-\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPES = ['html_page', 'text_pdf', 'scanned_pdf'];
const TERM_TYPES = ['percent_of_cost', 'per_unit_cap', 'per_unit_rate', 'flat_cap'];
const COMBINE_VALUES = ['min', 'max', 'sum'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Reads the §4 table directly from DATA_SPEC.md — see file header comment.
function loadRatePolicyVocabulary() {
  const text = readFileSync(SPEC_PATH, 'utf8');
  const section = text.match(/## §4[^\n]*\n([\s\S]*?)\n---/);
  if (!section) {
    throw new Error('validate-data: could not find the §4 rate_policy table in docs/DATA_SPEC.md');
  }
  const values = [...section[1].matchAll(/^\|\s*`([A-Z0-9_]+)`\s*\|/gm)].map((m) => m[1]);
  if (values.length === 0) {
    throw new Error('validate-data: §4 table in docs/DATA_SPEC.md parsed to zero rate_policy values');
  }
  return values;
}

// A condition is {slot, op, value}, or an array of such (ANDed) — §1 eligibility,
// §3 applies_when share this shape.
function validateCondition(entry, label, errors) {
  if (Array.isArray(entry)) {
    entry.forEach((c, i) => validateCondition(c, `${label}[${i}]`, errors));
    return;
  }
  if (!isPlainObject(entry)) {
    errors.push(`${label}: must be a condition object or an array of condition objects`);
    return;
  }
  if (!isNonEmptyString(entry.slot)) errors.push(`${label}.slot: required non-empty string`);
  if (!isNonEmptyString(entry.op)) errors.push(`${label}.op: required non-empty string`);
  if (!('value' in entry)) errors.push(`${label}.value: required`);
}

function validateEligibility(eligibility, errors) {
  if (!isPlainObject(eligibility)) {
    errors.push('eligibility: required object');
    return;
  }
  for (const key of ['all_of', 'any_of', 'none_of']) {
    if (!(key in eligibility)) {
      errors.push(`eligibility.${key}: required (use [] if none)`);
      continue;
    }
    if (!Array.isArray(eligibility[key])) {
      errors.push(`eligibility.${key}: must be an array`);
      continue;
    }
    eligibility[key].forEach((entry, i) => validateCondition(entry, `eligibility.${key}[${i}]`, errors));
  }
}

// §1: amount_inr is a number ONLY when a single fixed figure is published;
// otherwise rate_policy is REQUIRED and must be one of the §4 strings.
function validateBenefit(benefit, errors, ratePolicyValues) {
  if (!isPlainObject(benefit)) {
    errors.push('benefit: required object');
    return;
  }
  if (!isNonEmptyString(benefit.type)) errors.push('benefit.type: required non-empty string');
  if (benefit.amount_inr !== null && typeof benefit.amount_inr !== 'number') {
    errors.push('benefit.amount_inr: must be a number or null');
  }

  if (benefit.amount_inr === null) {
    if (!isNonEmptyString(benefit.amount_text_hi)) {
      errors.push('benefit.amount_text_hi: required (published structure, in Hindi) whenever amount_inr is null');
    }
    if (!isNonEmptyString(benefit.rate_policy)) {
      errors.push('benefit.rate_policy: REQUIRED whenever amount_inr is null (DATA_SPEC.md §4)');
    } else if (!ratePolicyValues.includes(benefit.rate_policy)) {
      errors.push(`benefit.rate_policy: "${benefit.rate_policy}" is not one of the §4 strings (${ratePolicyValues.join(', ')})`);
    }
  } else if (benefit.rate_policy !== undefined && !ratePolicyValues.includes(benefit.rate_policy)) {
    errors.push(`benefit.rate_policy: "${benefit.rate_policy}" is not one of the §4 strings (${ratePolicyValues.join(', ')})`);
  }
}

// §3.2 — a cost basis is either the citizen's own quotation or a Department-
// published unit cost. No third way; anything else is fabrication.
function validateCostBasis(costBasis, label, errors) {
  if (!isPlainObject(costBasis)) {
    errors.push(`${label}: required object`);
    return;
  }
  if (costBasis.kind === 'citizen_quotation') {
    if (!isNonEmptyString(costBasis.slot)) errors.push(`${label}.slot: required when kind is citizen_quotation`);
  } else if (costBasis.kind === 'rule_unit_cost') {
    if (typeof costBasis.unit_cost_inr !== 'number') errors.push(`${label}.unit_cost_inr: required number when kind is rule_unit_cost`);
    if (!isNonEmptyString(costBasis.unit_slot)) errors.push(`${label}.unit_slot: required when kind is rule_unit_cost`);
  } else {
    errors.push(`${label}.kind: must be "citizen_quotation" or "rule_unit_cost" (DATA_SPEC.md §3.2 — no other cost basis is legitimate)`);
  }
}

// §3.1 term-type table.
function validateTerm(term, label, errors) {
  if (!isPlainObject(term)) {
    errors.push(`${label}: must be an object`);
    return;
  }
  if (!isNonEmptyString(term.id)) errors.push(`${label}.id: required non-empty string`);
  if (!isNonEmptyString(term.label_hi)) errors.push(`${label}.label_hi: required non-empty string`);
  if (!TERM_TYPES.includes(term.type)) {
    errors.push(`${label}.type: must be one of ${TERM_TYPES.join(', ')}`);
    return;
  }

  switch (term.type) {
    case 'percent_of_cost': {
      const hasFlatPercent = typeof term.percent === 'number';
      const hasPercentByCategory = isPlainObject(term.percent_by) && isNonEmptyString(term.percent_selector_slot);
      if (!hasFlatPercent && !hasPercentByCategory) {
        errors.push(`${label}: requires "percent" (number) or "percent_by" + "percent_selector_slot"`);
      }
      validateCostBasis(term.cost_basis, `${label}.cost_basis`, errors);
      break;
    }
    case 'per_unit_cap':
    case 'per_unit_rate': {
      const hasFlatRate = typeof term.rate === 'number';
      const hasRatesByCategory = isPlainObject(term.rates) && isNonEmptyString(term.rate_selector_slot);
      if (!hasFlatRate && !hasRatesByCategory) {
        errors.push(`${label}: requires "rate" (number) or "rates" + "rate_selector_slot"`);
      }
      if (!isNonEmptyString(term.unit_slot)) errors.push(`${label}.unit_slot: required`);
      break;
    }
    case 'flat_cap': {
      if (typeof term.amount_inr !== 'number') errors.push(`${label}.amount_inr: required number for flat_cap`);
      break;
    }
  }
}

function validateSubsidyRule(rule, errors) {
  if (!isPlainObject(rule)) {
    errors.push('subsidy_rule: must be an object');
    return;
  }
  if (!isNonEmptyString(rule.rule_id)) errors.push('subsidy_rule.rule_id: required non-empty string');

  if (rule.applies_when !== undefined) {
    if (!Array.isArray(rule.applies_when)) errors.push('subsidy_rule.applies_when: must be an array');
    else rule.applies_when.forEach((c, i) => validateCondition(c, `subsidy_rule.applies_when[${i}]`, errors));
  }

  if (!Array.isArray(rule.inputs) || rule.inputs.length === 0) {
    errors.push('subsidy_rule.inputs: required non-empty array');
  } else {
    rule.inputs.forEach((input, i) => {
      const label = `subsidy_rule.inputs[${i}]`;
      if (!isPlainObject(input)) {
        errors.push(`${label}: must be an object`);
        return;
      }
      if (!isNonEmptyString(input.slot)) errors.push(`${label}.slot: required`);
      if (!isNonEmptyString(input.type)) errors.push(`${label}.type: required`);
      if (input.type === 'single' && !Array.isArray(input.options)) {
        errors.push(`${label}.options: required array when type is "single"`);
      }
      if (typeof input.required !== 'boolean') errors.push(`${label}.required: required boolean`);
      if (!isNonEmptyString(input.prompt_hi)) errors.push(`${label}.prompt_hi: required non-empty string`);
    });
  }

  if (rule.unit_caps !== undefined) {
    if (!isPlainObject(rule.unit_caps)) {
      errors.push('subsidy_rule.unit_caps: must be an object');
    } else {
      for (const [slot, cap] of Object.entries(rule.unit_caps)) {
        if (!isPlainObject(cap) || typeof cap.max !== 'number' || !isNonEmptyString(cap.label_hi)) {
          errors.push(`subsidy_rule.unit_caps.${slot}: requires numeric "max" and non-empty "label_hi"`);
        }
      }
    }
  }

  if (!Array.isArray(rule.terms) || rule.terms.length === 0) {
    errors.push('subsidy_rule.terms: required non-empty array');
  } else {
    rule.terms.forEach((term, i) => validateTerm(term, `subsidy_rule.terms[${i}]`, errors));
    const ids = rule.terms.map((t) => t && t.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) errors.push('subsidy_rule.terms: "id" values must be unique within the rule');
  }

  if (!COMBINE_VALUES.includes(rule.combine)) {
    errors.push(`subsidy_rule.combine: must be one of ${COMBINE_VALUES.join(', ')}`);
  }
  if (!isNonEmptyString(rule.on_missing_input)) errors.push('subsidy_rule.on_missing_input: required non-empty string');
  if (!isNonEmptyString(rule.source_quote_hi)) {
    errors.push('subsidy_rule.source_quote_hi: required — transcribe the rule text verbatim (DATA_SPEC.md §2.3, §3)');
  }
  if (!isNonEmptyString(rule.source_url)) errors.push('subsidy_rule.source_url: required');
  if (!DATE_RE.test(rule.last_verified || '')) errors.push('subsidy_rule.last_verified: required, format YYYY-MM-DD');
}

function validateScheme(scheme, ratePolicyValues) {
  if (!isPlainObject(scheme)) return ['record: must be a JSON object'];
  const errors = [];

  if (!SCHEME_ID_RE.test(scheme.scheme_id || '')) errors.push('scheme_id: required, must match RJ_ + SCREAMING_SNAKE');
  if (!isNonEmptyString(scheme.name_hi)) errors.push('name_hi: required non-empty string');
  if (!isNonEmptyString(scheme.name_en)) errors.push('name_en: required non-empty string');

  if (!Array.isArray(scheme.keywords_hi) || scheme.keywords_hi.length === 0) {
    errors.push('keywords_hi: required non-empty array');
  } else {
    scheme.keywords_hi.forEach((kw, i) => {
      if (typeof kw !== 'string' || kw.length < 3) errors.push(`keywords_hi[${i}]: must be a string of at least 3 characters`);
    });
  }

  if (!isNonEmptyString(scheme.department)) errors.push('department: required non-empty string');
  if (!DATASET_VERSION_RE.test(scheme.dataset_version || '')) errors.push('dataset_version: required, format YYYY.MM.DD-N');
  if (!isNonEmptyString(scheme.source_url)) errors.push('source_url: required non-empty string');
  if (!SOURCE_TYPES.includes(scheme.source_type)) errors.push(`source_type: must be one of ${SOURCE_TYPES.join(', ')}`);
  if (!DATE_RE.test(scheme.last_verified || '')) errors.push('last_verified: required, format YYYY-MM-DD');
  if (typeof scheme.verification_interval_days !== 'number' || scheme.verification_interval_days <= 0) {
    errors.push('verification_interval_days: required positive number');
  }
  if (!DATE_RE.test(scheme.next_review_due || '')) errors.push('next_review_due: required, format YYYY-MM-DD');
  if (!isNonEmptyString(scheme.verified_by)) errors.push('verified_by: required non-empty string');

  validateEligibility(scheme.eligibility, errors);
  validateBenefit(scheme.benefit || {}, errors, ratePolicyValues);

  if (scheme.subsidy_rule !== undefined) validateSubsidyRule(scheme.subsidy_rule, errors);

  if (!Array.isArray(scheme.documents) || scheme.documents.length === 0) {
    errors.push('documents: required non-empty array');
  } else {
    scheme.documents.forEach((doc, i) => {
      const label = `documents[${i}]`;
      if (!isPlainObject(doc)) {
        errors.push(`${label}: must be an object`);
        return;
      }
      for (const field of ['doc_id', 'label_hi', 'icon', 'where_to_get_hi', 'sample_image']) {
        if (!isNonEmptyString(doc[field])) errors.push(`${label}.${field}: required non-empty string`);
      }
    });
  }

  if (!Array.isArray(scheme.apply_via) || scheme.apply_via.length === 0) {
    errors.push('apply_via: required non-empty array');
  }

  if (!isPlainObject(scheme.response_templates_hi)) {
    errors.push('response_templates_hi: required object');
  } else {
    for (const key of ['eligible', 'need_info', 'not_eligible', 'unknown']) {
      if (!isNonEmptyString(scheme.response_templates_hi[key])) {
        errors.push(`response_templates_hi.${key}: required non-empty string`);
      }
    }
  }

  return errors;
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
