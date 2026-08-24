import { resolvePath } from '../../js/paths.js';
import { evaluate } from '../../js/eligibility.js';
import { assemble } from '../../js/assemble.js';
import { explain, assertDerivedFromSourced } from '../../js/explainer.js';
import { validateScheme, parseRatePolicyVocabulary, TERM_TYPES, COMBINE_VALUES } from '../../tools/validate-data-core.mjs';
import { onSessionChange, login, logout } from '../../services/session.js';
import { loadDraft, saveDraft, loadPublished, publish, listVersions } from '../../services/cms.js';

// S5: this tool authors data/schemes.json records without hand-editing
// JSON, and previews them through the *real* engine (eligibility.js /
// assemble.js / explainer.js) so "what a farmer would see" is never a
// second, hand-maintained mockup that could drift from the real thing.
// "Publish" finalises a version inside this tool's own Firestore-backed
// history — it does not touch the git repository or data/schemes.json
// directly (a browser tool has no way to do that honestly); a human
// still copies the emitted JSON into the real file and commits it.
//
// Known, stated scope limit: eligibility conditions here are flat
// {slot, op, value} entries. A few real records (e.g. gender-branched age
// thresholds) use a nested any_of-of-arrays shape for ANDed branch
// groups — this tool doesn't yet build that shape through the form.
// Validate will say so plainly if you load such a record; author it by
// hand in that case rather than have this tool silently flatten it wrong.

let record = defaultRecord();
let testSlots = {};
let slotsDoc = { core_sequence: [], slots: [] };
let ratePolicyValues = [];

function defaultRecord() {
  return {
    scheme_id: '', name_hi: '', name_en: '', keywords_hi: [], department: '',
    dataset_version: '', source_url: '', source_type: 'html_page',
    last_verified: '', verification_interval_days: 90, next_review_due: '', verified_by: 'manual',
    eligibility: { all_of: [], any_of: [], none_of: [] },
    benefit: { type: 'subsidy', amount_inr: null, amount_text_hi: '', rate_policy: '', note: '' },
    documents: [],
    apply_via: [],
    response_templates_hi: { eligible: '', need_info: '', not_eligible: '', unknown: '' },
  };
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function labelledInput(labelText, value, onChange, type = 'text') {
  const wrap = el('div', 'cms-field');
  wrap.appendChild(el('label', 'hi', labelText));
  const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  input.className = 'hi';
  input.value = value ?? '';
  input.addEventListener('input', () => onChange(input.value));
  wrap.appendChild(input);
  return wrap;
}

function parseValueInput(raw) {
  const trimmed = String(raw).trim();
  if (trimmed === '') return undefined;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('[') || trimmed.startsWith('{') || trimmed.startsWith('"')) {
    try { return JSON.parse(trimmed); } catch { return trimmed; }
  }
  return trimmed;
}

function formatValueForInput(value) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

// ===== Section 1: basics =====
function renderBasics() {
  const container = document.getElementById('form-basics');
  container.innerHTML = '';
  const fields = [
    ['scheme_id', 'scheme_id (RJ_SCREAMING_SNAKE)'],
    ['name_hi', 'नाम (हिन्दी)'],
    ['name_en', 'नाम (अंग्रेज़ी)'],
    ['department', 'विभाग'],
    ['dataset_version', 'dataset_version (YYYY.MM.DD-N)'],
    ['source_url', 'स्रोत URL'],
    ['last_verified', 'जाँचा गया (YYYY-MM-DD)'],
    ['next_review_due', 'अगली समीक्षा तिथि (YYYY-MM-DD)'],
    ['verified_by', 'सत्यापनकर्ता'],
  ];
  fields.forEach(([key, label]) => {
    container.appendChild(labelledInput(label, record[key], (v) => { record[key] = v; }));
  });

  const srcTypeWrap = el('div', 'cms-field');
  srcTypeWrap.appendChild(el('label', 'hi', 'source_type'));
  const srcTypeSelect = document.createElement('select');
  ['html_page', 'text_pdf', 'scanned_pdf'].forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    if (record.source_type === t) opt.selected = true;
    srcTypeSelect.appendChild(opt);
  });
  srcTypeSelect.addEventListener('change', () => { record.source_type = srcTypeSelect.value; });
  srcTypeWrap.appendChild(srcTypeSelect);
  container.appendChild(srcTypeWrap);

  container.appendChild(labelledInput('verification_interval_days', record.verification_interval_days, (v) => {
    record.verification_interval_days = Number(v);
  }, 'number'));

  container.appendChild(labelledInput('keywords_hi (comma से अलग करें)', record.keywords_hi.join(', '), (v) => {
    record.keywords_hi = v.split(',').map((s) => s.trim()).filter(Boolean);
  }));
}

// ===== Section 2: eligibility =====
function conditionRow(list, index, refreshFn) {
  const cond = list[index];
  const row = el('div', 'cms-condition-row');

  const slotInput = document.createElement('input');
  slotInput.className = 'hi';
  slotInput.placeholder = 'slot';
  slotInput.value = cond.slot || '';
  slotInput.setAttribute('list', 'slot-options');
  slotInput.addEventListener('input', () => { cond.slot = slotInput.value; renderTestCitizen(); });

  const opSelect = document.createElement('select');
  ['eq', 'gte', 'lte', 'in', 'between'].forEach((op) => {
    const opt = document.createElement('option');
    opt.value = op; opt.textContent = op;
    if (cond.op === op) opt.selected = true;
    opSelect.appendChild(opt);
  });
  opSelect.addEventListener('change', () => { cond.op = opSelect.value; });

  const valueInput = document.createElement('input');
  valueInput.className = 'hi';
  valueInput.placeholder = 'value (जैसे "farmer", 18, ["a","b"])';
  valueInput.value = formatValueForInput(cond.value);
  valueInput.addEventListener('input', () => { cond.value = parseValueInput(valueInput.value); });

  const removeBtn = el('button', 'chip chip-secondary hi', '✕');
  removeBtn.type = 'button';
  removeBtn.addEventListener('click', () => { list.splice(index, 1); refreshFn(); });

  row.appendChild(slotInput);
  row.appendChild(opSelect);
  row.appendChild(valueInput);
  row.appendChild(removeBtn);
  return row;
}

function renderConditionGroup(container, groupKey) {
  container.innerHTML = '';
  container.appendChild(el('p', 'doc-list-title', groupKey));
  const list = record.eligibility[groupKey];
  list.forEach((cond, i) => {
    if (Array.isArray(cond)) {
      container.appendChild(el('p', 'term-warning', `[${i}] ANDed branch-group — इस टूल के फ़ॉर्म से संपादन योग्य नहीं, केवल Validate/Publish के लिए सुरक्षित रहेगा`));
      return;
    }
    container.appendChild(conditionRow(list, i, () => renderConditionGroup(container, groupKey)));
  });
  const addBtn = el('button', 'chip hi', `+ ${groupKey} में शर्त जोड़ें`);
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => {
    list.push({ slot: '', op: 'eq', value: '' });
    renderConditionGroup(container, groupKey);
  });
  container.appendChild(addBtn);
}

function renderEligibility() {
  const container = document.getElementById('form-eligibility');
  container.innerHTML = '';
  ['all_of', 'any_of', 'none_of'].forEach((key) => {
    const groupDiv = el('div', 'cms-condition-group');
    container.appendChild(groupDiv);
    renderConditionGroup(groupDiv, key);
  });
}

// ===== Section 3: benefit =====
function renderBenefit() {
  const container = document.getElementById('form-benefit');
  container.innerHTML = '';

  const amountWrap = el('div', 'cms-field');
  amountWrap.appendChild(el('label', 'hi', 'amount_inr (खाली छोड़ें अगर null / "बदलता है")'));
  const amountInput = document.createElement('input');
  amountInput.type = 'number';
  amountInput.value = record.benefit.amount_inr ?? '';
  amountInput.addEventListener('input', () => {
    record.benefit.amount_inr = amountInput.value === '' ? null : Number(amountInput.value);
  });
  amountWrap.appendChild(amountInput);
  container.appendChild(amountWrap);

  container.appendChild(labelledInput('amount_text_hi', record.benefit.amount_text_hi, (v) => { record.benefit.amount_text_hi = v; }, 'textarea'));

  const rpWrap = el('div', 'cms-field');
  rpWrap.appendChild(el('label', 'hi', 'rate_policy'));
  const rpSelect = document.createElement('select');
  const noneOpt = document.createElement('option');
  noneOpt.value = ''; noneOpt.textContent = '(amount_inr निश्चित है)';
  rpSelect.appendChild(noneOpt);
  ratePolicyValues.forEach((rp) => {
    const opt = document.createElement('option');
    opt.value = rp; opt.textContent = rp;
    if (record.benefit.rate_policy === rp) opt.selected = true;
    rpSelect.appendChild(opt);
  });
  rpSelect.addEventListener('change', () => { record.benefit.rate_policy = rpSelect.value; });
  rpWrap.appendChild(rpSelect);
  container.appendChild(rpWrap);

  container.appendChild(labelledInput('note (क्यों null / rate_policy चुना)', record.benefit.note, (v) => { record.benefit.note = v; }, 'textarea'));
}

// ===== Section 4: subsidy_rule =====
function ensureSubsidyRule() {
  if (!record.subsidy_rule) {
    record.subsidy_rule = {
      rule_id: '', inputs: [], unit_caps: {}, terms: [], combine: 'min',
      on_missing_input: 'report_computable_terms_only', source_quote_hi: '',
      source_url: record.source_url || '', last_verified: record.last_verified || '',
    };
  }
}

function renderSubsidyInputRow(inputs, i, refresh) {
  const row = el('div', 'cms-condition-row');
  const input = inputs[i];
  const slotField = document.createElement('input');
  slotField.className = 'hi'; slotField.placeholder = 'slot'; slotField.value = input.slot || '';
  slotField.addEventListener('input', () => { input.slot = slotField.value; renderTestCitizen(); });

  const typeSelect = document.createElement('select');
  ['number', 'single'].forEach((t) => {
    const opt = document.createElement('option'); opt.value = t; opt.textContent = t;
    if (input.type === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener('change', () => { input.type = typeSelect.value; });

  const requiredLabel = document.createElement('label');
  requiredLabel.className = 'hi';
  const requiredCheck = document.createElement('input');
  requiredCheck.type = 'checkbox';
  requiredCheck.checked = !!input.required;
  requiredCheck.addEventListener('change', () => { input.required = requiredCheck.checked; });
  requiredLabel.appendChild(requiredCheck);
  requiredLabel.append(' required');

  const promptField = document.createElement('input');
  promptField.className = 'hi'; promptField.placeholder = 'prompt_hi'; promptField.value = input.prompt_hi || '';
  promptField.addEventListener('input', () => { input.prompt_hi = promptField.value; });

  const unitField = document.createElement('input');
  unitField.className = 'hi'; unitField.placeholder = 'unit_hi'; unitField.value = input.unit_hi || '';
  unitField.addEventListener('input', () => { input.unit_hi = unitField.value; });

  const removeBtn = el('button', 'chip chip-secondary hi', '✕');
  removeBtn.type = 'button';
  removeBtn.addEventListener('click', () => { inputs.splice(i, 1); refresh(); });

  [slotField, typeSelect, requiredLabel, promptField, unitField, removeBtn].forEach((n) => row.appendChild(n));
  return row;
}

function renderTermRow(terms, i, refresh) {
  const term = terms[i];
  const box = el('div', 'card cms-term-box');
  const idField = document.createElement('input');
  idField.className = 'hi'; idField.placeholder = 'id'; idField.value = term.id || '';
  idField.addEventListener('input', () => { term.id = idField.value; });

  const labelField = document.createElement('input');
  labelField.className = 'hi'; labelField.placeholder = 'label_hi'; labelField.value = term.label_hi || '';
  labelField.addEventListener('input', () => { term.label_hi = labelField.value; });

  const typeSelect = document.createElement('select');
  TERM_TYPES.forEach((t) => {
    const opt = document.createElement('option'); opt.value = t; opt.textContent = t;
    if (term.type === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener('change', () => { term.type = typeSelect.value; renderTerms(); });

  const removeBtn = el('button', 'chip chip-secondary hi', '✕ शर्त हटाएं');
  removeBtn.type = 'button';
  removeBtn.addEventListener('click', () => { terms.splice(i, 1); refresh(); });

  box.appendChild(idField);
  box.appendChild(labelField);
  box.appendChild(typeSelect);

  if (term.type === 'flat_cap') {
    box.appendChild(labelledInput('amount_inr', term.amount_inr, (v) => { term.amount_inr = Number(v); }, 'number'));
  } else if (term.type === 'percent_of_cost') {
    box.appendChild(labelledInput('percent (या खाली छोड़ें अगर percent_by उपयोग करें)', term.percent, (v) => { term.percent = v === '' ? undefined : Number(v); }, 'number'));
    box.appendChild(labelledInput('percent_selector_slot (श्रेणी अनुसार हो तो)', term.percent_selector_slot, (v) => { term.percent_selector_slot = v || undefined; }));
    box.appendChild(labelledInput('percent_by (JSON, जैसे {"other":50,"small":70})', term.percent_by ? JSON.stringify(term.percent_by) : '', (v) => {
      try { term.percent_by = v ? JSON.parse(v) : undefined; } catch { /* leave as typed until valid */ }
    }));
    if (!term.cost_basis) term.cost_basis = { kind: 'citizen_quotation', slot: '' };
    box.appendChild(labelledInput('cost_basis.slot (citizen_quotation)', term.cost_basis.slot, (v) => {
      term.cost_basis = { kind: 'citizen_quotation', slot: v };
    }));
  } else if (term.type === 'per_unit_cap' || term.type === 'per_unit_rate') {
    box.appendChild(labelledInput('rate (या खाली छोड़ें अगर rates उपयोग करें)', term.rate, (v) => { term.rate = v === '' ? undefined : Number(v); }, 'number'));
    box.appendChild(labelledInput('rate_selector_slot', term.rate_selector_slot, (v) => { term.rate_selector_slot = v || undefined; }));
    box.appendChild(labelledInput('rates (JSON, जैसे {"hdpe":50,"pvc":35})', term.rates ? JSON.stringify(term.rates) : '', (v) => {
      try { term.rates = v ? JSON.parse(v) : undefined; } catch { /* leave as typed until valid */ }
    }));
    box.appendChild(labelledInput('unit_slot', term.unit_slot, (v) => { term.unit_slot = v; }));
  }

  box.appendChild(removeBtn);
  return box;
}

function renderTerms() {
  const container = document.getElementById('form-subsidy-rule');
  const termsHost = container.querySelector('.cms-terms-host');
  if (!termsHost) return;
  termsHost.innerHTML = '';
  record.subsidy_rule.terms.forEach((t, i) => termsHost.appendChild(renderTermRow(record.subsidy_rule.terms, i, renderTerms)));
}

function renderSubsidyRule() {
  const container = document.getElementById('form-subsidy-rule');
  const has = !!record.subsidy_rule;
  container.style.display = has ? '' : 'none';
  if (!has) return;
  const rule = record.subsidy_rule;
  container.innerHTML = '';

  container.appendChild(labelledInput('rule_id', rule.rule_id, (v) => { rule.rule_id = v; }));

  container.appendChild(el('p', 'doc-list-title', 'inputs'));
  const inputsHost = el('div', 'cms-inputs-host');
  rule.inputs.forEach((_, i) => inputsHost.appendChild(renderSubsidyInputRow(rule.inputs, i, renderSubsidyRule)));
  container.appendChild(inputsHost);
  const addInputBtn = el('button', 'chip hi', '+ input जोड़ें');
  addInputBtn.type = 'button';
  addInputBtn.addEventListener('click', () => { rule.inputs.push({ slot: '', type: 'number', required: true, prompt_hi: '', unit_hi: '' }); renderSubsidyRule(); renderTestCitizen(); });
  container.appendChild(addInputBtn);

  container.appendChild(el('p', 'doc-list-title', 'unit_caps (JSON, जैसे {"pipe_metres":{"max":800,"label_hi":"..."}})'));
  const unitCapsInput = document.createElement('textarea');
  unitCapsInput.className = 'hi';
  unitCapsInput.value = Object.keys(rule.unit_caps || {}).length ? JSON.stringify(rule.unit_caps) : '';
  unitCapsInput.addEventListener('input', () => {
    try { rule.unit_caps = unitCapsInput.value ? JSON.parse(unitCapsInput.value) : {}; } catch { /* leave as typed */ }
  });
  container.appendChild(unitCapsInput);

  container.appendChild(el('p', 'doc-list-title', 'terms'));
  const termsHost = el('div', 'cms-terms-host');
  container.appendChild(termsHost);
  renderTerms();
  const addTermBtn = el('button', 'chip hi', '+ शर्त जोड़ें');
  addTermBtn.type = 'button';
  addTermBtn.addEventListener('click', () => {
    rule.terms.push({ id: '', label_hi: '', type: 'flat_cap', amount_inr: 0 });
    renderSubsidyRule();
  });
  container.appendChild(addTermBtn);

  const combineWrap = el('div', 'cms-field');
  combineWrap.appendChild(el('label', 'hi', 'combine'));
  const combineSelect = document.createElement('select');
  COMBINE_VALUES.forEach((c) => {
    const opt = document.createElement('option'); opt.value = c; opt.textContent = c;
    if (rule.combine === c) opt.selected = true;
    combineSelect.appendChild(opt);
  });
  combineSelect.addEventListener('change', () => { rule.combine = combineSelect.value; });
  combineWrap.appendChild(combineSelect);
  container.appendChild(combineWrap);

  container.appendChild(labelledInput('on_missing_input', rule.on_missing_input, (v) => { rule.on_missing_input = v; }));
  container.appendChild(labelledInput('source_quote_hi (शब्दशः)', rule.source_quote_hi, (v) => { rule.source_quote_hi = v; }, 'textarea'));
  container.appendChild(labelledInput('subsidy_rule.source_url', rule.source_url, (v) => { rule.source_url = v; }));
  container.appendChild(labelledInput('subsidy_rule.last_verified', rule.last_verified, (v) => { rule.last_verified = v; }));
}

// ===== Section 5: documents =====
function renderDocuments() {
  const container = document.getElementById('form-documents');
  container.innerHTML = '';
  record.documents.forEach((doc, i) => {
    const box = el('div', 'card cms-term-box');
    ['doc_id', 'label_hi', 'icon', 'where_to_get_hi', 'sample_image'].forEach((field) => {
      const input = document.createElement('input');
      input.className = 'hi'; input.placeholder = field; input.value = doc[field] || '';
      input.addEventListener('input', () => { doc[field] = input.value; });
      box.appendChild(input);
    });
    const removeBtn = el('button', 'chip chip-secondary hi', '✕');
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => { record.documents.splice(i, 1); renderDocuments(); });
    box.appendChild(removeBtn);
    container.appendChild(box);
  });
}

// ===== Section 6/7: apply_via, templates =====
function renderApplyVia() {
  const container = document.getElementById('form-apply-via');
  container.innerHTML = '';
  container.appendChild(labelledInput('apply_via (comma से अलग करें, जैसे emitra, sso_portal)', record.apply_via.join(', '), (v) => {
    record.apply_via = v.split(',').map((s) => s.trim()).filter(Boolean);
  }));
}

function renderTemplates() {
  const container = document.getElementById('form-templates');
  container.innerHTML = '';
  [
    ['eligible', 'eligible (उपलब्ध: {{scheme_name_hi}}, {{benefit_text}})'],
    ['need_info', 'need_info (उपलब्ध: {{scheme_name_hi}}, {{missing}})'],
    ['not_eligible', 'not_eligible (उपलब्ध: {{reason_hi}})'],
    ['unknown', 'unknown'],
  ].forEach(([key, label]) => {
    container.appendChild(labelledInput(label, record.response_templates_hi[key], (v) => { record.response_templates_hi[key] = v; }, 'textarea'));
  });
}

// ===== Test citizen + live preview =====
function relevantSlots() {
  const slots = new Set(slotsDoc.core_sequence);
  function walk(entry) {
    (Array.isArray(entry) ? entry : [entry]).forEach((c) => { if (c && c.slot) slots.add(c.slot); });
  }
  ['all_of', 'any_of', 'none_of'].forEach((k) => (record.eligibility[k] || []).forEach(walk));
  if (record.subsidy_rule) {
    (record.subsidy_rule.inputs || []).forEach((inp) => slots.add(inp.slot));
  }
  return [...slots].filter(Boolean);
}

function renderTestCitizen() {
  const container = document.getElementById('form-test-citizen');
  container.innerHTML = '';
  relevantSlots().forEach((slotName) => {
    const def = slotsDoc.slots.find((s) => s.slot === slotName);
    const wrap = el('div', 'cms-field');
    wrap.appendChild(el('label', 'hi', def ? def.question_hi : slotName));
    const input = document.createElement('input');
    input.className = 'hi';
    input.placeholder = slotName;
    input.value = formatValueForInput(testSlots[slotName]);
    input.addEventListener('input', () => {
      testSlots[slotName] = parseValueInput(input.value);
      renderLivePreview();
    });
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
  renderLivePreview();
}

function renderLivePreview() {
  const host = document.getElementById('live-preview');
  host.innerHTML = '';
  if (!record.scheme_id) {
    host.appendChild(el('p', 'hi', 'पहले scheme_id भरें।'));
    return;
  }
  let evaluation;
  try {
    evaluation = evaluate(testSlots, record);
  } catch (err) {
    host.appendChild(el('p', 'term-warning', `evaluate() त्रुटि: ${err.message}`));
    return;
  }
  let output;
  try {
    output = assemble(evaluation.verdict, record, evaluation);
  } catch (err) {
    host.appendChild(el('p', 'term-warning', `assemble() guard-throw: ${err.message}`));
    return;
  }
  const card = el('div', 'card bg-verdict hi');
  card.appendChild(el('div', 'answer-headline', `नतीजा: ${evaluation.verdict}`));
  card.appendChild(el('p', '', output.text_hi));
  host.appendChild(card);

  if (record.subsidy_rule) {
    let explainOutput;
    try {
      explainOutput = explain(record, testSlots);
      assertDerivedFromSourced(explainOutput, record, testSlots);
    } catch (err) {
      host.appendChild(el('p', 'term-warning', `explain() / guard-throw: ${err.message}`));
      return;
    }
    const explCard = el('div', 'card explainer-card hi');
    explCard.appendChild(el('div', 'answer-headline', `अनुदान गणना — स्थिति: ${explainOutput.status}`));
    explainOutput.terms.forEach((t) => {
      explCard.appendChild(el('p', '', `${t.label_hi}: ${t.value ? '₹' + t.value.value.toLocaleString('en-IN') : 'जानकारी चाहिए'}`));
    });
    if (explainOutput.result) explCard.appendChild(el('p', 'result-line', `आपको मिलेगा: ₹${explainOutput.result.value.toLocaleString('en-IN')}`));
    host.appendChild(explCard);
  }
}

function renderAll() {
  renderBasics();
  renderEligibility();
  renderBenefit();
  document.getElementById('form-subsidy-rule').style.display = record.subsidy_rule ? '' : 'none';
  if (record.subsidy_rule) renderSubsidyRule();
  renderDocuments();
  renderApplyVia();
  renderTemplates();
  renderTestCitizen();
}

// ===== Validate / Save / Publish =====
async function runValidate() {
  const resultEl = document.getElementById('validate-result');
  resultEl.innerHTML = '';
  try {
    const specRes = await fetch(resolvePath('docs/DATA_SPEC.md'));
    const specText = await specRes.text();
    ratePolicyValues = parseRatePolicyVocabulary(specText);
  } catch (err) {
    resultEl.appendChild(el('p', 'term-warning', `DATA_SPEC.md लोड नहीं हो सका: ${err.message}`));
    return false;
  }
  const errors = validateScheme(record, ratePolicyValues);
  if (errors.length === 0) {
    resultEl.appendChild(el('p', 'result-line', '✅ सभी जाँचें पास — यह registry-valid है।'));
    return true;
  }
  resultEl.appendChild(el('p', 'term-warning', `⚠ ${errors.length} त्रुटि(याँ):`));
  const list = el('ul', 'doc-list');
  errors.forEach((e) => list.appendChild(el('li', '', e)));
  resultEl.appendChild(list);
  return false;
}

async function init() {
  const [slotsData, specText] = await Promise.all([
    fetch(resolvePath('data/slots.json')).then((r) => r.json()),
    fetch(resolvePath('docs/DATA_SPEC.md')).then((r) => r.text()),
  ]);
  slotsDoc = slotsData;
  ratePolicyValues = parseRatePolicyVocabulary(specText);

  const sessionGate = document.getElementById('session-gate');
  const cmsBody = document.getElementById('cms-body');

  onSessionChange((session) => {
    sessionGate.innerHTML = '';
    if (session) {
      sessionGate.appendChild(el('p', 'hi', `✅ लॉग-इन है — uid: ${session.uid}`));
      cmsBody.style.display = '';
    } else {
      sessionGate.appendChild(el('p', 'hi', 'S5 केवल लॉग-इन नागरिकों/स्टाफ़ के लिए है।'));
      const btn = el('button', 'button hi', 'Google से लॉग-इन करें');
      btn.type = 'button';
      btn.addEventListener('click', () => login());
      sessionGate.appendChild(btn);
      cmsBody.style.display = 'none';
    }
  });

  renderAll();

  document.getElementById('new-btn').addEventListener('click', () => {
    record = defaultRecord();
    testSlots = {};
    renderAll();
  });

  document.getElementById('toggle-subsidy-rule-btn').addEventListener('click', () => {
    if (record.subsidy_rule) record.subsidy_rule = null;
    else ensureSubsidyRule();
    document.getElementById('form-subsidy-rule').style.display = record.subsidy_rule ? '' : 'none';
    if (record.subsidy_rule) renderSubsidyRule();
    renderTestCitizen();
  });

  document.getElementById('add-document-btn').addEventListener('click', () => {
    record.documents.push({ doc_id: '', label_hi: '', icon: '', where_to_get_hi: '', sample_image: '' });
    renderDocuments();
  });

  document.getElementById('validate-btn').addEventListener('click', runValidate);

  // Every Firestore-touching action below is auth-gated at the rules
  // level (services/cms.js throws before even trying if there's no
  // session). Caught here specifically — an uncaught rejection in a
  // click handler fails silently with zero feedback, which is worse than
  // a plain alert for a citizen/staff member who just clicked "Publish"
  // and has no idea anything went wrong. Found exactly this way: testing
  // with no session produced a console-only unhandled rejection.
  document.getElementById('load-draft-btn').addEventListener('click', async () => {
    const id = document.getElementById('scheme-id-input').value.trim();
    if (!id) return;
    try {
      const draft = await loadDraft(id);
      if (draft) { record = draft; testSlots = {}; renderAll(); }
      else alert('इस scheme_id के लिए कोई ड्राफ़्ट नहीं मिला।');
    } catch (err) {
      alert(`ड्राफ़्ट लोड नहीं हो सका: ${err.message}`);
    }
  });

  document.getElementById('load-published-btn').addEventListener('click', async () => {
    const id = document.getElementById('scheme-id-input').value.trim();
    if (!id) return;
    try {
      const published = await loadPublished(id);
      if (published) { record = published; testSlots = {}; renderAll(); }
      else alert('इस scheme_id का कोई प्रकाशित संस्करण नहीं मिला।');
    } catch (err) {
      alert(`प्रकाशित संस्करण लोड नहीं हो सका: ${err.message}`);
    }
  });

  document.getElementById('save-draft-btn').addEventListener('click', async () => {
    if (!record.scheme_id) { alert('पहले scheme_id भरें।'); return; }
    try {
      await saveDraft(record.scheme_id, record);
      alert('ड्राफ़्ट सहेजा गया।');
    } catch (err) {
      alert(`ड्राफ़्ट सहेजा नहीं जा सका: ${err.message}`);
    }
  });

  document.getElementById('publish-btn').addEventListener('click', async () => {
    const ok = await runValidate();
    if (!ok) { alert('प्रकाशित करने से पहले सभी जाँचें पास करनी होंगी।'); return; }
    try {
      await publish(record.scheme_id, record);
      alert('प्रकाशित — अब इसे डेवलपर data/schemes.json में जोड़कर कमिट करे। यह टूल सीधे लाइव रजिस्ट्री नहीं बदलता (CONTEXT.md: static core की read-path कभी भी किसी सेवा-कॉल पर निर्भर नहीं होती)।');
    } catch (err) {
      alert(`प्रकाशित नहीं हो सका: ${err.message}`);
    }
  });

  document.getElementById('load-versions-btn').addEventListener('click', async () => {
    if (!record.scheme_id) { alert('पहले scheme_id भरें।'); return; }
    let versions;
    try {
      versions = await listVersions(record.scheme_id);
    } catch (err) {
      alert(`इतिहास लोड नहीं हो सका: ${err.message}`);
      return;
    }
    const host = document.getElementById('version-history');
    host.innerHTML = '';
    if (versions.length === 0) { host.appendChild(el('p', 'hi', 'कोई प्रकाशित संस्करण नहीं।')); return; }
    const list = el('ul', 'doc-list');
    versions.forEach((v) => {
      const when = v.published_at && v.published_at.toDate ? v.published_at.toDate().toLocaleString('hi-IN') : '…';
      list.appendChild(el('li', '', `${when} — ${v.published_by}`));
    });
    host.appendChild(list);
  });
}

init();
