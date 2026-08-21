import { evaluate } from './eligibility.js';

// A subsidy_rule's terms compute a rupee figure from a mix of published
// constants and citizen-supplied inputs (docs/DATA_SPEC.md §3). Every
// number this module produces carries {value, from} so assertDerivedFromSourced
// below can re-derive it from scratch — the arithmetic guard CONTEXT.md
// calls Guard 2. Three provenance kinds, matching the guard's own
// description: {kind:'rule', path} — a location inside the scheme object,
// re-resolved; {kind:'input', slot} — a citizen-supplied slot, re-checked;
// {kind:'derived', op, operands} — recomputed from its (recursively
// verified) operands. `path` is an array of keys, not a dotted string, so
// resolution never depends on re-parsing punctuation.

function ruleNumber(value, path) {
  return { value, from: { kind: 'rule', path } };
}

function inputNumber(value, slot) {
  return { value, from: { kind: 'input', slot } };
}

function derivedNumber(value, op, operands) {
  return { value, from: { kind: 'derived', op, operands } };
}

function resolvePath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[key];
  }
  return cur;
}

// The one place every derived figure's arithmetic lives — used both when a
// term first computes a value and when assertDerivedFromSourced re-derives
// it, so the two can never quietly diverge. Money is rounded to the rupee
// at the point of derivation, not after, so re-deriving the same operands
// always reproduces the exact same integer.
function applyOp(op, values) {
  switch (op) {
    // [percentNode.value, costNode.value] — cost's share, per docs/DATA_SPEC.md §3.2.
    case 'percent_of': return Math.round((values[1] * values[0]) / 100);
    case 'multiply': return Math.round(values[0] * values[1]);
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'sum': return values.reduce((a, b) => a + b, 0);
    default: throw new Error(`explainer.js: unknown derived op "${op}"`);
  }
}

// A unit_caps entry applies to the citizen's stated units before any term
// reads them (docs/DATA_SPEC.md §3: "Applied to the citizen's stated units
// BEFORE any term uses them"). Reported as a plain input when the cap
// doesn't bind — claiming a value is "derived from a cap" when the cap
// never applied would be its own small dishonesty.
function resolveUnitValue(slots, unitSlot, unitCaps) {
  const raw = slots ? slots[unitSlot] : undefined;
  if (raw === undefined || raw === null) return null;
  const rawNode = inputNumber(raw, unitSlot);
  const cap = unitCaps && unitCaps[unitSlot];
  if (!cap || typeof cap.max !== 'number' || raw <= cap.max) return rawNode;
  const capNode = ruleNumber(cap.max, ['subsidy_rule', 'unit_caps', unitSlot, 'max']);
  const capped = applyOp('min', [rawNode.value, capNode.value]);
  return derivedNumber(capped, 'min', [rawNode, capNode]);
}

// Resolves a term's rule-published rate/percent, selected by category when
// the term varies (percent_by/rates + a selector slot), flat otherwise.
// Returns null (and records the missing selector) when the citizen's
// selector value isn't one the rule's table covers.
function resolveSelected(table, selectorSlot, slots, path, missing) {
  const key = slots ? slots[selectorSlot] : undefined;
  if (key === undefined || key === null || !(key in table)) {
    missing.push(selectorSlot);
    return null;
  }
  return ruleNumber(table[key], [...path, key]);
}

function computeCostBasis(costBasis, slots, unitCaps, missing, basePath) {
  if (costBasis.kind === 'citizen_quotation') {
    const v = slots ? slots[costBasis.slot] : undefined;
    if (v === undefined || v === null) {
      missing.push(costBasis.slot);
      return null;
    }
    return inputNumber(v, costBasis.slot);
  }
  if (costBasis.kind === 'rule_unit_cost') {
    const units = resolveUnitValue(slots, costBasis.unit_slot, unitCaps);
    if (!units) {
      missing.push(costBasis.unit_slot);
      return null;
    }
    const unitCostNode = ruleNumber(costBasis.unit_cost_inr, [...basePath, 'cost_basis', 'unit_cost_inr']);
    const total = applyOp('multiply', [unitCostNode.value, units.value]);
    return derivedNumber(total, 'multiply', [unitCostNode, units]);
  }
  throw new Error(`explainer.js: unknown cost_basis.kind "${costBasis.kind}"`);
}

// Computes one subsidy_rule term. Returns { id, label_hi, value, missing }
// — value is a provenance-tagged node when computable, null when a
// required slot is still unknown (missing lists exactly which).
function computeTerm(term, index, slots, unitCaps) {
  const basePath = ['subsidy_rule', 'terms', index];
  const missing = [];
  let valueNode = null;

  if (term.type === 'flat_cap') {
    valueNode = ruleNumber(term.amount_inr, [...basePath, 'amount_inr']);
  } else if (term.type === 'percent_of_cost') {
    const percentNode = 'percent' in term
      ? ruleNumber(term.percent, [...basePath, 'percent'])
      : resolveSelected(term.percent_by, term.percent_selector_slot, slots, [...basePath, 'percent_by'], missing);
    const costNode = computeCostBasis(term.cost_basis, slots, unitCaps, missing, basePath);
    if (percentNode && costNode) {
      const result = applyOp('percent_of', [percentNode.value, costNode.value]);
      valueNode = derivedNumber(result, 'percent_of', [percentNode, costNode]);
    }
  } else if (term.type === 'per_unit_cap' || term.type === 'per_unit_rate') {
    const rateNode = 'rate' in term
      ? ruleNumber(term.rate, [...basePath, 'rate'])
      : resolveSelected(term.rates, term.rate_selector_slot, slots, [...basePath, 'rates'], missing);
    const unitsNode = resolveUnitValue(slots, term.unit_slot, unitCaps);
    if (!unitsNode) missing.push(term.unit_slot);
    if (rateNode && unitsNode) {
      const result = applyOp('multiply', [rateNode.value, unitsNode.value]);
      valueNode = derivedNumber(result, 'multiply', [rateNode, unitsNode]);
    }
  } else {
    throw new Error(`explainer.js: unknown term type "${term.type}"`);
  }

  return { id: term.id, label_hi: term.label_hi, value: valueNode, missing: [...new Set(missing)] };
}

// combine:'min'/'max' need every term to state an exact figure — that's
// the whole point of "whichever is lower/higher applies". When a term is
// still uncomputable, stating the combine of what IS known would either
// overclaim (min: the true min could be lower once the unknown term
// resolves) or underclaim (max: the true max could be higher) a firm
// number, so instead it reports a safe bound: min's known terms form an
// upper bound ("up to ₹X"), max's form a lower bound ("at least ₹X").
// sum's partial total is always a lower bound either way, since an
// unresolved non-negative term can only add to it, never subtract.
function combineTerms(terms, combineMode) {
  const computable = terms.filter((t) => t.value !== null);
  if (computable.length === 0) return { result: null, bound: null };

  const nodes = computable.map((t) => t.value);
  const combined = applyOp(combineMode, nodes.map((n) => n.value));
  const node = derivedNumber(combined, combineMode, nodes);

  if (computable.length === terms.length) return { result: node, bound: null };
  return { result: null, bound: { type: combineMode === 'min' ? 'upper' : 'lower', value: node } };
}

function citationOf(rule) {
  return {
    source_url: rule.source_url || null,
    last_verified: rule.last_verified || null,
    source_quote_hi: rule.source_quote_hi || null,
  };
}

// Computes a scheme's subsidy_rule against the citizen's slots. Never
// guesses: a term whose required slot is unknown reports as such rather
// than assuming a value, the same three-valued discipline eligibility.js
// applies to conditions. Returns:
//   status: 'NO_RULE' (scheme has no subsidy_rule) | 'NOT_APPLICABLE'
//     (applies_when failed) | 'NEED_MORE_INFO' (applies_when itself is
//     undecidable, or the rule applies but nothing is computable yet) |
//     'PARTIAL' (some but not all terms known — see bound) | 'OK'
//   result: the final provenance-tagged figure, only when status is 'OK'
//   bound: { type: 'upper'|'lower', value } when status is 'PARTIAL' and a
//     safe bound exists
//   terms: per-term breakdown, for a UI to render the worked-example style
//     line-by-line view
//   missing_slots: every slot that would make more terms computable
//   citation: subsidy_rule's own source, separate from the scheme's
export function explain(scheme, slots) {
  const safeSlots = slots || {};
  const rule = scheme && scheme.subsidy_rule;
  if (!rule) {
    return { status: 'NO_RULE', result: null, bound: null, terms: [], missing_slots: [], citation: null };
  }

  const appliesWhen = rule.applies_when || [];
  const appliesCheck = appliesWhen.length
    ? evaluate(safeSlots, { eligibility: { all_of: appliesWhen, any_of: [], none_of: [] } })
    : { verdict: 'ELIGIBLE', missing_slots: [] };

  if (appliesCheck.verdict === 'NOT_ELIGIBLE') {
    return { status: 'NOT_APPLICABLE', result: null, bound: null, terms: [], missing_slots: [], citation: citationOf(rule) };
  }
  if (appliesCheck.verdict === 'NEED_MORE_INFO') {
    return {
      status: 'NEED_MORE_INFO', result: null, bound: null, terms: [],
      missing_slots: appliesCheck.missing_slots, citation: citationOf(rule),
    };
  }

  const terms = (rule.terms || []).map((term, i) => computeTerm(term, i, safeSlots, rule.unit_caps));
  const { result, bound } = combineTerms(terms, rule.combine);
  const missing_slots = [...new Set(terms.flatMap((t) => t.missing))];
  const status = result ? 'OK' : bound ? 'PARTIAL' : 'NEED_MORE_INFO';

  return { status, result, bound, terms, missing_slots, citation: citationOf(rule) };
}

// Guard 2 (CONTEXT.md): recursively re-derives every number explain()
// produced and throws on the first that doesn't check out — a rule path
// that no longer resolves to the claimed value, an input that doesn't
// match what the citizen actually supplied, or a derived figure whose
// operands don't recompute to it. Nothing from explain() reaches a screen
// without passing this first.
function assertNode(node, scheme, slots, label) {
  if (node === null || node === undefined) return;
  const { value, from } = node;
  if (!from) throw new Error(`assertDerivedFromSourced: ${label} (${value}) carries no provenance`);

  if (from.kind === 'rule') {
    const resolved = resolvePath(scheme, from.path);
    if (resolved !== value) {
      throw new Error(`assertDerivedFromSourced: ${label} claims ${value} from rule path ${from.path.join('.')}, which resolves to ${resolved}`);
    }
    return;
  }
  if (from.kind === 'input') {
    const actual = slots ? slots[from.slot] : undefined;
    if (actual !== value) {
      throw new Error(`assertDerivedFromSourced: ${label} claims ${value} from input slot "${from.slot}", which is actually ${actual}`);
    }
    return;
  }
  if (from.kind === 'derived') {
    from.operands.forEach((op, i) => assertNode(op, scheme, slots, `${label} operand[${i}]`));
    const recomputed = applyOp(from.op, from.operands.map((o) => o.value));
    if (recomputed !== value) {
      throw new Error(`assertDerivedFromSourced: ${label} claims ${value} from derived op "${from.op}", which recomputes to ${recomputed}`);
    }
    return;
  }
  throw new Error(`assertDerivedFromSourced: ${label} has an unknown provenance kind "${from.kind}"`);
}

export function assertDerivedFromSourced(output, scheme, slots) {
  assertNode(output.result, scheme, slots, 'result');
  if (output.bound) assertNode(output.bound.value, scheme, slots, 'bound');
  (output.terms || []).forEach((term) => assertNode(term.value, scheme, slots, `term "${term.id}"`));
  return true;
}
