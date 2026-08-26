// K12: the disclosure panel. Renders into <details id="disclosure-panel">
// on any static-core page. Every number here comes from js/policy.js or
// a live fetch — nothing is typed as prose that could drift from what
// the system actually does. The upload/analytics facts come from
// js/policy.js's plain constants.
//
// T4: the scheme count and its source line come from the same
// loadSchemeRegistry() attempt-then-fallback js/app.js's boot uses — this
// panel runs its own independent attempt rather than reading js/app.js's
// state, so it stays reusable on a page that never runs app.js at all,
// same reasoning as this file's own K12 comment always claimed. Either
// way it degrades gracefully: loadSchemeRegistry() itself never throws.
//
// K8: bilingual — re-renders on 'kisan:langchange' so the panel switches
// language instantly, same as every other static-core surface.
import { getLang } from './i18n.js';
import { loadSchemeRegistry } from './registry-source.js';
import {
  UPLOAD_RETENTION_DAYS,
  UPLOAD_MAX_FILE_BYTES,
  UPLOAD_ALLOWED_TYPES_HI,
  UPLOAD_ALLOWED_TYPES_EN,
  ANALYTICS_NEVER_COLLECTED_HI,
  ANALYTICS_NEVER_COLLECTED_EN,
} from './policy.js';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

async function getSchemeCounts() {
  try {
    const { schemes, source, dataset_version } = await loadSchemeRegistry();
    return {
      total: schemes.length,
      agriculture: schemes.filter((s) => s.scheme_group === 'agriculture').length,
      relatedWelfare: schemes.filter((s) => s.scheme_group === 'related_welfare').length,
      source,
      dataset_version,
    };
  } catch {
    return null; // never blocks the panel from rendering — see renderDisclosurePanel
  }
}

const COPY = {
  hi: {
    summary: 'पारदर्शिता — यह पोर्टल क्या रखता है, क्या नहीं',
    dataBasisTitle: 'डेटा का आधार',
    dataBasisFound: (ag, wel) => `यह पोर्टल राजस्थान की ${ag} सत्यापित कृषि योजनाओं व किसानों के लिए उपयोगी ${wel} अन्य विभागों की कल्याण योजनाओं (कुल ${ag + wel}) पर आधारित है — हर एक का स्रोत URL व जाँच-तिथि data/schemes.json में मौजूद है, सार्वजनिक रूप से api/v1/ पर भी।`,
    dataBasisMissing: 'योजना सूची अभी लोड नहीं हो सकी — संख्या यहाँ नहीं दिखाई जा सकती, पर बाकी जानकारी सही है।',
    sourceLive: (v) => `डेटा स्रोत: लाइव प्रकाशित रजिस्ट्री (CMS से सीधे) · dataset_version: ${v ?? '—'}`,
    sourceStatic: (v) => `डेटा स्रोत: गिट में कमिट की गई फ़ाइल (data/schemes.json) · dataset_version: ${v ?? '—'}`,
    uploadTitle: 'दस्तावेज़ अपलोड (सेवा-स्तर, वैकल्पिक)',
    uploadBody: (typesHi, maxMb, days) => `यदि आप लॉग-इन करके कोई दस्तावेज़ अपलोड करते हैं, तो वह Firebase Cloud Storage पर आपके अपने, निजी पथ में जाता है — कोई और उपयोगकर्ता उसे देख या हटा नहीं सकता। स्वीकृत प्रकार: ${typesHi}, अधिकतम आकार ${maxMb}MB। फ़ाइलें ${days} दिन बाद स्वतः हटा दी जाती हैं। पात्रता जांचना व दस्तावेज़ों की सूची देखना इसके बिना भी हमेशा काम करता है — अपलोड सेवा बंद होने पर भी।`,
    analyticsTitle: 'गुमनाम एनालिटिक्स — कभी संग्रहीत नहीं किया जाता',
    citation: 'पूरी माप-पद्धति: docs/ANALYTICS.md',
  },
  en: {
    summary: 'Transparency — what this portal keeps, what it never does',
    dataBasisTitle: 'Basis of the data',
    dataBasisFound: (ag, wel) => `This portal is based on ${ag} verified Rajasthan agriculture schemes and ${wel} related welfare schemes from other departments, useful to farming households (${ag + wel} total) — each with a source URL and verification date in data/schemes.json, also published publicly at api/v1/.`,
    dataBasisMissing: 'The scheme list could not load right now — the count cannot be shown here, but the rest of the information is accurate.',
    sourceLive: (v) => `Data source: live published registry (direct from the CMS) · dataset_version: ${v ?? '—'}`,
    sourceStatic: (v) => `Data source: git-committed file (data/schemes.json) · dataset_version: ${v ?? '—'}`,
    uploadTitle: 'Document upload (service layer, optional)',
    uploadBody: (typesEn, maxMb, days) => `If you log in and upload a document, it goes to your own, private path on Firebase Cloud Storage — no other user can see or delete it. Accepted types: ${typesEn}, maximum size ${maxMb}MB. Files are automatically deleted after ${days} days. Checking eligibility and viewing the document checklist always work without this — even if the upload service is down.`,
    analyticsTitle: 'Anonymous analytics — never collected',
    citation: 'Full measurement methodology: docs/ANALYTICS.md',
  },
};

export async function renderDisclosurePanel(containerId = 'disclosure-panel') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const schemeCounts = await getSchemeCounts();
  const maxMb = Math.round(UPLOAD_MAX_FILE_BYTES / (1024 * 1024));

  const render = () => {
    const lang = getLang();
    const c = COPY[lang];
    const typesText = lang === 'hi' ? UPLOAD_ALLOWED_TYPES_HI : UPLOAD_ALLOWED_TYPES_EN;
    const neverCollected = lang === 'hi' ? ANALYTICS_NEVER_COLLECTED_HI : ANALYTICS_NEVER_COLLECTED_EN;

    container.innerHTML = '';
    const details = document.createElement('details');
    details.className = 'disclosure-panel';

    const summary = document.createElement('summary');
    summary.className = lang === 'hi' ? 'hi' : '';
    summary.textContent = c.summary;
    details.appendChild(summary);

    const body = el('div', 'disclosure-body');
    const cls = lang === 'hi' ? 'hi' : '';

    body.appendChild(el('h3', cls, c.dataBasisTitle));
    body.appendChild(el('p', cls, schemeCounts !== null ? c.dataBasisFound(schemeCounts.agriculture, schemeCounts.relatedWelfare) : c.dataBasisMissing));
    if (schemeCounts !== null) {
      const sourceText = schemeCounts.source === 'services'
        ? c.sourceLive(schemeCounts.dataset_version)
        : c.sourceStatic(schemeCounts.dataset_version);
      body.appendChild(el('p', `citation ${cls}`.trim(), sourceText));
    }

    body.appendChild(el('h3', cls, c.uploadTitle));
    body.appendChild(el('p', cls, c.uploadBody(typesText, maxMb, UPLOAD_RETENTION_DAYS)));

    body.appendChild(el('h3', cls, c.analyticsTitle));
    const list = el('ul', 'doc-list');
    neverCollected.forEach((line) => list.appendChild(el('li', cls, line)));
    body.appendChild(list);
    body.appendChild(el('p', `citation ${cls}`.trim(), c.citation));

    details.appendChild(body);
    container.appendChild(details);
  };

  render();
  window.addEventListener('kisan:langchange', render);
}
