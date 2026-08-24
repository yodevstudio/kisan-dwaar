// K12: the disclosure panel. Renders into <details id="disclosure-panel">
// on any static-core page. Every number here comes from js/policy.js or
// a live fetch — nothing is typed as prose that could drift from what
// the system actually does. No service call: the scheme count is read
// from the same data/schemes.json the portal itself already loads, and
// the upload/analytics facts come from js/policy.js's plain constants.
import { resolvePath } from './paths.js';
import {
  UPLOAD_RETENTION_DAYS,
  UPLOAD_MAX_FILE_BYTES,
  UPLOAD_ALLOWED_TYPES_HI,
  ANALYTICS_NEVER_COLLECTED_HI,
} from './policy.js';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

async function getSchemeCount() {
  try {
    const schemes = await (await fetch(resolvePath('data/schemes.json'))).json();
    return schemes.length;
  } catch {
    return null; // never blocks the panel from rendering — see renderDisclosurePanel
  }
}

export async function renderDisclosurePanel(containerId = 'disclosure-panel') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const schemeCount = await getSchemeCount();
  const maxMb = Math.round(UPLOAD_MAX_FILE_BYTES / (1024 * 1024));

  container.innerHTML = '';
  const details = document.createElement('details');
  details.className = 'disclosure-panel';

  const summary = document.createElement('summary');
  summary.className = 'hi';
  summary.textContent = 'पारदर्शिता — यह पोर्टल क्या रखता है, क्या नहीं';
  details.appendChild(summary);

  const body = el('div', 'disclosure-body');

  body.appendChild(el('h3', 'hi', 'डेटा का आधार'));
  body.appendChild(el('p', 'hi', schemeCount !== null
    ? `यह पोर्टल राजस्थान की ${schemeCount} सत्यापित कृषि योजनाओं पर आधारित है — हर एक का स्रोत URL व जाँच-तिथि data/schemes.json में मौजूद है, सार्वजनिक रूप से api/v1/ पर भी।`
    : 'योजना सूची अभी लोड नहीं हो सकी — संख्या यहाँ नहीं दिखाई जा सकती, पर बाकी जानकारी सही है।'));

  body.appendChild(el('h3', 'hi', 'दस्तावेज़ अपलोड (सेवा-स्तर, वैकल्पिक)'));
  body.appendChild(el('p', 'hi',
    `यदि आप लॉग-इन करके कोई दस्तावेज़ अपलोड करते हैं, तो वह Firebase Cloud Storage पर आपके अपने, निजी पथ में जाता है — कोई और उपयोगकर्ता उसे देख या हटा नहीं सकता। स्वीकृत प्रकार: ${UPLOAD_ALLOWED_TYPES_HI}, अधिकतम आकार ${maxMb}MB। फ़ाइलें ${UPLOAD_RETENTION_DAYS} दिन बाद स्वतः हटा दी जाती हैं। पात्रता जांचना व दस्तावेज़ों की सूची देखना इसके बिना भी हमेशा काम करता है — अपलोड सेवा बंद होने पर भी।`));

  body.appendChild(el('h3', 'hi', 'गुमनाम एनालिटिक्स — कभी संग्रहीत नहीं किया जाता'));
  const list = el('ul', 'doc-list');
  ANALYTICS_NEVER_COLLECTED_HI.forEach((line) => list.appendChild(el('li', 'hi', line)));
  body.appendChild(list);
  body.appendChild(el('p', 'citation hi', 'पूरी माप-पद्धति: docs/ANALYTICS.md'));

  details.appendChild(body);
  container.appendChild(details);
}
