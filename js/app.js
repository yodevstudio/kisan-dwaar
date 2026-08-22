import { resolvePath } from './paths.js';
import { normalise } from './normalise.js';
import { route, RAJASTHAN_DISTRICTS } from './router.js';
import { evaluate, evaluateAll } from './eligibility.js';
import { assemble } from './assemble.js';
import { explain, assertDerivedFromSourced } from './explainer.js';

// K5: presentation only — every verdict, every rupee figure and every
// missing-slot prompt below comes from eligibility.js / assemble.js /
// explainer.js exactly as K1/K4 built and tested them. This module adds
// no scoring, no eligibility logic and no arithmetic of its own.

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
  const bubble = el('div', 'bubble bubble-bot hi', text);
  chatEl.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function addUserBubble(text) {
  const bubble = el('div', 'bubble bubble-user hi', text);
  chatEl.appendChild(bubble);
  scrollToBottom();
}

function addChips(options, onPick) {
  const wrap = el('div', 'chips');
  options.forEach((opt) => {
    const btn = el('button', 'chip hi', opt.label_hi);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      addUserBubble(opt.value === null ? 'पता नहीं' : opt.label_hi);
      onPick(opt.value);
    });
    wrap.appendChild(btn);
  });
  chatEl.appendChild(wrap);
  scrollToBottom();
}

function addNumberPrompt(unitHi, required, onSubmit) {
  const wrap = el('div', 'chips');
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'hi number-input';
  input.min = '0';
  input.step = 'any';
  if (unitHi) input.placeholder = unitHi;
  const done = () => {
    const raw = input.value.trim();
    wrap.querySelectorAll('input,button').forEach((n) => { n.disabled = true; });
    if (raw === '') {
      addUserBubble('छोड़ दिया');
      onSubmit(undefined);
      return;
    }
    addUserBubble(unitHi ? `${raw} ${unitHi}` : raw);
    onSubmit(Number(raw));
  };
  const submit = el('button', 'chip hi', 'ठीक है');
  submit.type = 'button';
  submit.addEventListener('click', done);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
  wrap.appendChild(input);
  wrap.appendChild(submit);
  if (!required) {
    const skip = el('button', 'chip chip-secondary hi', 'छोड़ें');
    skip.type = 'button';
    skip.addEventListener('click', () => {
      wrap.querySelectorAll('input,button').forEach((n) => { n.disabled = true; });
      addUserBubble('छोड़ दिया');
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

// Asks one question from data/slots.json's catalogue — the shared,
// discovery-flow wording every scheme's eligibility conditions share.
// district_select carries no inline options — data/slots.json's own note on
// that slot says it's "populated from the Rajasthan district list in
// router.js", so RAJASTHAN_DISTRICTS is the single source for these chips,
// the same list router.js itself matches typed district names against.
function optionsForCatalogSlot(def) {
  if (Array.isArray(def.options)) return def.options;
  if (def.type === 'district_select') {
    return [...RAJASTHAN_DISTRICTS].sort((a, b) => a.localeCompare(b, 'hi'))
      .map((d) => ({ value: d, label_hi: d }))
      .concat([{ value: null, label_hi: 'पता नहीं' }]);
  }
  return null;
}

function askCatalogSlot(slotName) {
  return new Promise((resolve) => {
    const def = findSlotDef(slotName);
    if (!def) { resolve(undefined); return; } // K3b guarantees every referenced slot is catalogued
    addBotBubble(def.question_hi);
    const options = optionsForCatalogSlot(def);
    if (options) {
      addChips(options, (value) => {
        state.slots[slotName] = value;
        resolve(value);
      });
    } else {
      addNumberPrompt(def.unit_hi, true, (value) => {
        if (value !== undefined) state.slots[slotName] = value;
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
    addBotBubble(input.prompt_hi);
    if (Array.isArray(input.options)) {
      const catalogDef = findSlotDef(input.slot);
      const options = input.options.map((value) => {
        const known = catalogDef && Array.isArray(catalogDef.options)
          ? catalogDef.options.find((o) => o.value === value)
          : null;
        return { value, label_hi: known ? known.label_hi : String(value) };
      });
      addChips(options, (value) => {
        state.slots[input.slot] = value;
        resolve(value);
      });
    } else {
      addNumberPrompt(input.unit_hi, !!input.required, (value) => {
        if (value !== undefined) state.slots[input.slot] = value;
        resolve(value);
      });
    }
  });
}

function verdictIcon(verdict) {
  if (verdict === 'ELIGIBLE') return { icon: '✅', word: 'पात्र', cls: 'bg-verdict' };
  if (verdict === 'NOT_ELIGIBLE') return { icon: '❌', word: 'अपात्र', cls: 'bg-halt' };
  return { icon: 'ℹ️', word: 'जानकारी चाहिए', cls: 'bg-attention' };
}

function renderVerdictCard(scheme, evaluation, output) {
  const { icon, word, cls } = verdictIcon(evaluation.verdict);
  const card = el('div', `card ${cls} hi`);
  const head = el('div', 'card-head');
  head.appendChild(el('span', 'card-icon', icon));
  head.appendChild(el('span', 'card-word', word));
  card.appendChild(head);
  card.appendChild(el('div', 'answer-headline', scheme.name_hi));
  card.appendChild(el('p', '', output.text_hi));

  if (evaluation.verdict === 'ELIGIBLE' && scheme.documents && scheme.documents.length) {
    card.appendChild(el('p', 'doc-list-title', 'ज़रूरी दस्तावेज़:'));
    const list = el('ul', 'doc-list');
    scheme.documents.forEach((d) => {
      list.appendChild(el('li', '', `${d.label_hi} — ${d.where_to_get_hi}`));
    });
    card.appendChild(list);
  }

  if (output.citation) {
    card.appendChild(el('p', 'citation', `स्रोत: ${output.citation.url} · जाँचा गया: ${output.citation.last_verified}`));
  }

  if (evaluation.verdict === 'ELIGIBLE' && scheme.subsidy_rule) {
    const btn = el('button', 'button hi', 'अनुदान राशि जानें');
    btn.type = 'button';
    btn.addEventListener('click', () => { btn.disabled = true; runExplainer(scheme); });
    card.appendChild(btn);
  }

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
  const output = assemble(evaluation.verdict, scheme, evaluation);
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
      parts.push(known ? known.label_hi : String(value));
    } else {
      const shown = typeof value === 'number' ? value.toLocaleString('en-IN') : String(value);
      parts.push(input.unit_hi ? `${shown} ${input.unit_hi}` : shown);
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
  if (node.from.kind === 'rule') return `= ${amount} (तय सीमा)`;
  if (node.from.kind === 'derived') {
    const [a, b] = node.from.operands;
    if (node.from.op === 'percent_of') {
      return `${formatInr(b.value)} का ${a.value}% = ${amount}`;
    }
    if (node.from.op === 'multiply') {
      return `${formatInr(a.value)} × ${b.value} = ${amount}`;
    }
  }
  return `= ${amount}`;
}

function combinePhrase(combineMode) {
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

function renderExplainerResult(scheme, output) {
  const rule = scheme.subsidy_rule;
  const card = el('div', 'card explainer-card hi');
  card.appendChild(el('div', 'answer-headline', 'अनुदान की गणना'));

  const stated = describeStatedInputs(rule, state.slots);
  if (stated) card.appendChild(el('p', 'stated-inputs', `आपने बताया: ${stated}`));

  output.terms.forEach((term, i) => {
    card.appendChild(el('p', 'term-heading', `शर्त ${i + 1} — ${term.label_hi}`));
    if (term.value) {
      card.appendChild(el('p', 'term-math', formatTermMath(term.value)));
    } else {
      const missingInputs = term.missing.map((slot) => rule.inputs.find((inp) => inp.slot === slot)).filter(Boolean);
      const warn = el('p', 'term-warning', `⚠ ${missingInputs.map((inp) => inp.prompt_hi).join(' · ') || 'जानकारी चाहिए'}`);
      card.appendChild(warn);
      if (missingInputs.length) {
        const btn = el('button', 'chip hi', 'अभी बताएं');
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
    const suffix = binding ? ` ← ${binding.label_hi} लागू हुई` : '';
    card.appendChild(el('p', 'result-line', `आपको मिलेगा: ${formatInr(output.result.value)}${suffix}`));
  } else if (output.status === 'PARTIAL' && output.bound) {
    const phrase = output.bound.type === 'upper' ? 'आपको अधिकतम मिल सकता है' : 'आपको कम से कम मिलेगा';
    card.appendChild(el('p', 'result-line', `${phrase}: ${formatInr(output.bound.value.value)}`));
    card.appendChild(el('p', 'result-note', 'सही राशि ऊपर बताई गई जानकारी दिए बिना नहीं बताई जा सकती।'));
  } else if (output.status === 'NEED_MORE_INFO') {
    card.appendChild(el('p', 'result-note', 'राशि बताने के लिए अभी पर्याप्त जानकारी नहीं है।'));
  } else if (output.status === 'NOT_APPLICABLE') {
    card.appendChild(el('p', 'result-note', 'यह गणना इस स्थिति पर लागू नहीं होती।'));
  }

  if (output.citation && output.citation.source_url) {
    card.appendChild(el('p', 'citation', `स्रोत: ${output.citation.source_url} · जाँचा गया: ${output.citation.last_verified}`));
    if (rule.source_quote_hi) {
      card.appendChild(el('p', 'source-quote', `"${rule.source_quote_hi}"`));
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
    addBotBubble('माफ़ कीजिए, गणना में एक समस्या आई। नज़दीकी ई-मित्र पर सही राशि पूछें।');
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

async function runDiscovery() {
  addBotBubble('ठीक है, कुछ सवाल पूछता हूँ ताकि आपके लिए सही योजनाएं ढूंढ सकूं।');
  await runCoreSequence();
  const results = evaluateAll(state.slots, state.schemes);
  const eligible = results.filter((r) => r.evaluation.verdict === 'ELIGIBLE');
  const needInfo = results.filter((r) => r.evaluation.verdict === 'NEED_MORE_INFO');

  if (eligible.length === 0 && needInfo.length === 0) {
    addBotBubble('दिए गए विवरण के अनुसार, फिलहाल कोई योजना आपके लिए उपयुक्त नहीं लग रही। नज़दीकी ई-मित्र पर पूरी जानकारी के लिए पूछें।');
    return;
  }

  if (eligible.length > 0) {
    addBotBubble(`${eligible.length} योजना${eligible.length > 1 ? 'एं' : ''} आपके लिए उपयुक्त लग रही ${eligible.length > 1 ? 'हैं' : 'है'}:`);
    for (const { scheme, evaluation } of eligible) {
      const output = assemble('ELIGIBLE', scheme, evaluation);
      renderVerdictCard(scheme, evaluation, output);
    }
  }

  if (needInfo.length > 0) {
    addBotBubble('इनके लिए थोड़ी और जानकारी चाहिए — किसी एक का नाम टाइप करके पूछें:');
    const list = el('ul', 'doc-list hi');
    needInfo.forEach(({ scheme }) => list.appendChild(el('li', '', scheme.name_hi)));
    chatEl.appendChild(list);
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
    addBotBubble('मेरे पास इसकी पक्की जानकारी नहीं है। "सभी योजनाएं देखें" दबाएं, या नज़दीकी ई-मित्र से पूछें।');
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
  addBotBubble('कुछ उदाहरण, आज़माने के लिए:');
  addChips(shown.map((s) => ({ value: s.query_hi, label_hi: s.query_hi })), (query) => {
    routeQuery(query);
  });
}

async function loadJSON(relativePath) {
  const response = await fetch(resolvePath(relativePath));
  return response.json();
}

async function init() {
  const [schemes, slotsDoc, lexicon, samplesDoc] = await Promise.all([
    loadJSON('data/schemes.json'),
    loadJSON('data/slots.json'),
    loadJSON('data/lexicon.json'),
    loadJSON('data/samples.json'),
  ]);
  state.schemes = schemes;
  state.slotsDoc = slotsDoc;
  state.lexicon = lexicon;

  addBotBubble('नमस्ते! मैं किसान द्वार हूं — राजस्थान की कृषि योजनाओं के लिए। आप अपना सवाल टाइप कर सकते हैं, या "सभी योजनाएं देखें" दबा सकते हैं।');
  renderSampleChips(samplesDoc.samples || []);

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
