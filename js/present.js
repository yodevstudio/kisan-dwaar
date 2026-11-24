// Presentation helpers shared by the verdict card, the audit panel, the
// subsidy-explainer card and the printable preparation slip. Static core:
// no DOM, no service call, no dependency beyond the other core modules, and
// no arithmetic of its own — every verdict, rupee figure and sentence below
// is read off evaluate() / assemble() / explain() output or off the scheme
// record, then formatted.
//
// Everything takes `lang` ('hi' | 'en') as an argument rather than reading
// the UI language itself, so the slip can print Hindi with English beneath
// it in one pass and a test can run it without a browser UI.

import { formatRangeValue, parseBounds } from './eligibility.js';
import { assemble, assembleEn, labelFor, labelForEn } from './assemble.js';
import { tIn } from './i18n.js';
import { EMITRA_PORTAL_URL } from './policy.js';

// ===== slot values, as the audit panel shows them =====

export function slotLabel(slot, lang) {
  return lang === 'en' ? labelForEn(slot) : labelFor(slot);
}

function optionLabel(opt, lang) {
  return lang === 'en' && opt.label_en ? opt.label_en : opt.label_hi;
}

export function findSlotDef(slotsDoc, slot) {
  return ((slotsDoc && slotsDoc.slots) || []).find((s) => s.slot === slot);
}

export function questionIn(def, lang) {
  return lang === 'en' && def.question_en ? def.question_en : def.question_hi;
}

// Projects an already-known slot value for display — never recomputes
// anything, just formats a value evaluate()'s clauses already carried.
export function formatSlotValue(slot, value, lang, slotsDoc) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !Array.isArray(value) && ('min' in value || 'max' in value)) {
    return formatRangeValue(value);
  }
  const def = findSlotDef(slotsDoc, slot);
  if (def && Array.isArray(def.options)) {
    const opt = def.options.find((o) => o.value === value);
    if (opt) return optionLabel(opt, lang);
  }
  return typeof value === 'number' ? value.toLocaleString('en-IN') : String(value);
}

// eligibility.js's own opLabelFor/formatReason are Hindi-only by design
// (matching evaluation.reasons, which the Hindi panel uses verbatim) —
// English needs its own mirror, built from the same clause fields
// evaluate() already returns, not a re-evaluation.
function isWildcardValue(value) {
  return value === '*' || (Array.isArray(value) && value.includes('*'));
}

function opLabelForEn(op, value) {
  switch (op) {
    case 'in': return `must be one of: [${value.join(', ')}]`;
    case 'gte': return `must be >= ${value}`;
    case 'lte': return `must be <= ${value}`;
    case 'eq': return `must be = ${value}`;
    case 'between': {
      const { min, max } = parseBounds(value);
      return `must be between ${min} and ${max}`;
    }
    default: return '';
  }
}

function clauseResultSuffixEn(clause) {
  if (clause.result === 'unknown') return 'information needed';
  if (clause.kind === 'exclusion') return clause.result ? 'exclusion applies (not eligible)' : 'exclusion does not apply (ok)';
  return clause.result ? 'condition met' : 'condition failed';
}

export function clauseLineEn(clause, slotsDoc) {
  const label = slotLabel(clause.slot, 'en');
  if (clause.result === 'unknown') return `${label}: not yet stated — ${clauseResultSuffixEn(clause)}`;
  const requirement = isWildcardValue(clause.required) ? '(no specific condition)' : opLabelForEn(clause.op, clause.required);
  const actualText = formatSlotValue(clause.slot, clause.actual, 'en', slotsDoc);
  return `${label}: stated ${actualText}, ${requirement} — ${clauseResultSuffixEn(clause)}`;
}

// आपने बताया — every slot the citizen has answered that this scheme's
// conditions actually reference, deduped by slot (a gender-branched any_of
// can reference the same slot twice). Reads clause.actual directly, so it
// can never show a value this scheme's own evaluation didn't already see.
export function statedEntries(evaluation, lang, slotsDoc) {
  const seen = new Map();
  evaluation.clauses.forEach((c) => {
    if (c.actual === null || c.actual === undefined) return;
    if (!seen.has(c.slot)) seen.set(c.slot, c.actual);
  });
  return [...seen].map(([slot, value]) => `${slotLabel(slot, lang)}: ${formatSlotValue(slot, value, lang, slotsDoc)}`);
}

// नियम क्या कहता है — every clause evaluate() actually checked. Hindi uses
// evaluation.reasons verbatim; English is built from evaluation.clauses.
// Both walk the same leaves in the same order, so index i is the same clause
// in either language.
export function ruleLines(evaluation, lang, slotsDoc) {
  if (lang === 'en') return evaluation.clauses.map((c) => clauseLineEn(c, slotsDoc));
  return evaluation.reasons.slice();
}

// What is still unknown: each missing slot with its catalogue question.
export function missingEntries(evaluation, lang, slotsDoc) {
  return evaluation.missing_slots.map((slot) => {
    const def = findSlotDef(slotsDoc, slot);
    const question = def ? questionIn(def, lang) : slotLabel(slot, lang);
    return `${slotLabel(slot, lang)} — ${question}`;
  });
}

// ===== subsidy explainer, as the explainer card shows it =====

export function formatInr(n) {
  return `₹${n.toLocaleString('en-IN')}`;
}

// Renders the "आपने बताया: X · Y · Z" opening line — every value the
// citizen actually gave for this rule's own inputs, echoed back as given.
export function describeStatedInputs(rule, slots, lang, slotsDoc) {
  const parts = [];
  for (const input of rule.inputs) {
    const value = slots[input.slot];
    if (value === undefined) continue;
    if (Array.isArray(input.options)) {
      const catalogDef = findSlotDef(slotsDoc, input.slot);
      const known = catalogDef && catalogDef.options && catalogDef.options.find((o) => o.value === value);
      parts.push(known ? optionLabel(known, lang) : String(value));
    } else {
      const shown = typeof value === 'number' ? value.toLocaleString('en-IN') : String(value);
      const unit = lang === 'en' && input.unit_en ? input.unit_en : input.unit_hi;
      parts.push(unit ? `${shown} ${unit}` : shown);
    }
  }
  return parts.join(' · ');
}

// One arithmetic line per term, in "X = Y" shape — not just the answer, the
// working. Falls through to a plain "= ₹Z" for any derivation shape not
// explicitly recognised, so a term this module can't narrate still shows its
// number rather than nothing.
export function formatTermMath(node, lang) {
  const amount = formatInr(node.value);
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

export function combinePhrase(combineMode, lang) {
  if (lang === 'en') {
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
  const computable = terms.filter((term) => term.value !== null);
  if (computable.length < 2) return null;
  return computable.find((term) => term.value.value === value) || null;
}

function termLabel(term, lang) {
  return lang === 'en' && term.label_en ? term.label_en : term.label_hi;
}

// A figure above a unit cap is trimmed to the cap by explainer.js; this
// names that using the cap's own published wording, nothing composed here.
export function unitCapNotices(rule, slots, lang) {
  const out = [];
  Object.entries(rule.unit_caps || {}).forEach(([slot, cap]) => {
    const citizenValue = slots[slot];
    if (typeof citizenValue !== 'number' || typeof cap.max !== 'number' || citizenValue <= cap.max) return;
    out.push(`⚠ ${lang === 'en' && cap.label_en ? cap.label_en : cap.label_hi}`);
  });
  return out;
}

// One entry per term: its heading, then either its working (math) or what
// is still missing (warning + the inputs to ask for).
export function explainerTermEntries(rule, output, lang) {
  return output.terms.map((term, i) => {
    const heading = `${tIn('chat.condition', lang)} ${i + 1} — ${termLabel(term, lang)}`;
    if (term.value) return { heading, math: formatTermMath(term.value, lang), warning: null, missingInputs: [] };
    const missingInputs = term.missing.map((slot) => rule.inputs.find((inp) => inp.slot === slot)).filter(Boolean);
    const prompts = missingInputs.map((inp) => (lang === 'en' && inp.prompt_en ? inp.prompt_en : inp.prompt_hi));
    return { heading, math: null, warning: `⚠ ${prompts.join(' · ') || tIn('chat.need_more_info', lang)}`, missingInputs };
  });
}

// The result lines under the terms, in order. `cls` is the card's own CSS
// class for that line.
export function explainerResultParts(rule, output, lang) {
  const parts = [];
  if (output.status === 'OK') {
    parts.push({ cls: 'result-note', text: combinePhrase(rule.combine, lang) });
    const binding = findBindingTerm(output.terms, rule.combine, output.result.value);
    const suffix = binding ? ` ← ${termLabel(binding, lang)} ${tIn('chat.applied', lang)}` : '';
    parts.push({ cls: 'result-line', text: `${tIn('chat.you_will_get', lang)}: ${formatInr(output.result.value)}${suffix}` });
  } else if (output.status === 'PARTIAL' && output.bound) {
    const phrase = output.bound.type === 'upper' ? tIn('chat.max_you_could_get', lang) : tIn('chat.min_you_will_get', lang);
    parts.push({ cls: 'result-line', text: `${phrase}: ${formatInr(output.bound.value.value)}` });
    parts.push({ cls: 'result-note', text: tIn('chat.exact_amount_needs_more_info', lang) });
  } else if (output.status === 'NEED_MORE_INFO') {
    parts.push({ cls: 'result-note', text: tIn('chat.amount_needs_more_info', lang) });
  } else if (output.status === 'NOT_APPLICABLE') {
    parts.push({ cls: 'result-note', text: tIn('chat.calculation_not_applicable', lang) });
  }
  return parts;
}

// ===== preparation slip =====
//
// buildSlipModel returns plain data; js/app.js turns it into DOM inside
// #print-area. Every text is an array with one string per printed language —
// ['हिंदी'] when the UI is Hindi, ['हिंदी', 'English'] when it is English —
// so the page prints Hindi first with English directly beneath it.

const VERDICT_ICON = { ELIGIBLE: '✅', NEED_MORE_INFO: 'ℹ️' };
const VERDICT_KEY = { ELIGIBLE: 'chat.verdict_eligible', NEED_MORE_INFO: 'chat.verdict_need_info' };

function schemeNameIn(scheme, lang) {
  return lang === 'en' && scheme.name_en ? scheme.name_en : scheme.name_hi;
}

function docLabelIn(doc, lang) {
  if (typeof doc === 'string') return doc;
  return lang === 'en' && doc.label_en ? doc.label_en : doc.label_hi;
}

function docWhereIn(doc, lang) {
  if (typeof doc === 'string') return '';
  return lang === 'en' && doc.where_to_get_en ? doc.where_to_get_en : doc.where_to_get_hi;
}

// Lists that are the same length in every language (one item per slot, per
// document, per clause) are zipped into one entry per item, each a
// per-language array.
function zip(listsPerLang) {
  const n = Math.max(0, ...listsPerLang.map((l) => l.length));
  const entries = [];
  for (let i = 0; i < n; i += 1) {
    entries.push({ text: listsPerLang.map((l) => l[i]).filter((s) => s !== undefined && s !== null && s !== '') });
  }
  return entries;
}

export function slipLangs(uiLang) {
  return uiLang === 'en' ? ['hi', 'en'] : ['hi'];
}

// scheme, evaluation: the verdict card's own. slots/slotsDoc: the citizen's
// answers and the slot catalogue. explainerRun: { output, slots } exactly as
// explain() returned it for this scheme (after assertDerivedFromSourced), or
// null if the citizen never ran the subsidy calculation — never recomputed here.
export function buildSlipModel({ scheme, evaluation, slotsDoc, uiLang, explainerRun }) {
  if (evaluation.verdict !== 'ELIGIBLE' && evaluation.verdict !== 'NEED_MORE_INFO') return null;
  const langs = slipLangs(uiLang);
  const per = (fn) => langs.map(fn);
  const heading = (key) => per((l) => tIn(key, l));

  const outputs = {
    hi: assemble(evaluation.verdict, scheme, evaluation),
    en: assembleEn(evaluation.verdict, scheme, evaluation),
  };
  const sentence = per((l) => (l === 'en' ? (outputs.en.text_en || outputs.en.text_hi) : outputs.hi.text_hi));

  const sections = [];

  const stated = langs.map((l) => statedEntries(evaluation, l, slotsDoc));
  sections.push({
    id: 'stated',
    heading: heading('slip.stated'),
    entries: stated[0].length ? zip(stated) : [{ text: per((l) => tIn('chat.audit_none_stated', l)) }],
  });

  sections.push({
    id: 'rule',
    heading: heading('slip.rule'),
    entries: zip(langs.map((l) => ruleLines(evaluation, l, slotsDoc))),
  });

  if (evaluation.verdict === 'NEED_MORE_INFO') {
    sections.push({
      id: 'unknown',
      heading: heading('slip.still_unknown'),
      entries: zip(langs.map((l) => missingEntries(evaluation, l, slotsDoc))),
    });
  }

  const docs = scheme.documents || [];
  if (docs.length) {
    sections.push({
      id: 'documents',
      heading: heading('slip.documents'),
      checkbox: true,
      entries: zip(langs.map((l) => docs.map((d) => {
        const where = docWhereIn(d, l);
        return where ? `${docLabelIn(d, l)} — ${where}` : docLabelIn(d, l);
      }))),
    });
  }

  const run = evaluation.verdict === 'ELIGIBLE' && explainerRun && explainerRun.output && scheme.subsidy_rule
    && explainerRun.output.status !== 'NO_RULE' ? explainerRun : null;
  if (run) {
    const rule = scheme.subsidy_rule;
    const entries = [];
    const statedLine = langs.map((l) => describeStatedInputs(rule, run.slots, l, slotsDoc));
    if (statedLine[0]) entries.push({ text: langs.map((l, i) => `${tIn('slip.stated', l)}: ${statedLine[i]}`) });
    zip(langs.map((l) => unitCapNotices(rule, run.slots, l))).forEach((e) => entries.push(e));
    const termsPerLang = langs.map((l) => explainerTermEntries(rule, run.output, l));
    termsPerLang[0].forEach((_, i) => {
      entries.push({ text: termsPerLang.map((ts) => ts[i].heading), strong: true });
      if (termsPerLang[0][i].math) entries.push({ text: termsPerLang.map((ts) => ts[i].math) });
      else entries.push({ text: termsPerLang.map((ts) => ts[i].warning) });
    });
    const resultsPerLang = langs.map((l) => explainerResultParts(rule, run.output, l));
    resultsPerLang[0].forEach((part, i) => {
      entries.push({ text: resultsPerLang.map((rs) => rs[i].text), strong: part.cls === 'result-line' });
    });
    sections.push({ id: 'subsidy', heading: heading('slip.subsidy'), entries });
  }

  const sourceEntries = [];
  const citation = outputs.hi.citation;
  if (citation) {
    sourceEntries.push({ text: [citation.url] });
    sourceEntries.push({ text: per((l) => `${tIn('slip.verified_on', l)}: ${citation.last_verified}`) });
  }
  const ruleCitation = run && run.output.citation;
  if (ruleCitation && ruleCitation.source_url && (!citation || ruleCitation.source_url !== citation.url)) {
    sourceEntries.push({ text: [ruleCitation.source_url] });
    sourceEntries.push({ text: per((l) => `${tIn('slip.verified_on', l)}: ${ruleCitation.last_verified}`) });
  }
  if (sourceEntries.length) sections.push({ id: 'source', heading: heading('slip.source'), entries: sourceEntries });

  // A printed link cannot be tapped, so the address is printed out in full.
  sections.push({
    id: 'next',
    heading: heading('slip.next_step'),
    entries: [
      { text: per((l) => `${tIn('documents.emitra_before', l)}${tIn('common.emitra_link_label', l)}${tIn('documents.emitra_after', l)}`) },
      { text: [EMITRA_PORTAL_URL] },
    ],
  });

  return {
    langs,
    title: heading('slip.title'),
    scheme: per((l) => schemeNameIn(scheme, l)),
    verdict: { kind: evaluation.verdict, icon: VERDICT_ICON[evaluation.verdict], word: per((l) => tIn(VERDICT_KEY[evaluation.verdict], l)) },
    sentence,
    sections,
    footer: heading('slip.footer'),
  };
}

// Every string the slip will print, flattened — for the digit tripwire test.
export function slipStrings(model) {
  const out = [...model.title, ...model.scheme, model.verdict.icon, ...model.verdict.word, ...model.sentence, ...model.footer];
  model.sections.forEach((s) => {
    out.push(...s.heading);
    s.entries.forEach((e) => out.push(...e.text));
  });
  return out;
}

// Speech for the verdict card's Listen button: the verdict sentence, then
// the document list when the card shows one. Plain strings already on the
// card — nothing composed beyond joining them.
export function verdictSpeechText(sentence, docLabels, lang) {
  if (!docLabels || docLabels.length === 0) return sentence;
  const stop = /[.।]\s*$/.test(sentence) ? '' : '.';
  return `${sentence}${stop} ${tIn('chat.documents_needed', lang)} ${docLabels.join(', ')}`;
}
