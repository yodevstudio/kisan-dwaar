// K12: the single source for every number and claim the disclosure panel
// states. Plain data, zero dependencies, no Firebase import, no service
// call — safe for the static core (this file lives in js/, not
// services/), yet also imported by services/upload.js and
// services/analytics-dashboard.js so a policy change is one edit here,
// not three drifting copies. Before this file existed, the retention
// interval alone was duplicated in services/upload-demo.html's consent
// copy and functions/index.js's RETENTION_DAYS — exactly the drift this
// file exists to rule out.
//
// functions/index.js (a Cloud Function, CommonJS, not deployed) cannot
// import this ES module directly — its own RETENTION_DAYS constant
// carries a comment pointing back here; keeping the two numbers in sync
// is manual until that function is ever actually deployed.

// R8: the one place this URL is written. The government's own portal
// advertises a "Kiosk Locator" nav item, but it links back to its own
// homepage (href="/") rather than an actual locator — checked directly,
// not assumed. Linking a broken page and calling it a locator would be
// exactly the kind of invented claim CONTEXT.md constraint 3 rules out,
// so this links the portal homepage itself and every citizen-facing
// string built from it says "e-Mitra portal", never "locator".
export const EMITRA_PORTAL_URL = 'https://emitra.rajasthan.gov.in/';

export const UPLOAD_RETENTION_DAYS = 30;
export const UPLOAD_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const UPLOAD_ALLOWED_TYPES_HI = 'JPG, PNG या PDF';
// K8: additive — same fact, English wording, for the bilingual disclosure panel.
export const UPLOAD_ALLOWED_TYPES_EN = 'JPG, PNG or PDF';

// docs/ANALYTICS.md §3 is the authoritative prose version of this list;
// this array is what the disclosure panel and the S3 dashboard actually
// render, so the two can never quietly say different things.
export const ANALYTICS_NEVER_COLLECTED_HI = [
  'कोई नाम, फ़ोन नंबर या ईमेल',
  'कोई जन आधार / आधार / SSO पहचानकर्ता या टोकन',
  'IP पता — कच्चा, हैश किया हुआ, या छोटा किया हुआ, किसी भी रूप में नहीं',
  'डिवाइस फ़िंगरप्रिंट (यूज़र एजेंट, स्क्रीन रिज़ॉल्यूशन, आदि)',
  'सटीक स्थान — केवल यह कि "district" सवाल पूछा गया, कभी उसका उत्तर नहीं',
  'नागरिक द्वारा टाइप या चुना गया कोई भी मान — केवल यह कि कौन सा सवाल पूछा गया',
  'सेशन से आगे बना रहने वाला कोई पहचानकर्ता — हर टैब में नया, कभी भेजा नहीं जाता',
  'Referrer URL या कोई ट्रैकिंग पैरामीटर',
  'S1 (लॉग-इन) या S2 (अपलोड) की कोई पहचान — analytics पूरी तरह अलग तंत्र है',
];

// K8: additive — same 9 facts, English wording, index-aligned with
// ANALYTICS_NEVER_COLLECTED_HI above so the two can never drift apart in
// count even if their wording is authored separately.
export const ANALYTICS_NEVER_COLLECTED_EN = [
  'No name, phone number or email',
  'No Jan Aadhaar / Aadhaar / SSO identifier or token',
  'No IP address — raw, hashed or truncated, in any form',
  'No device fingerprint (user agent, screen resolution, etc.)',
  'No precise location — only that a "district" question was asked, never the answer',
  'No value the citizen typed or chose — only which question was asked',
  'No identifier that persists beyond the session — new each tab, never transmitted',
  'No referrer URL or tracking parameter',
  'No S1 (login) or S2 (upload) identity — analytics is a fully separate mechanism',
];
