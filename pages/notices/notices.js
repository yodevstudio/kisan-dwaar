import { resolvePath } from '../../js/paths.js';
import { getLang, t } from '../../js/i18n.js';

// T5: docs/audit-evidence/ contains no captured circulars or source
// documents (only a codebase hardening audit, unrelated to any scheme's
// eligibility rules) — confirmed with the user, who chose to source this
// page from data/schemes.json's own real, already-verified provenance
// fields (source_url, source_type, last_verified) instead. Every entry
// below is a real scheme record; nothing here is invented.

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function nameFor(scheme) {
  return getLang() === 'en' && scheme.name_en ? scheme.name_en : scheme.name_hi;
}

// 🟢 takes priority over source_type: it means "this document's rules are
// already machine-readable in the registry," regardless of what format the
// source itself was — a text PDF or scanned image whose rule was
// successfully extracted is still 🟢. Among schemes with no subsidy_rule,
// 🟡 vs 🔴 is decided purely by source_type: a scanned image is the one
// case no software (OCR included, per this project's own hand-transcription
// discipline) can be trusted to read correctly.
function badgeFor(scheme) {
  if (scheme.subsidy_rule) return { icon: '🟢', key: 'notices.badge_registry' };
  if (scheme.source_type === 'scanned_pdf') return { icon: '🔴', key: 'notices.badge_scanned' };
  return { icon: '🟡', key: 'notices.badge_text_source' };
}

async function init() {
  const listEl = document.getElementById('notice-list');
  let schemes;
  try {
    schemes = await (await fetch(resolvePath('data/schemes.json'))).json();
  } catch (err) {
    listEl.innerHTML = '';
    listEl.appendChild(el('p', 'hi', t('notices.load_error')));
    console.error('notices page: failed to load data/schemes.json:', err);
    return;
  }

  // Counted from the data, never hard-coded: today this is the count of
  // source_type === 'scanned_pdf' records with no subsidy_rule — the 🔴
  // badge exactly. If that's ever non-zero, this line updates on its own.
  const unreadableCount = schemes.filter((s) => !s.subsidy_rule && s.source_type === 'scanned_pdf').length;

  const render = () => {
    const lang = getLang();
    const cls = lang === 'hi' ? 'hi' : '';

    document.getElementById('intro-line').textContent = lang === 'en'
      ? `${unreadableCount} of these ${schemes.length} source documents are scanned images no software can read — where a rule was extracted from one anyway, it was transcribed by hand.`
      : `इन ${schemes.length} स्रोत दस्तावेज़ों में से ${unreadableCount} ऐसी स्कैन की गई तस्वीरें हैं जिन्हें कोई सॉफ़्टवेयर पढ़ नहीं सकता — जहाँ ऐसे दस्तावेज़ से कोई नियम निकाला गया, वह हाथ से ट्रांसक्राइब किया गया।`;

    listEl.innerHTML = '';
    schemes
      .slice()
      .sort((a, b) => (a.last_verified < b.last_verified ? 1 : a.last_verified > b.last_verified ? -1 : 0))
      .forEach((scheme) => {
        const badge = badgeFor(scheme);
        const card = el('div', `card ${cls}`.trim());
        card.appendChild(el('div', 'answer-headline', nameFor(scheme)));
        card.appendChild(el('p', 'badge hi', `${badge.icon} ${t(badge.key)}`));

        const sourceP = el('p', 'citation');
        sourceP.appendChild(document.createTextNode(`${t('chat.source')}: `));
        const link = document.createElement('a');
        link.href = scheme.source_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = scheme.source_url;
        sourceP.appendChild(link);
        card.appendChild(sourceP);

        card.appendChild(el('p', 'citation', `${t('chat.verified_on')}: ${scheme.last_verified}`));

        if (scheme.subsidy_rule) {
          card.appendChild(el('p', `citation ${cls}`.trim(), t('notices.linked_scheme')));
          const schemeLink = document.createElement('a');
          schemeLink.className = `button ${cls}`.trim();
          schemeLink.href = `${resolvePath('index.html')}?scheme=${encodeURIComponent(scheme.scheme_id)}`;
          schemeLink.textContent = t('schemes.check_eligibility');
          card.appendChild(schemeLink);
        }

        listEl.appendChild(card);
      });
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

init();
