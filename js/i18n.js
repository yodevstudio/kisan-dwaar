// K8: bilingual Hindi/English toggle. Static core — zero service calls,
// zero external dependency, listed in CONTEXT.md's own repo layout
// diagram as js/i18n.js. Two jobs only:
//   1. Persist + broadcast the citizen's chosen language (localStorage,
//      plus a DOM CustomEvent so every page's own script can react
//      without this module knowing anything about them).
//   2. Hold the dictionary of STATIC UI CHROME strings shared across the
//      ten portal pages (headers, nav, buttons, disclosure/insights/
//      status copy). Anything that already carries its own citizen-facing
//      name (a scheme's name_en, a slot's question_en/label_en, a
//      document's label_en) reads that field instead of duplicating it
//      here — this file is chrome only, never a second copy of data.
//
// Chat history is the one deliberate exception to "seamless": switching
// language mid-conversation relabels the composer, buttons and every page
// around the chat instantly, but bubbles already printed keep the
// language they were printed in — exactly like a real chat app, and the
// only sane behaviour for free-form appended transcript text that would
// otherwise have to be silently rewritten after the fact.

const LANG_KEY = 'kisan.lang.v1';
const DEFAULT_LANG = 'hi';

export function getLang() {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG; // localStorage unavailable (private mode etc.) — Hindi default, never throws
  }
}

export function setLang(lang) {
  const next = lang === 'en' ? 'en' : 'hi';
  try { localStorage.setItem(LANG_KEY, next); } catch { /* non-fatal — toggle still works for this page view */ }
  applyTranslations();
  window.dispatchEvent(new CustomEvent('kisan:langchange', { detail: { lang: next } }));
  return next;
}

// key -> { hi, en }. See header note: static UI chrome only.
const STRINGS = {
  'common.badge_rules': { hi: '🔒 नियम-आधारित · कोई AI मॉडल नहीं', en: '🔒 Rules-based · No AI model' },
  'common.badge_staff': { hi: '🔒 सेवा-स्तर · स्टाफ़ केवल', en: '🔒 Service layer · Staff only' },
  'common.footer_disclosure': { hi: 'प्रस्ताव प्रोटोटाइप — YoDevStudio', en: 'Proposal Prototype — YoDevStudio' },
  'common.loading': { hi: 'लोड हो रहा है…', en: 'Loading…' },

  'nav.home': { hi: 'मुख्य पृष्ठ', en: 'Home' },
  'nav.schemes': { hi: 'योजनाएं', en: 'Schemes' },
  'nav.check': { hi: 'पात्रता जांचें', en: 'Check Eligibility' },
  'nav.documents': { hi: 'दस्तावेज़', en: 'Documents' },
  'nav.notices': { hi: 'सूचनाएं', en: 'Notices' },
  'nav.insights': { hi: 'आंकड़े', en: 'Insights' },
  'nav.feedback': { hi: 'प्रतिक्रिया', en: 'Feedback' },
  'nav.status': { hi: 'आवेदन स्थिति', en: 'Application Status' },
  'nav.about': { hi: 'परिचय', en: 'About' },
  'nav.employee': { hi: 'कर्मचारी कॉर्नर', en: 'Employee Corner' },
  'nav.aria_label': { hi: 'मुख्य नेविगेशन', en: 'Main navigation' },

  'lang.switch_to_en': { hi: 'Switch to English', en: 'Switch to English' },
  'lang.switch_to_hi': { hi: 'हिंदी में बदलें', en: 'हिंदी में बदलें' },

  'index.title': { hi: 'किसान द्वार — KISAN DWAAR', en: 'KISAN DWAAR — किसान द्वार' },
  'index.h1': { hi: 'किसान द्वार', en: 'KISAN DWAAR' },
  'index.query_label': { hi: 'अपना सवाल टाइप करें', en: 'Type your question' },
  'index.query_placeholder': { hi: 'अपना सवाल टाइप करें…', en: 'Type your question…' },
  'index.send': { hi: 'भेजें', en: 'Send' },
  'index.discover_btn': { hi: 'सभी योजनाएं देखें', en: 'See all schemes' },
  'index.chat_aria_label': { hi: 'बातचीत', en: 'Conversation' },

  // T7: portal home (index.html) — hero, service cards, agriculture-scheme
  // and notices previews, and the help block. The chat itself now lives at
  // pages/check/ (index.chat_aria_label above stays there, unrenamed —
  // the key name is just an identifier, js/app.js doesn't care which page
  // hosts it).
  'home.hero_lead': {
    hi: 'राजस्थान की कृषि योजनाओं के लिए एक नागरिक-केंद्रित प्रवेश द्वार — बिना खाता बनाए, बिना लॉग-इन किए।',
    en: "A citizen-centred gateway to Rajasthan's agriculture schemes — no account, no login.",
  },
  'home.hero_primary': { hi: 'मेरी पात्रता जांचें', en: 'Check my eligibility' },
  'home.hero_secondary': { hi: 'सभी योजनाएं देखें', en: 'See all schemes' },
  'home.services_title': { hi: 'सेवाएं', en: 'Services' },
  'home.service_check_title': { hi: 'पात्रता जांचें', en: 'Check eligibility' },
  'home.service_check_body': { hi: 'छह सवालों में जानें आप किस योजना के लिए पात्र हैं।', en: 'Find out which scheme you qualify for in six questions.' },
  'home.service_calculator_title': { hi: 'अनुदान की गणना', en: 'Subsidy calculator' },
  'home.service_status_title': { hi: 'आवेदन की स्थिति', en: 'Application status' },
  'home.service_status_body': { hi: 'अभी डेमो डेटा पर आधारित — असली आवेदन प्रणाली से नहीं जुड़ा।', en: 'Currently based on demo data — not connected to the real application system.' },
  'home.service_documents_title': { hi: 'दस्तावेज़', en: 'Documents' },
  'home.service_documents_body': { hi: 'हर योजना के लिए ज़रूरी दस्तावेज़ों की सूची, कहाँ से मिलेंगे सहित।', en: 'The checklist of documents each scheme needs, and where to get them.' },
  'home.service_notices_title': { hi: 'सूचनाएं', en: 'Notices' },
  'home.service_notices_body': { hi: 'हर योजना का स्रोत परिपत्र/वेब पेज, जाँच-तिथि व मशीन-पठनीयता सहित।', en: "Each scheme's source circular/web page, with verification date and machine-readability." },
  'home.service_help_title': { hi: 'सहायता', en: 'Help' },
  'home.service_help_body': { hi: 'ई-मित्र व राजस्थान संपर्क (181) — नीचे देखें।', en: 'e-Mitra and Rajasthan Sampark (181) — see below.' },
  'home.schemes_view_all': { hi: 'सभी देखें', en: 'View all' },
  'home.notices_title': { hi: 'हाल की सूचनाएं', en: 'Recent notices' },
  'home.notices_view_all': { hi: 'सभी सूचनाएं देखें', en: 'See all notices' },
  'home.notices_load_error': { hi: 'सूचनाएं लोड नहीं हो सकीं।', en: 'Could not load notices.' },
  'home.schemes_load_error': { hi: 'योजना सूची लोड नहीं हो सकी।', en: 'Could not load the scheme list.' },
  'home.help_title': { hi: 'सहायता चाहिए?', en: 'Need help?' },
  'home.help_emitra': { hi: 'अपने नज़दीकी ई-मित्र केंद्र पर जाएं।', en: 'Visit your nearest e-Mitra centre.' },
  'home.help_sampark': { hi: 'राजस्थान संपर्क को 181 पर कॉल करें।', en: 'Call Rajasthan Sampark at 181.' },

  // K8: js/app.js chat UI — every bubble/label the discovery flow itself
  // prints. Frozen per-bubble at creation time (see js/app.js's langClass
  // header note) — this dictionary just supplies whichever language was
  // active at that moment.
  'chat.dont_know': { hi: 'पता नहीं', en: "Don't know" },
  'chat.skipped': { hi: 'छोड़ दिया', en: 'Skipped' },
  'chat.ok': { hi: 'ठीक है', en: 'OK' },
  'chat.skip': { hi: 'छोड़ें', en: 'Skip' },
  'chat.feedback_prompt': { hi: 'क्या यह जवाब मददगार था?', en: 'Was this answer helpful?' },
  'chat.feedback_up_prompt': { hi: 'क्या अच्छा लगा?', en: 'What did you like?' },
  'chat.feedback_down_prompt': { hi: 'क्या समस्या हुई?', en: 'What was the problem?' },
  'chat.thanks': { hi: 'धन्यवाद!', en: 'Thank you!' },
  'chat.verdict_eligible': { hi: 'पात्र', en: 'Eligible' },
  'chat.verdict_not_eligible': { hi: 'अपात्र', en: 'Not eligible' },
  'chat.verdict_need_info': { hi: 'जानकारी चाहिए', en: 'Need more info' },
  'chat.documents_needed': { hi: 'ज़रूरी दस्तावेज़:', en: 'Documents needed:' },
  'chat.source': { hi: 'स्रोत', en: 'Source' },
  'chat.verified_on': { hi: 'जाँचा गया', en: 'Verified on' },
  'chat.know_subsidy_amount': { hi: 'अनुदान राशि जानें', en: 'Know the subsidy amount' },
  'chat.subsidy_calculation': { hi: 'अनुदान की गणना', en: 'Subsidy calculation' },
  'chat.you_stated': { hi: 'आपने बताया', en: 'You stated' },
  'chat.condition': { hi: 'शर्त', en: 'Condition' },
  'chat.need_more_info': { hi: 'जानकारी चाहिए', en: 'Need more information' },
  'chat.tell_now': { hi: 'अभी बताएं', en: 'Tell now' },
  'chat.applied': { hi: 'लागू हुई', en: 'applied' },
  'chat.you_will_get': { hi: 'आपको मिलेगा', en: 'You will get' },
  'chat.max_you_could_get': { hi: 'आपको अधिकतम मिल सकता है', en: 'You could get at most' },
  'chat.min_you_will_get': { hi: 'आपको कम से कम मिलेगा', en: 'You will get at least' },
  'chat.exact_amount_needs_more_info': { hi: 'सही राशि ऊपर बताई गई जानकारी दिए बिना नहीं बताई जा सकती।', en: 'The exact amount cannot be given without the information mentioned above.' },
  'chat.amount_needs_more_info': { hi: 'राशि बताने के लिए अभी पर्याप्त जानकारी नहीं है।', en: 'There is not enough information yet to state the amount.' },
  'chat.calculation_not_applicable': { hi: 'यह गणना इस स्थिति पर लागू नहीं होती।', en: 'This calculation does not apply to this situation.' },
  'chat.original_hindi_text': { hi: '', en: 'Original text (Hindi)' },
  'chat.calculation_error': { hi: 'माफ़ कीजिए, गणना में एक समस्या आई। नज़दीकी ई-मित्र पर सही राशि पूछें।', en: 'Sorry, there was a problem with the calculation. Ask at your nearest e-Mitra for the correct amount.' },
  'chat.load_error': { hi: '⚠ अभी लोड नहीं हो सका। कृपया पेज को दोबारा लोड करें, या थोड़ी देर बाद कोशिश करें।', en: '⚠ Could not load right now. Please reload the page, or try again in a moment.' },
  'chat.discovery_start': { hi: 'ठीक है, कुछ सवाल पूछता हूँ ताकि आपके लिए सही योजनाएं ढूंढ सकूं।', en: "Alright, I'll ask a few questions so I can find the right schemes for you." },
  'chat.no_scheme_found': { hi: 'दिए गए विवरण के अनुसार, फिलहाल कोई योजना आपके लिए उपयुक्त नहीं लग रही। नज़दीकी ई-मित्र पर पूरी जानकारी के लिए पूछें।', en: 'Based on the details given, no scheme currently looks suitable for you. Ask at your nearest e-Mitra for full information.' },
  'chat.need_info_intro': { hi: 'इनके लिए थोड़ी और जानकारी चाहिए — किसी एक का नाम टाइप करके पूछें:', en: 'These need a bit more information — type one\'s name to ask about it:' },
  'chat.unknown_query': { hi: 'मेरे पास इसकी पक्की जानकारी नहीं है। "सभी योजनाएं देखें" दबाएं, या नज़दीकी ई-मित्र से पूछें।', en: 'I don\'t have confirmed information on this. Press "See all schemes", or ask at your nearest e-Mitra.' },
  'chat.samples_intro': { hi: 'कुछ उदाहरण, आज़माने के लिए:', en: 'Some examples to try:' },
  'chat.checking_eligibility_for': { hi: '{{scheme}} की पात्रता जांचते हैं।', en: "Checking eligibility for {{scheme}}." },

  // T6: the auditable-decision panel under every verdict card.
  'chat.audit_panel_summary': { hi: 'यह निर्णय कैसे लिया गया', en: 'How this decision was made' },
  'chat.audit_none_stated': { hi: 'इस योजना के लिए अभी तक कोई जानकारी दर्ज नहीं है।', en: 'No information has been given yet for this scheme.' },
  'chat.audit_rule': { hi: 'नियम क्या कहता है', en: 'What the rule says' },
  'chat.audit_decision': { hi: 'निर्णय', en: 'Decision' },
  'chat.audit_decision_eligible': { hi: 'सभी लागू शर्तें पूरी हुईं — आप इस योजना के लिए पात्र हैं।', en: 'All applicable conditions were met — you are eligible for this scheme.' },
  'chat.audit_decision_generic_not_eligible': { hi: 'कम से कम एक शर्त पूरी नहीं हुई।', en: 'At least one condition was not met.' },
  'chat.audit_listen': { hi: 'सुनें', en: 'Listen' },
  'chat.audit_print': { hi: 'प्रिंट करें', en: 'Print' },
  'chat.greeting': {
    hi: 'नमस्ते! मैं किसान द्वार हूं — राजस्थान की कृषि योजनाओं के लिए। आप अपना सवाल टाइप कर सकते हैं, या "सभी योजनाएं देखें" दबा सकते हैं।',
    en: 'Hello! I am KISAN DWAAR — for Rajasthan\'s agriculture schemes. You can type your question, or press "See all schemes".',
  },

  'schemes.title': { hi: 'सभी योजनाएं — किसान द्वार', en: 'All Schemes — KISAN DWAAR' },
  'schemes.h1': { hi: 'योजनाएं', en: 'Schemes' },
  'schemes.load_error': { hi: 'योजना सूची लोड नहीं हो सकी।', en: 'Could not load the scheme list.' },
  'schemes.check_eligibility': { hi: 'पात्रता जांचें', en: 'Check eligibility' },
  // T2: scheme_group is 'agriculture' | 'related_welfare' on every record
  // (data/schemes.json) — these two keys label that split everywhere it's
  // shown (schemes list, discovery flow results), so the wording can never
  // drift between the two places it appears.
  'schemes.agriculture_heading': { hi: 'कृषि योजनाएं', en: 'Agriculture schemes' },
  'schemes.related_welfare_heading': { hi: 'किसान के लिए अन्य कल्याण योजनाएं', en: 'Other welfare schemes for farmers' },
  'schemes.related_welfare_note': {
    hi: 'एक किसान एक नागरिक भी है — ये योजनाएं कृषि विभाग की नहीं, बल्कि अन्य विभागों की हैं, फिर भी किसान परिवारों के लिए उपयोगी हो सकती हैं।',
    en: 'A farmer is also a citizen — these schemes come from other departments, not Agriculture, but can still be useful to farming households.',
  },

  'check.title': { hi: 'पात्रता जांचें — किसान द्वार', en: 'Check Eligibility — KISAN DWAAR' },
  'check.h1': { hi: 'पात्रता जांचें', en: 'Check Eligibility' },
  'check.sidebar_title': { hi: 'यह कैसे काम करता है', en: 'How this works' },
  'check.sidebar_body': {
    hi: 'कोई खाता या लॉग-इन ज़रूरी नहीं। अपनी उम्र, व्यवसाय, आय, श्रेणी व ज़िला बताएं — इंजन बताएगा आप किस योजना के लिए पात्र हैं, कौनसा दस्तावेज़ चाहिए, और जहाँ संभव हो अनुदान की राशि की गणना भी दिखाएगा।',
    en: "No account or login needed. Tell it your age, occupation, income, category and district — the engine tells you which scheme you qualify for, which documents you need, and shows the subsidy calculation where possible.",
  },
  'check.sidebar_tip': {
    hi: 'किसी योजना का नाम सीधे टाइप करके भी पूछ सकते हैं — जैसे "तारबंदी योजना चाहिए"।',
    en: 'You can also type a scheme name directly — like "I need the fencing scheme".',
  },
  'check.sidebar_documents_link': { hi: 'ज़रूरी दस्तावेज़ों की सूची पहले से देखें', en: 'See the document checklist in advance' },

  'documents.title': { hi: 'दस्तावेज़ — किसान द्वार', en: 'Documents — KISAN DWAAR' },
  'documents.h1': { hi: 'दस्तावेज़', en: 'Documents' },
  // T2: no longer a static count — documents.js builds this line at
  // render time from the real agriculture/related_welfare split, the
  // same discipline schemes.js's intro-line already uses.
  'documents.intro_suffix': {
    hi: 'में इस्तेमाल होने वाले दस्तावेज़, एक जगह — कौनसा दस्तावेज़ किन योजनाओं के लिए चाहिए, और कहाँ से मिलेगा। ठीक-ठीक सूची अपनी योजना जांचते समय दिखेगी — यह पन्ना पहले से तैयारी के लिए है।',
    en: 'in one place — which document is needed for which schemes, and where to get it. The exact list will show while you check your own scheme — this page is for preparing ahead of time.',
  },
  'documents.load_error': { hi: 'दस्तावेज़ सूची लोड नहीं हो सकी।', en: 'Could not load the document list.' },
  'documents.where_to_get': { hi: 'कहाँ से मिलेगा', en: 'Where to get it' },
  'documents.for_schemes': { hi: 'किन योजनाओं के लिए', en: 'Needed for schemes' },

  'notices.title': { hi: 'सूचनाएं — किसान द्वार', en: 'Notices — KISAN DWAAR' },
  'notices.h1': { hi: 'सूचनाएं', en: 'Notices' },
  'notices.load_error': { hi: 'सूचना सूची लोड नहीं हो सकी।', en: 'Could not load the notice list.' },
  'notices.legend': {
    hi: '🟢 मशीन-पठनीय (नियम रजिस्ट्री में निकाले गए) · 🟡 टेक्स्ट PDF / वेब पेज · 🔴 स्कैन की गई तस्वीर (नियम हाथ से ट्रांसक्राइब किए गए)',
    en: '🟢 Machine-readable (rules extracted into the registry) · 🟡 Text PDF / web page · 🔴 Scanned image (rules transcribed by hand)',
  },
  'notices.badge_registry': { hi: 'मशीन-पठनीय', en: 'Machine-readable' },
  'notices.badge_text_source': { hi: 'टेक्स्ट PDF / वेब पेज', en: 'Text PDF / web page' },
  'notices.badge_scanned': { hi: 'स्कैन की गई तस्वीर', en: 'Scanned image' },
  'notices.linked_scheme': { hi: 'इस दस्तावेज़ के नियम इस योजना में दर्ज हैं', en: "This document's rules are on record for this scheme" },

  'feedback.title': { hi: 'प्रतिक्रिया — किसान द्वार', en: 'Feedback — KISAN DWAAR' },
  'feedback.h1': { hi: 'प्रतिक्रिया', en: 'Feedback' },
  'feedback.h1_lead': { hi: 'आपकी राय मायने रखती है', en: 'Your opinion matters' },
  'feedback.intro_before': {
    hi: 'यह पोर्टल समग्र रूप से कैसा लगा? कोई खाता ज़रूरी नहीं, और यहाँ कोई पहचान संग्रहीत नहीं होती — देखें',
    en: 'How was the portal overall? No account needed, and no identity is stored here — see',
  },
  'feedback.intro_after': { hi: '।', en: '.' },
  'feedback.privacy_title': { hi: 'यहां क्या कभी संग्रहीत नहीं होता', en: 'What is never collected here' },
  'feedback.per_scheme_title': { hi: 'किसी एक योजना पर प्रतिक्रिया देनी है?', en: 'Want to give feedback on one scheme?' },
  'feedback.per_scheme_body': {
    hi: 'पात्रता जांच के दौरान हर नतीजे के साथ वही 👍/👎 बटन मौजूद है — वहीं से दें, ताकि वह सीधे उस योजना से जुड़ जाए।',
    en: "The same 👍/👎 button appears with every result during eligibility checking — use it there so your feedback links to that scheme directly.",
  },
  'feedback.per_scheme_cta': { hi: 'पात्रता जांचें पर जाएं', en: 'Go to check eligibility' },
  'feedback.prompt': { hi: 'क्या यह पोर्टल आपके लिए मददगार रहा?', en: 'Was this portal helpful for you?' },
  'feedback.prompt_up': { hi: 'क्या अच्छा लगा?', en: 'What did you like?' },
  'feedback.prompt_down': { hi: 'क्या समस्या हुई?', en: 'What was the problem?' },
  'feedback.thanks': { hi: 'धन्यवाद!', en: 'Thank you!' },
  'feedback.reason.easy_to_use': { hi: 'इस्तेमाल करना आसान लगा', en: 'Was easy to use' },
  'feedback.reason.useful_info': { hi: 'जानकारी उपयोगी लगी', en: 'Information was useful' },
  'feedback.reason.fast': { hi: 'जल्दी जवाब मिला', en: 'Got a quick answer' },
  'feedback.reason.confusing': { hi: 'समझने में मुश्किल हुई', en: 'Was confusing' },
  'feedback.reason.missing_scheme': { hi: 'जो योजना चाहिए थी वह नहीं मिली', en: "Couldn't find the scheme I needed" },
  'feedback.reason.other_issue': { hi: 'कोई और समस्या', en: 'Some other problem' },

  'status.title': { hi: 'आवेदन की स्थिति — किसान द्वार', en: 'Application Status — KISAN DWAAR' },
  'status.h1': { hi: 'आवेदन की स्थिति', en: 'Application Status' },
  // T10: the real-uploads section — visually and textually distinct from
  // the demo section below it.
  'status.real_title': { hi: 'असली अपलोड — इस प्रोटोटाइप में दर्ज', en: 'Real uploads — recorded in this prototype' },
  'status.real_body_before': {
    hi: 'जब भी आप लॉग-इन करके इस प्रोटोटाइप के ज़रिए कोई फ़ाइल अपलोड करते हैं, वह यहाँ, आपके ही खाते के तहत, एक असली रिकॉर्ड के रूप में दिखती है — नीचे दी गई डेमो सूची से अलग।',
    en: "Whenever you log in and upload a file through this prototype, it shows up here, under your own account, as a real record — separate from the demo list below.",
  },
  'status.real_body_strong': { hi: 'यह किसी विभागीय आवेदन प्रणाली से नहीं जुड़ा', en: 'This is not connected to any departmental application system' },
  'status.real_body_after': {
    hi: '— यह केवल यह पुष्टि करता है कि फ़ाइल इस प्रोटोटाइप में सफलतापूर्वक अपलोड व दर्ज हुई।',
    en: '— it only confirms the file was successfully uploaded and recorded in this prototype.',
  },
  'status.real_operator_note': {
    hi: 'ऑपरेटर मोड (S6) से "किसान की ओर से" किया गया अपलोड, ऑपरेटर के अपने खाते में दर्ज होता है — इस प्रोटोटाइप में किसान की कोई अलग पहचान नहीं है, इसलिए वह अपलोड यहाँ किसान के लॉग-इन में नहीं दिखेगा।',
    en: 'An "on behalf of the farmer" upload from Operator Mode (S6) is recorded under the operator\'s own account — this prototype has no separate farmer identity, so that upload will not show up here under the farmer\'s own login.',
  },
  'status.real_login_prompt': { hi: 'अपने असली अपलोड देखने के लिए लॉग-इन करें।', en: 'Log in to see your real uploads.' },
  'status.real_none': { hi: 'इस खाते से अभी तक कोई असली अपलोड दर्ज नहीं हुआ।', en: 'No real uploads have been recorded from this account yet.' },
  'status.real_reference': { hi: 'संदर्भ', en: 'Reference' },
  'status.real_uploaded_on': { hi: 'अपलोड किया गया', en: 'Uploaded on' },
  'status.demo_title': { hi: 'डेमो डेटा', en: 'Demo data' },
  'status.demo_body_before': { hi: 'यहाँ दिखाए गए सभी आवेदन', en: 'Every application shown here' },
  'status.demo_body_strong': { hi: 'बनावटी उदाहरण हैं', en: 'is a fabricated example' },
  'status.demo_body_after': {
    hi: '— असली आवेदन प्रणाली से जुड़े नहीं हैं। योजना के नाम असली, सत्यापित डेटा से हैं; आवेदन-संख्या, तारीख़ और स्थिति सभी केवल प्रदर्शन के लिए हैं।',
    en: '— not connected to a real application system. Scheme names come from real, verified data; the application number, date and stage are for demonstration only.',
  },
  'status.demo_note': { hi: '(डेमो)', en: '(Demo)' },
  'status.submitted_on': { hi: 'प्रस्तुत', en: 'Submitted' },
  'status.application_no': { hi: 'आवेदन संख्या', en: 'Application no.' },
  'status.stage.submitted': { hi: 'प्रस्तुत किया गया', en: 'Submitted' },
  'status.stage.under_review': { hi: 'समीक्षाधीन', en: 'Under review' },
  'status.stage.inspection': { hi: 'निरीक्षण', en: 'Inspection' },
  'status.stage.disbursed': { hi: 'वितरित', en: 'Disbursed' },

  'insights.title': { hi: 'आंकड़े — किसान द्वार', en: 'Insights — KISAN DWAAR' },
  'insights.h1': { hi: 'आंकड़े (Insights)', en: 'Insights (आंकड़े)' },
  'insights.load_error': { hi: '⚠ आंकड़े अभी लोड नहीं हो सके।', en: '⚠ Could not load the data right now.' },
  'insights.reachable': { hi: '✅ पहुंच योग्य', en: '✅ Reachable' },
  'insights.unreachable': { hi: '⛔ अप्राप्य', en: '⛔ Unreachable' },
  'insights.section_schemes_title': { hi: 'योजना-वार पहुंच', en: 'Reachability by scheme' },
  'insights.section_schemes_body': {
    hi: 'हर पट्टी उस योजना के अपने ही सन्दर्भ-स्लॉट के हर यथार्थ मान-संयोजन (data/slots.json से) को इंजन से चलाने का नतीजा दिखाती है — हरा: पात्र, लाल: अपात्र, धूसर: जानकारी चाहिए।',
    en: "Each bar shows the result of running that scheme's own referenced slots' every real value combination (from data/slots.json) through the engine — green: eligible, red: not eligible, grey: need more info.",
  },
  'insights.section_slots_title': { hi: 'सबसे ज़्यादा नतीजा तय करने वाले सवाल', en: 'Questions that most often decide the outcome' },
  'insights.section_slots_body': {
    hi: 'जब भी कोई योजना अपात्र ठहरती है, कौन-सा सवाल (स्लॉट) उसका कारण बना — पूरी रजिस्ट्री में कुल गिनती के हिसाब से।',
    en: 'Whenever a scheme comes out not-eligible, which question (slot) caused it — counted across the whole registry.',
  },
  'insights.section_headline_title': { hi: 'पहले तीन सवालों से क्या तय होता है', en: 'What the first three questions decide' },
  'insights.section_headline_body': {
    hi: 'पेशा × उम्र × लिंग — डिस्कवरी फ़्लो के पहले तीन सवाल — अकेले कितना तय कर देते हैं, बाकी कुछ भी बताए बिना।',
    en: 'Occupation × age × gender — the first three questions of the discovery flow — how much they alone decide, before anything else is answered.',
  },
  'insights.json_link_before': { hi: 'पूरा जनरेट किया गया डेटा:', en: 'Full generated data:' },
  'insights.stat_total': { hi: 'कुल प्रोफ़ाइल', en: 'Total profiles' },
  'insights.stat_eligible_some': { hi: 'पहले से किसी योजना के लिए पात्र', en: 'Already eligible for some scheme' },
  'insights.stat_undetermined': { hi: 'अभी अनिर्णीत — और जानकारी चाहिए', en: 'Still undetermined — needs more info' },
  'insights.stat_zero_eligible': { hi: 'निश्चित रूप से शून्य-पात्र', en: 'Definitely zero-eligible' },
  'insights.zero_eligible_note': {
    hi: '"निश्चित रूप से शून्य-पात्र" का मतलब है: इंजन के तीन-मान तर्क में, एक बार जो शर्त झूठी सिद्ध हो जाए, वह आगे कोई भी जानकारी जोड़ने से सच नहीं बन सकती — इसलिए यह आंकड़ा अनुमान नहीं, स्थायी तथ्य है।',
    en: '"Definitely zero-eligible" means: in the engine\'s three-valued logic, once a condition is proven false, no amount of additional information can make it true again — so this figure is a permanent fact, not a guess.',
  },
  'insights.occupations_zero_title': { hi: 'ऐसे पेशे जिनके लिए (उम्र/लिंग चाहे जो भी हों) फिलहाल कोई योजना कभी पात्र नहीं बनती:', en: 'Occupations for which (whatever the age/gender) no scheme currently ever becomes eligible:' },
  'insights.occupations_zero_none': { hi: 'फिलहाल कोई भी पेशा ऐसा नहीं मिला जो अकेले (उम्र/लिंग के साथ) हर योजना से स्थायी रूप से बाहर कर दे।', en: 'No occupation currently found that, alone with age/gender, permanently rules out every scheme.' },
  'insights.unreachable_warning': { hi: '⚠ अप्राप्य योजना(एं)', en: '⚠ Unreachable scheme(s)' },
  'insights.generated_summary': { hi: 'योजनाओं का विश्लेषण', en: 'schemes analysed' },
  'insights.agriculture_label': { hi: 'कृषि', en: 'agriculture' },
  'insights.related_welfare_label': { hi: 'अन्य कल्याण', en: 'related welfare' },
  'insights.built_at': { hi: 'बना', en: 'built' },
  'insights.out_of_profiles': { hi: 'यथार्थ प्रोफ़ाइलों में से', en: 'real profiles' },
  'insights.reference_slots': { hi: 'सन्दर्भ स्लॉट', en: 'reference slots' },
  // T9: the leading section — the good finding (0 unreachable schemes)
  // stated first, per the visual-density pass's own re-presentation ask.
  'insights.section_lead_title': { hi: 'सबसे पहली बात', en: 'The headline finding' },
  'insights.section_schemes_legend': {
    hi: 'ज़्यादातर पट्टियां लाल दिखेंगी — यह अपेक्षित है: परीक्षण सूची में डॉक्टर, इंजीनियर, विधायक जैसे कई गैर-किसान पेशे भी शामिल हैं ताकि इंजन की पूरी जाँच हो सके। असली किसानों के लिए वास्तविक पात्रता दर कहीं बेहतर है।',
    en: 'Most bars will read mostly red — that is expected: the test list deliberately includes many non-farmer occupations (doctors, engineers, MLAs) to exercise the engine fully. Real farmers see a far better actual eligibility rate.',
  },

  'about.title': { hi: 'परिचय — किसान द्वार', en: 'About — KISAN DWAAR' },
  'about.h1': { hi: 'परिचय', en: 'About' },
  'about.card1_title': { hi: 'किसान द्वार क्या है', en: 'What is KISAN DWAAR' },
  'about.card1_body1': {
    hi: 'राजस्थान की कृषि योजनाओं का एक नागरिक-केंद्रित प्रवेश द्वार — YoDevStudio द्वारा, Rajasthan Innovation Challenge ("कृषि विभाग वेब पोर्टल का सुधार — नागरिक-केंद्रित डिजिटल फ्रंट-एंड") के लिए बनाया गया। एक किसान छह सवालों के जवाब देकर — बिना खाता बनाए, बिना लॉग-इन किए — एक नतीजा, दस्तावेज़ों की सूची, और जहाँ संभव हो वहाँ अनुदान राशि की गणना पाता है।',
    en: 'A citizen-centred gateway to Rajasthan\'s agriculture schemes — built by YoDevStudio for the Rajasthan Innovation Challenge ("Revamp of Agriculture Department web portal — citizen-centric digital front-end"). A farmer answers six questions — no account, no login — and gets a verdict, a document list, and a subsidy amount calculation where possible.',
  },
  'about.card1_body2': {
    hi: 'हर आंकड़ा किसी स्रोत URL व जाँच-तिथि तक पता लगाया जा सकता है। कोई राशि, सीमा, दस्तावेज़ या स्रोत बनावटी नहीं है — जहाँ जानकारी सत्यापित नहीं हो सकी, वहाँ रिकॉर्ड में खाली (null) छोड़ा गया है, अनुमान नहीं लगाया गया।',
    en: 'Every figure can be traced to a source URL and verification date. No amount, limit, document or source is fabricated — where information could not be verified, the record is left null, never guessed.',
  },
  'about.card2_title': { hi: 'यह एक बड़े तंत्र का कृषि-संस्करण है', en: 'This is the agriculture edition of a larger system' },
  'about.card2_body_before': {
    hi: 'इंजन (eligibility.js, assemble.js, explainer.js, router.js) और आँकड़ों का अनुशासन एक मौजूदा योजना-नियम रजिस्ट्री से लिया गया है — यह उसी तंत्र का कृषि-विशिष्ट अनुप्रयोग है, न कि एक अलग से बनाया गया प्रोजेक्ट। रजिस्ट्री खुद',
    en: 'The engine (eligibility.js, assemble.js, explainer.js, router.js) and the data discipline are drawn from an existing scheme-rules registry — this is that same system\'s agriculture-specific application, not a separately built project. The registry itself is published at',
  },
  'about.card2_body_after': {
    hi: 'पर संस्करण व स्रोत सहित प्रकाशित है, ताकि कोई भी दूसरा एप्लिकेशन — ई-मित्र सॉफ़्टवेयर, कोई अन्य विभाग — उसी आँकड़े पर निर्माण कर सके, बिना अनुमति मांगे।',
    en: 'with version and source, so any other application — e-Mitra software, another department — can build on the same data without asking permission.',
  },
  'about.card3_title': { hi: 'दो-भाग की संरचना', en: 'A two-part structure' },
  'about.static_core_word': { hi: 'स्थिर कोर', en: 'Static core' },
  'about.service_layer_word': { hi: 'सेवा-स्तर', en: 'Service layer' },
  'about.card3_body1': {
    hi: '— पोर्टल, पात्रता इंजन, दस्तावेज़ चेकलिस्ट, रजिस्ट्री — शून्य निर्भरता, कोई बिल्ड-स्टेप नहीं, कोई सेवा-कॉल नहीं। पहली बार लोड होने के बाद ऑफ़लाइन भी काम करता है। दो स्वतंत्र origins पर तैनात है।',
    en: '— the portal, eligibility engine, document checklist, registry — zero dependencies, no build step, no service call. Works offline after the first load. Deployed on two independent origins.',
  },
  'about.card3_body2': {
    hi: '— लॉग-इन, दस्तावेज़ अपलोड, गुमनाम एनालिटिक्स, आवेदन स्थिति, नियम-लेखन उपकरण — वैकल्पिक, हमेशा degradable। यदि यह पूरी तरह बंद हो जाए, तब भी पात्रता जांच व दस्तावेज़ सूची काम करती रहती है।',
    en: '— login, document upload, anonymous analytics, application status, the rule-authoring tool — optional, always degradable. Even if it fails completely, eligibility checking and the document list keep working.',
  },
  'about.card4_title': { hi: 'और पढ़ें', en: 'Read more' },
  'about.link_evidence': { hi: 'हर दावे का प्रमाण', en: 'evidence for every claim' },
  'about.link_analytics': { hi: 'क्या मापा जाता है, क्या कभी नहीं', en: 'what is measured, what never is' },
  'about.link_dpi': { hi: 'यह डिजिटल पब्लिक इंफ्रास्ट्रक्चर क्यों है', en: 'why this is digital public infrastructure' },

  'employee.title': { hi: 'कर्मचारी कॉर्नर — किसान द्वार', en: 'Employee Corner — KISAN DWAAR' },
  'employee.h1': { hi: 'कर्मचारी कॉर्नर', en: 'Employee Corner' },
  'employee.card1_title': { hi: 'जानबूझकर मुख्य मेनू में नहीं', en: 'Deliberately not in the main menu' },
  'employee.card1_body': {
    hi: 'यह पन्ना जानबूझकर मुख्य नेविगेशन में नहीं है — केवल फ़ुटर से पहुंचा जा सकता है। docs/EVIDENCE_LEDGER.md का निष्कर्ष A1 बताता है कि विभाग के अपने पोर्टल पर "Employee Corner" जैसी प्रशासनिक सामग्री किसान-केंद्रित सामग्री के बराबर, मुख्य नेविगेशन में रखी गई है — यह ठीक वही गलती है जो हम यहाँ नहीं दोहराना चाहते।',
    en: 'This page is deliberately not in the main navigation — reachable only from the footer. docs/EVIDENCE_LEDGER.md\'s finding A1 notes that the Department\'s own portal places administrative content like an "Employee Corner" in the main navigation, at the same level as farmer-facing content — exactly the mistake we do not want to repeat here.',
  },
  'employee.card2_title': { hi: 'स्टाफ़ उपकरण', en: 'Staff tools' },
  'employee.cms_link': { hi: 'नियम-लेखन उपकरण (CMS)', en: 'Rule-authoring tool (CMS)' },
  'employee.operator_link': { hi: 'ऑपरेटर मोड (S6)', en: 'Operator mode (S6)' },
  'employee.session_link': { hi: 'सेशन जाँच (S1)', en: 'Session check (S1)' },
  'employee.analytics_link': { hi: 'एनालिटिक्स डैशबोर्ड (S3)', en: 'Analytics dashboard (S3)' },
  'employee.home_link': { hi: '← मुख्य पृष्ठ पर वापस जाएं', en: '← Back to home' },
};

export function t(key) {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[getLang()] || entry.hi;
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });
  if (root === document) {
    document.documentElement.lang = getLang();
    if (document.title && document.querySelector('title[data-i18n]')) {
      document.title = t(document.querySelector('title[data-i18n]').getAttribute('data-i18n'));
    }
  }
}

// Renders (or re-renders) a small "हिं / EN" toggle into containerId.
// Re-renders itself on every langchange so its own label stays correct
// even when a different control on the page triggered the switch.
export function renderLangToggle(containerId = 'lang-toggle') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const render = () => {
    const lang = getLang();
    container.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-toggle-btn';
    btn.setAttribute('aria-label', lang === 'hi' ? t('lang.switch_to_en') : t('lang.switch_to_hi'));
    btn.textContent = lang === 'hi' ? 'EN' : 'हिं';
    btn.addEventListener('click', () => setLang(lang === 'hi' ? 'en' : 'hi'));
    container.appendChild(btn);
  };
  render();
  window.addEventListener('kisan:langchange', render);
  applyTranslations();
}
