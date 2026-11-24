import { resolvePath } from '../../js/paths.js';
import { getLang, t } from '../../js/i18n.js';
import { iconSpan } from '../../js/icons.js';

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

  // Counted from the data, never hard-coded. The headline leads with what
  // the registry did — every source's eligibility rule, written as prose in
  // the original, is now a structured rule — and states the scanned count
  // honestly in context: none of the 12 registry sources is a scanned
  // image, while the Department's own scanned circulars (EVIDENCE_LEDGER A3)
  // are not yet in the registry at all.
  const total = schemes.length;
  const calculable = schemes.filter((s) => s.subsidy_rule).length;
  const scannedInRegistry = schemes.filter((s) => s.source_type === 'scanned_pdf').length;

  const render = () => {
    const lang = getLang();
    const cls = lang === 'hi' ? 'hi' : '';

    const intro = document.getElementById('intro-line');
    intro.innerHTML = '';
    intro.appendChild(el('strong', '', lang === 'en'
      ? `Each of these ${total} official sources states its eligibility rule as sentences a person has to read. The registry turns every one of them into a structured rule a machine can check — and for ${calculable}, the subsidy calculation too.`
      : `इन ${total} आधिकारिक स्रोतों में से हर एक अपना पात्रता नियम वाक्यों में लिखता है, जिसे किसी इंसान को पढ़कर समझना पड़ता है। रजिस्ट्री ने इन सभी को ऐसे संरचित नियम में बदला है जिसे मशीन जांच सके — और ${calculable} में अनुदान की गणना भी।`));
    intro.appendChild(document.createElement('br'));
    intro.appendChild(document.createTextNode(lang === 'en'
      ? `Scanned images among these sources: ${scannedInRegistry}. The Department also publishes circulars as scanned images that no software can read; none of those is in the registry yet — each would have to be transcribed by hand and verified first.`
      : `इन स्रोतों में स्कैन की गई तस्वीरें: ${scannedInRegistry}। विभाग कुछ परिपत्र स्कैन की गई तस्वीर के रूप में भी प्रकाशित करता है, जिन्हें कोई सॉफ़्टवेयर पढ़ नहीं सकता; ऐसा कोई परिपत्र अभी रजिस्ट्री में नहीं है — हर एक को पहले हाथ से ट्रांसक्राइब और सत्यापित करना होगा।`));

    listEl.innerHTML = '';
    // Same agriculture / related-welfare split the schemes page uses.
    [['agriculture', 'schemes.agriculture_heading'], ['related_welfare', 'schemes.related_welfare_heading']].forEach(([group, headingKey]) => {
    const rows = schemes.filter((s) => s.scheme_group === group);
    if (rows.length === 0) return;
    listEl.appendChild(el('h2', cls, `${t(headingKey)} (${rows.length})`));
    const grid = el('div', 'card-grid');
    rows
      .slice()
      .sort((a, b) => (a.last_verified < b.last_verified ? 1 : a.last_verified > b.last_verified ? -1 : 0))
      .forEach((scheme) => {
        const badge = badgeFor(scheme);
        const card = el('div', `card service-card ${cls}`.trim());
        const head = el('div', 'card-head');
        head.appendChild(iconSpan('scheme'));
        head.appendChild(el('span', 'answer-headline', nameFor(scheme)));
        card.appendChild(head);
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

        card.appendChild(el('p', `citation ${cls}`.trim(), t('notices.linked_scheme')));
        const schemeLink = document.createElement('a');
        schemeLink.className = `button card-action ${cls}`.trim();
        schemeLink.href = `${resolvePath('pages/check/index.html')}?scheme=${encodeURIComponent(scheme.scheme_id)}`;
        schemeLink.textContent = t('schemes.check_eligibility');
        card.appendChild(schemeLink);

        grid.appendChild(card);
      });
    listEl.appendChild(grid);
    });
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

init();
