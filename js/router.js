export const CONFIDENCE_THRESHOLD = 0.55;

// Score at/above which a single scheme's keyword-match strength saturates
// to full confidence (before any tie/close-second penalty is applied).
const SATURATION = 20;

const WORD_CHAR_CLASS = '\\u0900-\\u097F0-9A-Za-z-';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function indexOfPhrase(text, phrase) {
  if (!phrase) return -1;
  // 'i' is a no-op on Devanagari (no case) and lets English keyword/phrase
  // entries match regardless of how a citizen capitalises typed Latin text.
  const pattern = new RegExp(`(?<![${WORD_CHAR_CLASS}])${escapeRegExp(phrase)}(?![${WORD_CHAR_CLASS}])`, 'i');
  const m = pattern.exec(text);
  return m ? m.index : -1;
}

function containsPhrase(text, phrase) {
  return indexOfPhrase(text, phrase) !== -1;
}

// Blanks out every whole-phrase occurrence of each phrase (longest first),
// using the same word-boundary rule as indexOfPhrase.
function stripPhrases(text, phrases) {
  return [...new Set(phrases)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .reduce((acc, phrase) => acc.replace(
      new RegExp(`(?<![${WORD_CHAR_CLASS}])${escapeRegExp(phrase)}(?![${WORD_CHAR_CLASS}])`, 'gi'),
      ' ',
    ), text);
}

// Phrases a citizen uses to ask "what am I entitled to" rather than name a
// specific scheme — hand-picked, not a generalised classifier, same
// discipline as the lexicon: only phrases we're confident are genuine.
export const DISCOVERY_PHRASES = [
  'क्या मिल सकता है',
  'कांई-कांई',
  'कांई मिलै',
  'कोई योजना',
  'मेरे लायक',
  'म्हारे लायक',
  'हक',
  'क्या-क्या',
  'कौन सी योजना',
  'फायदा',
  'लाभ',
  // T3: same phrases, same discipline, in English/Hinglish.
  'what can i get',
  'what am i eligible for',
  'which scheme',
  'koi yojana',
  'mere layak',
  'benefit',
  // The lexicon rewrites "scheme" to "योजना" before routing, so the English
  // question "which scheme is for me?" arrives here as "which योजना ...".
  'which योजना',
  'which schemes',
  'schemes for me',
  'am i eligible',
  'kaun si yojana',
  'kya mil sakta',
];

function isDiscoveryQuery(text) {
  return DISCOVERY_PHRASES.some((phrase) => containsPhrase(text, phrase));
}

// When two terms from the same slot's dictionary both appear (e.g. a
// sentence mentions a scheme name containing "विधवा" as well as a citizen's
// own "तलाकशुदा" self-description), the later-occurring one wins — treated
// as the more specific, most-recently-stated fact, not whichever term
// happened to be declared first in the dictionary below.
function extractLastMatch(text, termList) {
  let best = null;
  for (const [term, value] of termList) {
    const idx = indexOfPhrase(text, term);
    if (idx !== -1 && (best === null || idx > best.idx)) best = { idx, value };
  }
  return best ? best.value : null;
}

// Each matched keyword contributes a flat base score (curated keywords are
// deliberately chosen, distinguishing phrases — a single hit is meaningful
// signal, not noise) plus a small length bonus for extra specificity.
// A full name_hi match adds a further bonus on top of its own base score.
function scoreScheme(text, scheme) {
  let score = 0;
  const matched = [];
  const candidates = [
    { term: scheme.name_hi, bonus: 10 },
    ...((scheme.keywords_hi || []).map((k) => ({ term: k, bonus: 0 }))),
  ];
  for (const { term, bonus } of candidates) {
    if (term && containsPhrase(text, term)) {
      score += 10 + Math.min(term.length, 10) + bonus;
      matched.push(term);
    }
  }
  return { score, matched };
}

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

function devanagariToLatinDigits(str) {
  return str.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

const AGE_WORD = '(?:साल|वर्ष|बरस|years?|yrs?|saal)';
const AGE_PATTERNS = [
  new RegExp(`(\\d{1,3})\\s*${AGE_WORD}`, 'i'),
  new RegExp(`${AGE_WORD}\\s*(\\d{1,3})`, 'i'),
];

function extractAge(text) {
  const digitText = devanagariToLatinDigits(text);
  for (const pattern of AGE_PATTERNS) {
    const m = digitText.match(pattern);
    if (m) {
      const age = parseInt(m[1], 10);
      if (age > 0 && age < 120) return age;
    }
  }
  return null;
}

const GENDER_TERMS = [
  ['महिला', 'female'],
  ['स्त्री', 'female'],
  ['औरत', 'female'],
  ['पुरुष', 'male'],
  ['आदमी', 'male'],
  ['मर्द', 'male'],
  // T3: same terms, same discipline, in English/Hinglish.
  ['female', 'female'],
  ['woman', 'female'],
  ['mahila', 'female'],
  ['male', 'male'],
  ['man', 'male'],
  ['aadmi', 'male'],
];

function extractGender(text) {
  return extractLastMatch(text, GENDER_TERMS);
}

const MARITAL_TERMS = [
  ['विधवा', 'widow'],
  ['तलाकशुदा', 'divorced'],
  ['परित्यक्ता', 'abandoned'],
  ['अविवाहित', 'unmarried'],
  ['विवाहित', 'married'],
  // T3: same terms, same discipline, in English/Hinglish.
  ['widow', 'widow'],
  ['divorced', 'divorced'],
  ['abandoned', 'abandoned'],
  ['unmarried', 'unmarried'],
  ['single', 'unmarried'],
  ['married', 'married'],
  ['shadishuda', 'married'],
];

function extractMaritalStatus(text) {
  return extractLastMatch(text, MARITAL_TERMS);
}

const OCCUPATION_TERMS = [
  ['किसान', 'farmer'],
  ['मजदूर', 'labourer'],
  ['विद्यार्थी', 'student'],
  ['बेरोजगार', 'unemployed'],
  // T3: same terms, same discipline, in English/Hinglish.
  ['farmer', 'farmer'],
  ['kisan', 'farmer'],
  ['labourer', 'labourer'],
  ['laborer', 'labourer'],
  ['majdoor', 'labourer'],
  ['student', 'student'],
  ['vidyarthi', 'student'],
  ['unemployed', 'unemployed'],
  ['berojgar', 'unemployed'],
];

function extractOccupation(text) {
  return extractLastMatch(text, OCCUPATION_TERMS);
}

// Rajasthan's 41 districts — the 33 long-standing districts plus the 8
// created in 2023 and retained when the state dissolved the other nine in
// December 2024 (Board of Revenue district list dated 29-01-2025). One
// paired list is the single source: English label and Hindi canonical
// value can never drift out of alignment, because they are the same row.
// District is never read by any eligibility condition in this dataset —
// it is only echoed back — so this list changes no verdict.
export const RAJASTHAN_DISTRICT_PAIRS = [
  ['Ajmer', 'अजमेर'],
  ['Alwar', 'अलवर'],
  ['Balotra', 'बालोतरा'],
  ['Banswara', 'बांसवाड़ा'],
  ['Baran', 'बारां'],
  ['Barmer', 'बाड़मेर'],
  ['Beawar', 'ब्यावर'],
  ['Bharatpur', 'भरतपुर'],
  ['Bhilwara', 'भीलवाड़ा'],
  ['Bikaner', 'बीकानेर'],
  ['Bundi', 'बूंदी'],
  ['Chittorgarh', 'चित्तौड़गढ़'],
  ['Churu', 'चूरू'],
  ['Dausa', 'दौसा'],
  ['Deeg', 'डीग'],
  ['Dholpur', 'धौलपुर'],
  ['Didwana-Kuchaman', 'डीडवाना-कुचामन'],
  ['Dungarpur', 'डूंगरपुर'],
  ['Hanumangarh', 'हनुमानगढ़'],
  ['Jaipur', 'जयपुर'],
  ['Jaisalmer', 'जैसलमेर'],
  ['Jalore', 'जालौर'],
  ['Jhalawar', 'झालावाड़'],
  ['Jhunjhunu', 'झुंझुनू'],
  ['Jodhpur', 'जोधपुर'],
  ['Karauli', 'करौली'],
  ['Khairthal-Tijara', 'खैरथल-तिजारा'],
  ['Kota', 'कोटा'],
  ['Kotputli-Behror', 'कोटपूतली-बहरोड़'],
  ['Nagaur', 'नागौर'],
  ['Pali', 'पाली'],
  ['Phalodi', 'फलौदी'],
  ['Pratapgarh', 'प्रतापगढ़'],
  ['Rajsamand', 'राजसमंद'],
  ['Salumber', 'सलूम्बर'],
  ['Sawai Madhopur', 'सवाई माधोपुर'],
  ['Sikar', 'सीकर'],
  ['Sirohi', 'सिरोही'],
  ['Sri Ganganagar', 'श्रीगंगानगर'],
  ['Tonk', 'टोंक'],
  ['Udaipur', 'उदयपुर'],
];

// Hindi canonical values, longest first so longest-match-first extraction
// prefers "सवाई माधोपुर" over any shorter name it might contain.
export const RAJASTHAN_DISTRICTS = RAJASTHAN_DISTRICT_PAIRS
  .map(([, hi]) => hi)
  .sort((a, b) => b.length - a.length);

// English transliterations, alphabetical. Kept as an export for existing
// callers; pair lookups go through RAJASTHAN_DISTRICT_PAIRS, never by index
// against RAJASTHAN_DISTRICTS (which is length-sorted).
export const RAJASTHAN_DISTRICTS_EN = RAJASTHAN_DISTRICT_PAIRS.map(([en]) => en);

// T3: English district names resolve to the same Hindi canonical value the
// Hindi terms already resolve to, same extractLastMatch mechanism.
function extractDistrict(text) {
  const terms = [
    ...RAJASTHAN_DISTRICTS.map((d) => [d, d]),
    ...RAJASTHAN_DISTRICT_PAIRS.map(([en, hi]) => [en, hi]),
  ];
  return extractLastMatch(text, terms);
}

function extractSlots(text) {
  const slots = {};
  const age = extractAge(text);
  if (age !== null) slots.age = age;
  const gender = extractGender(text);
  if (gender) slots.gender = gender;
  const marital_status = extractMaritalStatus(text);
  if (marital_status) slots.marital_status = marital_status;
  const occupation = extractOccupation(text);
  if (occupation) slots.occupation = occupation;
  const district = extractDistrict(text);
  if (district) slots.district = district;
  return slots;
}

export function route(normalisedText, schemes) {
  const text = normalisedText || '';
  const list = schemes || [];
  const scored = list
    .map((scheme) => ({ scheme, ...scoreScheme(text, scheme) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Facts about the citizen are read from what remains after the matched
  // scheme names are removed, so a scheme's own name never becomes a claim
  // about the person: "पीएम किसान" or "किसान क्रेडिट कार्ड" names a scheme,
  // it does not tell us the citizen is a farmer.
  const slots = extractSlots(stripPhrases(text, scored.flatMap((s) => s.matched)));

  let confidence = 0;
  let top = [];
  if (scored.length > 0) {
    const maxScore = scored[0].score;
    top = scored.filter((s) => s.score === maxScore);
    const runnerUp = scored.find((s) => s.score < maxScore);
    const secondScore = runnerUp ? runnerUp.score : 0;

    const rawStrength = Math.min(1, maxScore / SATURATION);

    if (top.length > 1) {
      // Genuine tie between two or more schemes — never confident.
      confidence = Math.min(rawStrength, 0.4);
    } else if (secondScore > 0 && secondScore / maxScore > 0.7) {
      // A close second-best candidate makes the top match less trustworthy.
      confidence = rawStrength * 0.6;
    } else {
      confidence = rawStrength;
    }
    confidence = Math.round(confidence * 100) / 100;
  }

  const confidentSingleMatch = confidence >= CONFIDENCE_THRESHOLD && top.length === 1;

  // "What am I entitled to" beats "I don't recognise that" — but a named
  // scheme always wins over a general browse request, even if the
  // utterance also contains a discovery phrase ("तारबंदी के बारे में क्या
  // मिल सकता है" is about Tarbandi, not a request to browse everything).
  if (!confidentSingleMatch && isDiscoveryQuery(text)) {
    return { intent: 'discover', scheme_ids: [], slots, confidence: 1 };
  }

  if (scored.length === 0) {
    return { intent: 'unknown', scheme_ids: [], slots, confidence: 0 };
  }

  const scheme_ids = confidentSingleMatch
    ? [top[0].scheme.scheme_id]
    : scored.slice(0, 2).map((s) => s.scheme.scheme_id);

  return { intent: 'scheme_query', scheme_ids, slots, confidence };
}
