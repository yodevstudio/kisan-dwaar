import { resolvePath } from './paths.js';
import { normalise } from './normalise.js';
import { route, RAJASTHAN_DISTRICTS, RAJASTHAN_DISTRICTS_EN } from './router.js';
import { evaluate, evaluateAll } from './eligibility.js';
import { assemble, assembleEn, explainGapEn } from './assemble.js';
import { explain, assertDerivedFromSourced } from './explainer.js';
import { getLang, t } from './i18n.js';
import { loadSchemeRegistry } from './registry-source.js';

// K5: presentation only — every verdict, every rupee figure and every
// missing-slot prompt below comes from eligibility.js / assemble.js /
// explainer.js exactly as K1/K4 built and tested them. This module adds
// no scoring, no eligibility logic and no arithmetic of its own.

// S3: analytics is loaded dynamically, not with a static import, and
// deliberately not awaited before the discovery flow starts. A static
// import is a hard dependency — if services/telemetry.js or the Firebase
// CDN it pulls in ever failed to load, the whole module (this file,
// including eligibility and the explainer) would fail to load with it.
// A citizen must be able to answer six questions and get a verdict with
// analytics entirely unreachable (CONTEXT.md constraint 1), so track()
// below is a no-op until (and unless) this resolves.
let telemetryModule = null;
import('../services/telemetry.js')
  .then((m) => { telemetryModule = m; })
  .catch((err) => console.warn('telemetry unavailable (non-fatal, discovery unaffected):', err));

function track(fnName, ...args) {
  if (telemetryModule) telemetryModule[fnName](...args);
}

// K8: chat history is deliberately NOT retroactively translated when the
// citizen toggles language mid-conversation — every bubble below is
// plain appended text, frozen in whichever language was active when it
// was printed, exactly like any real chat app. Only the language active
// *at the moment a new bubble is created* decides that bubble's language;
// the composer, nav and every other static-core surface still switch
// instantly via their own 'kisan:langchange' listeners (js/i18n.js).
function langClass(base) {
  return getLang() === 'hi' ? `${base} hi` : base;
}

// K20: reason chips shown after a thumb is picked — no free-text field
// anywhere in this widget, so a citizen can never type an identifier into
// an analytics event by accident (docs/ANALYTICS.md §3's never-collected
// list depends on this staying true).
const FEEDBACK_REASONS = {
  up: [
    { value: 'correct', label_hi: 'सही जानकारी', label_en: 'Correct information' },
    { value: 'easy', label_hi: 'आसान समझ आया', label_en: 'Was easy to understand' },
    { value: 'fast', label_hi: 'जल्दी मिला', label_en: 'Got it quickly' },
  ],
  down: [
    { value: 'wrong', label_hi: 'गलत लगा', label_en: 'Seemed wrong' },
    { value: 'confusing', label_hi: 'समझ नहीं आया', label_en: "Didn't understand it" },
    { value: 'incomplete', label_hi: 'जानकारी अधूरी', label_en: 'Information was incomplete' },
  ],
};

// Kept as a named constant per data/samples.json's own note, which
// references it by this exact name — the first N samples are guaranteed
// reachable in one tap from a cold load, before the citizen has typed
// anything or answered a single question.
const FALLBACK_SAMPLE_COUNT = 4;

const state = {
  slots: {},
  schemes: [],
  slotsDoc: { core_sequence: [], slots: [] },
  lexicon: {},
};

const chatEl = document.getElementById('chat');
const composerEl = document.getElementById('composer');
const queryInputEl = document.getElementById('query-input');
const discoverBtnEl = document.getElementById('discover-btn');

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addBotBubble(text) {
  const bubble = el('div', langClass('bubble bubble-bot'), text);
  chatEl.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function addUserBubble(text) {
  const bubble = el('div', langClass('bubble bubble-user'), text);
  chatEl.appendChild(bubble);
  scrollToBottom();
}

// opt carries label_hi and (where available) label_en; falls back to
// label_hi if an option has no English label yet (e.g. a typed-query
// sample — data/samples.json only stores query_hi today, independent of
// what the router itself can understand, see routeQuery below).
function labelForOption(opt) {
  const lang = getLang();
  if (lang === 'en' && opt.label_en) return opt.label_en;
  return opt.label_hi;
}

function addChips(options, onPick) {
  const wrap = el('div', 'chips');
  options.forEach((opt) => {
    const btn = el('button', langClass('chip'), labelForOption(opt));
    btn.type = 'button';
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      addUserBubble(opt.value === null ? t('chat.dont_know') : labelForOption(opt));
      onPick(opt.value);
    });
    wrap.appendChild(btn);
  });
  chatEl.appendChild(wrap);
  scrollToBottom();
}

function addNumberPrompt(unit, required, onSubmit) {
  const wrap = el('div', 'chips');
  const input = document.createElement('input');
  input.type = 'number';
  input.className = langClass('number-input');
  input.min = '0';
  input.step = 'any';
  if (unit) input.placeholder = unit;
  const done = () => {
    const raw = input.value.trim();
    wrap.querySelectorAll('input,button').forEach((n) => { n.disabled = true; });
    if (raw === '') {
      addUserBubble(t('chat.skipped'));
      onSubmit(undefined);
      return;
    }
    addUserBubble(unit ? `${raw} ${unit}` : raw);
    onSubmit(Number(raw));
  };
  const submit = el('button', langClass('chip'), t('chat.ok'));
  submit.type = 'button';
  submit.addEventListener('click', done);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
  wrap.appendChild(input);
  wrap.appendChild(submit);
  if (!required) {
    const skip = el('button', langClass('chip chip-secondary'), t('chat.skip'));
    skip.type = 'button';
    skip.addEventListener('click', () => {
      wrap.querySelectorAll('input,button').forEach((n) => { n.disabled = true; });
      addUserBubble(t('chat.skipped'));
      onSubmit(undefined);
    });
    wrap.appendChild(skip);
  }
  chatEl.appendChild(wrap);
  scrollToBottom();
}

function findSlotDef(slotName) {
  return state.slotsDoc.slots.find((s) => s.slot === slotName);
}

function questionFor(def) {
  return getLang() === 'en' && def.question_en ? def.question_en : def.question_hi;
}

function unitFor(def) {
  return getLang() === 'en' && def.unit_en ? def.unit_en : def.unit_hi;
}

// Asks one question from data/slots.json's catalogue — the shared,
// discovery-flow wording every scheme's eligibility conditions share.
// district_select carries no inline options — data/slots.json's own note on
// that slot says it's "populated from the Rajasthan district list in
// router.js", so RAJASTHAN_DISTRICTS is the single source for these chips,
// the same list router.js itself matches typed district names against.
// RAJASTHAN_DISTRICTS_EN is index-aligned with it for the English label
// only — the stored slot *value* stays the Hindi name regardless of UI
// language, since no eligibility condition in this dataset reads district
// at all; it only needs to be echoed back consistently.
function optionsForCatalogSlot(def) {
  if (Array.isArray(def.options)) return def.options;
  if (def.type === 'district_select') {
    const paired = RAJASTHAN_DISTRICTS.map((d, i) => ({ value: d, label_hi: d, label_en: RAJASTHAN_DISTRICTS_EN[i] }));
    return paired
      .sort((a, b) => labelForOption(a).localeCompare(labelForOption(b), getLang() === 'en' ? 'en' : 'hi'))
      .concat([{ value: null, label_hi: 'पता नहीं', label_en: "Don't know" }]);
  }
  return null;
}

function askCatalogSlot(slotName) {
  return new Promise((resolve) => {
    const def = findSlotDef(slotName);
    if (!def) { resolve(undefined); return; } // K3b guarantees every referenced slot is catalogued
    addBotBubble(questionFor(def));
    const options = optionsForCatalogSlot(def);
    if (options) {
      addChips(options, (value) => {
        state.slots[slotName] = value;
        track('trackQuestionAnswered', slotName);
        resolve(value);
      });
    } else {
      addNumberPrompt(unitFor(def), true, (value) => {
        if (value !== undefined) state.slots[slotName] = value;
        track('trackQuestionAnswered', slotName);
        resolve(value);
      });
    }
  });
}

// Asks one subsidy_rule input — uses the rule's own prompt_hi/unit_hi
// (docs/DATA_SPEC.md §3), since explainer questions are often more
// specific to the scheme than the shared catalog wording would be.
// option values are resolved to labels via the shared catalog when the
// same slot exists there, so a citizen never sees a raw internal string.
function askExplainerInput(input) {
  return new Promise((resolve) => {
    const prompt = getLang() === 'en' && input.prompt_en ? input.prompt_en : input.prompt_hi;
    addBotBubble(prompt);
    if (Array.isArray(input.options)) {
      const catalogDef = findSlotDef(input.slot);
      const options = input.options.map((value) => {
        const known = catalogDef && Array.isArray(catalogDef.options)
          ? catalogDef.options.find((o) => o.value === value)
          : null;
        return known ? known : { value, label_hi: String(value) };
      });
      addChips(options, (value) => {
        state.slots[input.slot] = value;
        track('trackQuestionAnswered', input.slot);
        resolve(value);
      });
    } else {
      const unit = getLang() === 'en' && input.unit_en ? input.unit_en : input.unit_hi;
      addNumberPrompt(unit, !!input.required, (value) => {
        if (value !== undefined) state.slots[input.slot] = value;
        track('trackQuestionAnswered', input.slot);
        resolve(value);
      });
    }
  });
}

// K20: thumbs + reason chip, feeding S3's feedback_vote counter.
function renderFeedbackWidget() {
  const wrap = el('div', 'feedback-widget');
  const promptRow = el('div', langClass('feedback-prompt'), t('chat.feedback_prompt'));
  const thumbsRow = el('div', 'chips');
  wrap.appendChild(promptRow);
  wrap.appendChild(thumbsRow);

  function showReasons(direction) {
    thumbsRow.remove();
    promptRow.textContent = direction === 'up' ? t('chat.feedback_up_prompt') : t('chat.feedback_down_prompt');
    const reasonsRow = el('div', 'chips');
    FEEDBACK_REASONS[direction].forEach((reason) => {
      const btn = el('button', langClass('chip'), labelForOption(reason));
      btn.type = 'button';
      btn.addEventListener('click', () => {
        reasonsRow.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        track('trackFeedbackVote', direction, reason.value);
        promptRow.textContent = t('chat.thanks');
        reasonsRow.remove();
      });
      reasonsRow.appendChild(btn);
    });
    wrap.appendChild(reasonsRow);
  }

  const upBtn = el('button', langClass('chip'), '👍');
  const downBtn = el('button', langClass('chip'), '👎');
  upBtn.type = 'button';
  downBtn.type = 'button';
  upBtn.addEventListener('click', () => showReasons('up'));
  downBtn.addEventListener('click', () => showReasons('down'));
  thumbsRow.appendChild(upBtn);
  thumbsRow.appendChild(downBtn);

  return wrap;
}

function verdictIcon(verdict) {
  if (verdict === 'ELIGIBLE') return { icon: '✅', word: t('chat.verdict_eligible'), cls: 'bg-verdict' };
  if (verdict === 'NOT_ELIGIBLE') return { icon: '❌', word: t('chat.verdict_not_eligible'), cls: 'bg-halt' };
  return { icon: 'ℹ️', word: t('chat.verdict_need_info'), cls: 'bg-attention' };
}

function assembleForLang(verdict, scheme, evaluation) {
  return getLang() === 'en' ? assembleEn(verdict, scheme, evaluation) : assemble(verdict, scheme, evaluation);
}

function schemeNameFor(scheme) {
  return getLang() === 'en' && scheme.name_en ? scheme.name_en : scheme.name_hi;
}

function outputText(output) {
  return getLang() === 'en' ? (output.text_en || output.text_hi) : output.text_hi;
}

function docLabelFor(doc) {
  return getLang() === 'en' && doc.label_en ? doc.label_en : doc.label_hi;
}

function docWhereFor(doc) {
  return getLang() === 'en' && doc.where_to_get_en ? doc.where_to_get_en : doc.where_to_get_hi;
}

function renderVerdictCard(scheme, evaluation, output) {
  track('trackVerdictIssued', evaluation.verdict);
  track('trackSchemeSurfaced', scheme.scheme_id);
  const { icon, word, cls } = verdictIcon(evaluation.verdict);
  const card = el('div', langClass(`card ${cls}`));
  const head = el('div', 'card-head');
  head.appendChild(el('span', 'card-icon', icon));
  head.appendChild(el('span', 'card-word', word));
  card.appendChild(head);
  card.appendChild(el('div', 'answer-headline', schemeNameFor(scheme)));
  card.appendChild(el('p', '', outputText(output)));

  if (evaluation.verdict === 'ELIGIBLE' && scheme.documents && scheme.documents.length) {
    card.appendChild(el('p', 'doc-list-title', t('chat.documents_needed')));
    const list = el('ul', 'doc-list');
    scheme.documents.forEach((d) => {
      list.appendChild(el('li', '', `${docLabelFor(d)} — ${docWhereFor(d)}`));
    });
    card.appendChild(list);
  }

  if (output.citation) {
    card.appendChild(el('p', 'citation', `${t('chat.source')}: ${output.citation.url} · ${t('chat.verified_on')}: ${output.citation.last_verified}`));
  }

  if (evaluation.verdict === 'ELIGIBLE' && scheme.subsidy_rule) {
    const btn = el('button', langClass('button'), t('chat.know_subsidy_amount'));
    btn.type = 'button';
    btn.addEventListener('click', () => { btn.disabled = true; runExplainer(scheme); });
    card.appendChild(btn);
  }

  card.appendChild(renderFeedbackWidget());

  chatEl.appendChild(card);
  scrollToBottom();
}

async function resolveScheme(scheme) {
  let evaluation = evaluate(state.slots, scheme);
  let guard = 0;
  while (evaluation.verdict === 'NEED_MORE_INFO' && guard < 20) {
    const missing = evaluation.missing_slots.find((s) => state.slots[s] === undefined);
    if (!missing) break; // every missing slot was answered as null ("पता नहीं") — cannot resolve further
    await askCatalogSlot(missing);
    evaluation = evaluate(state.slots, scheme);
    guard += 1;
  }
  const output = assembleForLang(evaluation.verdict, scheme, evaluation);
  renderVerdictCard(scheme, evaluation, output);
}

function formatInr(n) {
  return `₹${n.toLocaleString('en-IN')}`;
}

// Renders the "आपने बताया: X · Y · Z" opening line from docs/DATA_SPEC.md
// §3.3's worked example — every value the citizen actually gave for this
// rule's own inputs, echoed back exactly as they gave it.
function describeStatedInputs(rule, slots) {
  const parts = [];
  for (const input of rule.inputs) {
    const value = slots[input.slot];
    if (value === undefined) continue;
    if (Array.isArray(input.options)) {
      const catalogDef = findSlotDef(input.slot);
      const known = catalogDef && catalogDef.options && catalogDef.options.find((o) => o.value === value);
      parts.push(known ? labelForOption(known) : String(value));
    } else {
      const shown = typeof value === 'number' ? value.toLocaleString('en-IN') : String(value);
      const unit = getLang() === 'en' && input.unit_en ? input.unit_en : input.unit_hi;
      parts.push(unit ? `${shown} ${unit}` : shown);
    }
  }
  return parts.join(' · ');
}

// One arithmetic line per term, in the same "X = Y" shape as the worked
// example — not just the answer, the working. Falls through to a plain
// "= ₹Z" for any derivation shape not explicitly recognised, since term
// types get added over time (docs/DATA_SPEC.md §3.1) and a term this
// module doesn't yet know how to narrate should still show its number
// rather than nothing.
function formatTermMath(node) {
  const amount = formatInr(node.value);
  const lang = getLang();
  if (node.from.kind === 'rule') return lang === 'en' ? `= ${amount} (fixed limit)` : `= ${amount} (तय सीमा)`;
  if (node.from.kind === 'derived') {
    const [a, b] = node.from.operands;
    if (node.from.op === 'percent_of') {
      return lang === 'en'
        ? `${a.value}% of ${formatInr(b.value)} = ${amount}`
        : `${formatInr(b.value)} का ${a.value}% = ${amount}`;
    }
    if (node.from.op === 'multiply') {
      return `${formatInr(a.value)} × ${b.value} = ${amount}`;
    }
  }
  return `= ${amount}`;
}

function combinePhrase(combineMode) {
  if (getLang() === 'en') {
    if (combineMode === 'min') return 'Rule: whichever is lower is payable.';
    if (combineMode === 'max') return 'Rule: whichever is higher is payable.';
    return 'Rule: the payable amount is the sum of every condition.';
  }
  if (combineMode === 'min') return 'नियम कहता है: जो भी कम हो, वही देय।';
  if (combineMode === 'max') return 'नियम कहता है: जो भी ज़्यादा हो, वही देय।';
  return 'नियम कहता है: सभी शर्तों को जोड़कर देय राशि तय होती है।';
}

// Which term's figure the combined result/bound actually came from — the
// worked example's "← शर्त 2 (अधिकतम दर सीमा) लागू हुई" annotation. Only
// meaningful for min/max (sum uses every computable term, not one winner).
function findBindingTerm(terms, combineMode, value) {
  if (combineMode === 'sum') return null;
  const computable = terms.filter((t) => t.value !== null);
  if (computable.length < 2) return null;
  return computable.find((t) => t.value.value === value) || null;
}

function termLabelFor(term) {
  return getLang() === 'en' && term.label_en ? term.label_en : term.label_hi;
}

function renderExplainerResult(scheme, output) {
  const rule = scheme.subsidy_rule;
  const lang = getLang();
  const card = el('div', langClass('card explainer-card'));
  card.appendChild(el('div', 'answer-headline', t('chat.subsidy_calculation')));

  const stated = describeStatedInputs(rule, state.slots);
  if (stated) card.appendChild(el('p', 'stated-inputs', `${t('chat.you_stated')}: ${stated}`));

  output.terms.forEach((term, i) => {
    card.appendChild(el('p', 'term-heading', `${t('chat.condition')} ${i + 1} — ${termLabelFor(term)}`));
    if (term.value) {
      card.appendChild(el('p', 'term-math', formatTermMath(term.value)));
    } else {
      const missingInputs = term.missing.map((slot) => rule.inputs.find((inp) => inp.slot === slot)).filter(Boolean);
      const missingPrompts = missingInputs.map((inp) => (lang === 'en' && inp.prompt_en ? inp.prompt_en : inp.prompt_hi));
      const warn = el('p', 'term-warning', `⚠ ${missingPrompts.join(' · ') || t('chat.need_more_info')}`);
      card.appendChild(warn);
      if (missingInputs.length) {
        const btn = el('button', langClass('chip'), t('chat.tell_now'));
        btn.type = 'button';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          for (const input of missingInputs) await askExplainerInput(input);
          runExplainer(scheme);
        });
        card.appendChild(btn);
      }
    }
  });

  if (output.status === 'OK') {
    card.appendChild(el('p', 'result-note', combinePhrase(rule.combine)));
    const binding = findBindingTerm(output.terms, rule.combine, output.result.value);
    const suffix = binding ? ` ← ${termLabelFor(binding)} ${t('chat.applied')}` : '';
    card.appendChild(el('p', 'result-line', `${t('chat.you_will_get')}: ${formatInr(output.result.value)}${suffix}`));
  } else if (output.status === 'PARTIAL' && output.bound) {
    const phrase = output.bound.type === 'upper' ? t('chat.max_you_could_get') : t('chat.min_you_will_get');
    card.appendChild(el('p', 'result-line', `${phrase}: ${formatInr(output.bound.value.value)}`));
    card.appendChild(el('p', 'result-note', t('chat.exact_amount_needs_more_info')));
  } else if (output.status === 'NEED_MORE_INFO') {
    card.appendChild(el('p', 'result-note', t('chat.amount_needs_more_info')));
  } else if (output.status === 'NOT_APPLICABLE') {
    card.appendChild(el('p', 'result-note', t('chat.calculation_not_applicable')));
  }

  if (output.citation && output.citation.source_url) {
    card.appendChild(el('p', 'citation', `${t('chat.source')}: ${output.citation.source_url} · ${t('chat.verified_on')}: ${output.citation.last_verified}`));
    if (rule.source_quote_hi) {
      const quoteLabel = lang === 'en' ? t('chat.original_hindi_text') : '';
      card.appendChild(el('p', 'source-quote', `${quoteLabel ? quoteLabel + ': ' : ''}"${rule.source_quote_hi}"`));
    }
  }

  chatEl.appendChild(card);
  scrollToBottom();
}

async function runExplainer(scheme) {
  const rule = scheme.subsidy_rule;
  for (const input of rule.inputs) {
    if (state.slots[input.slot] !== undefined) continue;
    if (!input.required) continue; // optional inputs (e.g. a quotation) stay unasked until the citizen opts in via "अभी बताएं"
    await askExplainerInput(input);
  }
  const output = explain(scheme, state.slots);
  try {
    assertDerivedFromSourced(output, scheme, state.slots);
  } catch (err) {
    // A guard-throw here means an internal bug, not a citizen data problem —
    // never shown as a raw error (CONTEXT.md: errors say what happened and
        // what to do next, never a raw status code).
    console.error('assertDerivedFromSourced failed:', err);
    addBotBubble(t('chat.calculation_error'));
    return;
  }
  renderExplainerResult(scheme, output);
}

async function runCoreSequence() {
  for (const slotName of state.slotsDoc.core_sequence) {
    if (state.slots[slotName] !== undefined) continue;
    await askCatalogSlot(slotName);
  }
}

// Hindi plural word-endings ("योजना" -> "योजनाएं", "है" -> "हैं") can't be
// produced by a generic {{n}}-substitution template, so this stays a
// dedicated function rather than an i18n.js STRINGS entry.
function eligibleCountIntro(n) {
  if (getLang() === 'en') return `${n} scheme${n > 1 ? 's' : ''} look${n > 1 ? '' : 's'} suitable for you:`;
  return `${n} योजना${n > 1 ? 'एं' : ''} आपके लिए उपयुक्त लग रही ${n > 1 ? 'हैं' : 'है'}:`;
}

// T2: agriculture results first, related-welfare results in their own
// clearly-labelled group below — reads scheme.scheme_group off the data,
// never a hard-coded scheme_id list.
function splitByGroup(rows) {
  return {
    agriculture: rows.filter((r) => r.scheme.scheme_group === 'agriculture'),
    relatedWelfare: rows.filter((r) => r.scheme.scheme_group === 'related_welfare'),
  };
}

async function runDiscovery() {
  addBotBubble(t('chat.discovery_start'));
  await runCoreSequence();
  const results = evaluateAll(state.slots, state.schemes);
  const eligible = results.filter((r) => r.evaluation.verdict === 'ELIGIBLE');
  const needInfo = results.filter((r) => r.evaluation.verdict === 'NEED_MORE_INFO');

  if (eligible.length === 0 && needInfo.length === 0) {
    addBotBubble(t('chat.no_scheme_found'));
    return;
  }

  if (eligible.length > 0) {
    addBotBubble(eligibleCountIntro(eligible.length));
    const grouped = splitByGroup(eligible);
    if (grouped.agriculture.length > 0) {
      addBotBubble(t('schemes.agriculture_heading'));
      for (const { scheme, evaluation } of grouped.agriculture) {
        const output = assembleForLang('ELIGIBLE', scheme, evaluation);
        renderVerdictCard(scheme, evaluation, output);
      }
    }
    if (grouped.relatedWelfare.length > 0) {
      addBotBubble(t('schemes.related_welfare_heading'));
      for (const { scheme, evaluation } of grouped.relatedWelfare) {
        const output = assembleForLang('ELIGIBLE', scheme, evaluation);
        renderVerdictCard(scheme, evaluation, output);
      }
    }
  }

  if (needInfo.length > 0) {
    addBotBubble(t('chat.need_info_intro'));
    const grouped = splitByGroup(needInfo);
    const renderGroup = (rows, headingKey) => {
      if (rows.length === 0) return;
      chatEl.appendChild(el('p', langClass('doc-list-title'), t(headingKey)));
      const list = el('ul', langClass('doc-list'));
      rows.forEach(({ scheme }) => {
        track('trackSchemeSurfaced', scheme.scheme_id);
        list.appendChild(el('li', '', schemeNameFor(scheme)));
      });
      chatEl.appendChild(list);
    };
    renderGroup(grouped.agriculture, 'schemes.agriculture_heading');
    renderGroup(grouped.relatedWelfare, 'schemes.related_welfare_heading');
    scrollToBottom();
  }
}

async function handleRouteResult(result) {
  if (result.intent === 'discover') {
    await runDiscovery();
  } else if (result.intent === 'scheme_query') {
    for (const id of result.scheme_ids) {
      const scheme = state.schemes.find((s) => s.scheme_id === id);
      if (scheme) await resolveScheme(scheme);
    }
  } else {
    addBotBubble(t('chat.unknown_query'));
  }
}

// Routes a query without rendering the citizen's own text — the caller is
// responsible for that, since a chip tap (addChips) already renders it and
// must not show it twice.
async function routeQuery(text) {
  const { normalised } = normalise(text, state.lexicon);
  const result = route(normalised, state.schemes);
  await handleRouteResult(result);
}

function renderSampleChips(samples) {
  const shown = samples.slice(0, FALLBACK_SAMPLE_COUNT);
  addBotBubble(t('chat.samples_intro'));
  addChips(shown.map((s) => ({ value: s.query_hi, label_hi: s.query_hi })), (query) => {
    routeQuery(query);
  });
}

async function loadJSON(relativePath) {
  const response = await fetch(resolvePath(relativePath));
  return response.json();
}

function applyComposerLabels() {
  const label = document.querySelector('label[for="query-input"]');
  if (label) label.textContent = t('index.query_label');
  queryInputEl.placeholder = t('index.query_placeholder');
  const sendBtn = composerEl.querySelector('button[type="submit"]');
  if (sendBtn) sendBtn.textContent = t('index.send');
  discoverBtnEl.textContent = t('index.discover_btn');
}

async function init() {
  const [registry, slotsDoc, lexicon, samplesDoc] = await Promise.all([
    loadSchemeRegistry(),
    loadJSON('data/slots.json'),
    loadJSON('data/lexicon.json'),
    loadJSON('data/samples.json'),
  ]);
  state.schemes = registry.schemes;
  state.slotsDoc = slotsDoc;
  state.lexicon = lexicon;

  track('trackPageView', location.pathname);

  applyComposerLabels();
  window.addEventListener('kisan:langchange', applyComposerLabels);

  // K15: pages/schemes/ links a scheme straight into this flow via
  // ?scheme=RJ_X, so the catalogue page isn't a dead end. Falls straight
  // through to the normal welcome message if the id is missing or wrong
  // — a bad link degrades to the default experience, never to nothing.
  const requestedSchemeId = new URLSearchParams(location.search).get('scheme');
  const requestedScheme = requestedSchemeId && state.schemes.find((s) => s.scheme_id === requestedSchemeId);
  if (requestedScheme) {
    addBotBubble(t('chat.checking_eligibility_for').replace('{{scheme}}', schemeNameFor(requestedScheme)));
    resolveScheme(requestedScheme);
  } else {
    addBotBubble(t('chat.greeting'));
    renderSampleChips(samplesDoc.samples || []);
  }

  composerEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = queryInputEl.value.trim();
    if (!text) return;
    queryInputEl.value = '';
    addUserBubble(text);
    routeQuery(text);
  });

  discoverBtnEl.addEventListener('click', () => {
    discoverBtnEl.disabled = true;
    runDiscovery();
  });
}

init();
