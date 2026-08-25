// K18: generates api/v1/insights.json — published, aggregate-only facts
// about the 12-scheme registry, computed by running js/eligibility.js
// (the same engine the citizen-facing flow uses) against synthetic
// profiles built from data/slots.json's own real option values. No
// citizen data of any kind is involved; every input is either a scheme
// record or a slot-catalogue answer choice, both already public.
//
// Why not one true cartesian product across every referenced slot: the
// 12 records jointly reference 25 slots, and — checked once, by
// unioning slots across schemes that share any condition slot — 22 of
// them fall into a single connected component (schemes chain together
// through shared slots like 'occupation' and 'age'), whose full product
// is ~8.5 billion combinations. That's not run-every-profile, it's
// don't-finish-before-the-deadline. Two questions don't need that scale
// at all; the third is answered with a smaller, exact, non-approximated
// substitute:
//
//   1. "Which schemes are unreachable" — decomposed per scheme. Each
//      scheme's OWN referenced-slot set is small (2-7 slots), so its
//      full realistic combination space is a few thousand profiles at
//      most. A scheme is unreachable if none of them ever evaluate to
//      ELIGIBLE. Exact, not sampled.
//   2. "Which slot most often decides an outcome" — a tally, across
//      every one of those per-scheme evaluations, of which slot
//      appears in evaluate()'s own `gaps` output whenever the verdict
//      is NOT_ELIGIBLE. Exact, not sampled.
//   3. "Which profiles have zero eligible schemes" — restricted to the
//      three slots every discovery session asks first (occupation,
//      age, gender; see data/slots.json core_sequence), 360 profiles.
//      This is not a sampling shortcut: evaluate()'s three-valued logic
//      makes NOT_ELIGIBLE monotonic — a leaf that is already false
//      depends only on its own slot, so no amount of *additional*
//      information can turn it back to true. A profile that is
//      NOT_ELIGIBLE for every scheme using only these three answers is
//      therefore GENUINELY, PERMANENTLY zero-eligible, not provisionally
//      so — the strongest true claim this dataset supports without the
//      8.5-billion-combination search.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { evaluate } from '../js/eligibility.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCHEMES_PATH = path.join(ROOT, 'data', 'schemes.json');
const SLOTS_PATH = path.join(ROOT, 'data', 'slots.json');
const API_DIR = path.join(ROOT, 'api', 'v1');
const OUT_PATH = path.join(API_DIR, 'insights.json');

function collectSlotNames(entry, set) {
  if (Array.isArray(entry)) { entry.forEach((e) => collectSlotNames(e, set)); return; }
  if (entry && typeof entry === 'object') {
    if ('slot' in entry && 'op' in entry) set.add(entry.slot);
    else Object.values(entry).forEach((v) => collectSlotNames(v, set));
  }
}

function referencedSlots(scheme) {
  const set = new Set();
  const e = scheme.eligibility || {};
  collectSlotNames(e.all_of || [], set);
  collectSlotNames(e.any_of || [], set);
  collectSlotNames(e.none_of || [], set);
  return [...set];
}

function optionsFor(slotsCatalogue, slotName) {
  const def = slotsCatalogue.slots.find((s) => s.slot === slotName);
  if (!def || !def.options) return [];
  return def.options.filter((o) => o.value !== null).map((o) => o.value);
}

function cartesianProduct(valueLists) {
  return valueLists.reduce(
    (acc, values) => acc.flatMap((combo) => values.map((v) => [...combo, v])),
    [[]],
  );
}

function buildProfile(slotNames, combo) {
  const profile = {};
  slotNames.forEach((name, i) => { profile[name] = combo[i]; });
  return profile;
}

function main() {
  const schemes = JSON.parse(readFileSync(SCHEMES_PATH, 'utf8'));
  const slotsCatalogue = JSON.parse(readFileSync(SLOTS_PATH, 'utf8'));

  // --- 1 & 2: per-scheme reachability + global slot-blocking tally ---
  const slotBlockTally = new Map();
  const perScheme = schemes.map((scheme) => {
    const slotNames = referencedSlots(scheme);
    const valueLists = slotNames.map((name) => optionsFor(slotsCatalogue, name));
    const combos = slotNames.length === 0 ? [[]] : cartesianProduct(valueLists);

    let eligible = 0, notEligible = 0, needMoreInfo = 0;
    for (const combo of combos) {
      const profile = buildProfile(slotNames, combo);
      const result = evaluate(profile, scheme);
      if (result.verdict === 'ELIGIBLE') eligible += 1;
      else if (result.verdict === 'NOT_ELIGIBLE') {
        notEligible += 1;
        for (const gap of result.gaps) {
          slotBlockTally.set(gap.slot, (slotBlockTally.get(gap.slot) || 0) + 1);
        }
      } else needMoreInfo += 1;
    }

    return {
      scheme_id: scheme.scheme_id,
      name_hi: scheme.name_hi,
      name_en: scheme.name_en,
      referenced_slots: slotNames,
      profiles_tested: combos.length,
      eligible_profiles: eligible,
      not_eligible_profiles: notEligible,
      need_more_info_profiles: needMoreInfo,
      reachable: eligible > 0,
    };
  });

  const totalBlocks = [...slotBlockTally.values()].reduce((a, b) => a + b, 0);
  const slotBlockRanking = [...slotBlockTally.entries()]
    .map(([slot, count]) => ({ slot, times_blocking: count, share: totalBlocks > 0 ? count / totalBlocks : 0 }))
    .sort((a, b) => b.times_blocking - a.times_blocking);

  // --- 3: headline profile analysis (occupation x age x gender) ---
  const headlineSlots = ['occupation', 'age', 'gender'];
  const headlineValueLists = headlineSlots.map((name) => optionsFor(slotsCatalogue, name));
  const headlineCombos = cartesianProduct(headlineValueLists);

  let definitelyZeroEligible = 0;
  let alreadyEligibleForSome = 0;
  let stillUndetermined = 0;
  const zeroEligibleOccupations = new Set();
  const reachableOccupations = new Set();

  for (const combo of headlineCombos) {
    const profile = buildProfile(headlineSlots, combo);
    const verdicts = schemes.map((scheme) => evaluate(profile, scheme).verdict);
    if (verdicts.some((v) => v === 'ELIGIBLE')) {
      alreadyEligibleForSome += 1;
      reachableOccupations.add(profile.occupation);
    } else if (verdicts.every((v) => v === 'NOT_ELIGIBLE')) {
      definitelyZeroEligible += 1;
      zeroEligibleOccupations.add(profile.occupation);
    } else {
      stillUndetermined += 1;
    }
  }
  // An occupation only belongs in the "guaranteed zero" list if EVERY
  // age/gender combination under it was zero-eligible — one reachable
  // combination is enough to prove that occupation isn't a dead end.
  const occupationDef = slotsCatalogue.slots.find((s) => s.slot === 'occupation');
  const occupationsAlwaysZeroEligible = [...zeroEligibleOccupations].filter(
    (occ) => !reachableOccupations.has(occ),
  ).sort().map((occ) => {
    const opt = occupationDef.options.find((o) => o.value === occ);
    return { value: occ, label_hi: opt ? opt.label_hi : occ, label_en: opt ? opt.label_en : occ };
  });

  const insights = {
    generated_at: new Date().toISOString(),
    methodology_note_hi: 'यह पृष्ठ किसी नागरिक के डेटा से नहीं, बल्कि योजना-नियमों व प्रश्न-सूची (data/slots.json) के अपने मानों से बनता है। हर आँकड़ा js/eligibility.js — वही इंजन जो पोर्टल पर असली सवाल-जवाब चलाता है — को चलाकर निकाला गया है।',
    methodology_note_en: 'This page is built not from any citizen data, but from the scheme rules and question catalogue (data/slots.json) own values. Every figure is derived by running js/eligibility.js — the same engine that runs real question-answering on the portal.',
    scheme_count: schemes.length,
    per_scheme: perScheme,
    unreachable_scheme_ids: perScheme.filter((s) => !s.reachable).map((s) => s.scheme_id),
    slot_block_ranking: slotBlockRanking,
    headline_profile_analysis: {
      dimensions: headlineSlots,
      total_profiles: headlineCombos.length,
      definitely_zero_eligible_profiles: definitelyZeroEligible,
      already_eligible_for_some_profiles: alreadyEligibleForSome,
      still_undetermined_profiles: stillUndetermined,
      occupations_always_zero_eligible: occupationsAlwaysZeroEligible,
    },
  };

  mkdirSync(API_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(insights, null, 2) + '\n');
  console.log(`build-insights: OK — ${perScheme.length} scheme(s) analysed, ${perScheme.filter((s) => !s.reachable).length} unreachable, written to api/v1/insights.json`);
}

main();
