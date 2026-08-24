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

export const UPLOAD_RETENTION_DAYS = 30;
export const UPLOAD_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const UPLOAD_ALLOWED_TYPES_HI = 'JPG, PNG या PDF';

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
