// T7: index.html is now a portal home, not the chat itself — the chat
// moved to pages/check/ (js/app.js is unchanged, just hosted from a new
// page). This script only renders three read-only previews from data
// already fetched elsewhere in the static core: the agriculture scheme
// cards, the subsidy-calculator service card's scheme count, and the
// three most recent notices — same fetch, same fields, same badge logic
// pages/notices/notices.js already uses, so the two pages can never
// disagree about which badge a scheme gets.
import { resolvePath } from './paths.js';
import { getLang, t } from './i18n.js';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function nameFor(scheme) {
  return getLang() === 'en' && scheme.name_en ? scheme.name_en : scheme.name_hi;
}

// Mirrors pages/notices/notices.js's badgeFor exactly — 🟢 takes priority
// (rules already extracted into the registry, regardless of source
// format); among the rest, 🔴 only for a scanned image, 🟡 otherwise.
function badgeFor(scheme) {
  if (scheme.subsidy_rule) return { icon: '🟢', key: 'notices.badge_registry' };
  if (scheme.source_type === 'scanned_pdf') return { icon: '🔴', key: 'notices.badge_scanned' };
  return { icon: '🟡', key: 'notices.badge_text_source' };
}

function renderAgricultureCards(schemes) {
  const container = document.getElementById('agri-scheme-cards');
  const agriculture = schemes.filter((s) => s.scheme_group === 'agriculture');

  const render = () => {
    const lang = getLang();
    const cls = lang === 'hi' ? 'hi' : '';
    container.innerHTML = '';
    if (agriculture.length === 0) {
      container.appendChild(el('p', cls, t('home.schemes_load_error')));
      return;
    }
    agriculture.forEach((scheme) => {
      const link = document.createElement('a');
      link.className = `card service-card ${cls}`.trim();
      link.href = `${resolvePath('pages/check/index.html')}?scheme=${encodeURIComponent(scheme.scheme_id)}`;
      link.appendChild(el('div', 'answer-headline', nameFor(scheme)));
      link.appendChild(el('p', `citation ${cls}`.trim(), `${t('chat.verified_on')}: ${scheme.last_verified}`));
      container.appendChild(link);
    });
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

function renderCalculatorCard(schemes) {
  const bodyEl = document.getElementById('service-calculator-body');
  const withRule = schemes.filter((s) => s.subsidy_rule);

  const render = () => {
    const lang = getLang();
    const names = withRule.map(nameFor);
    bodyEl.className = lang === 'hi' ? 'hi' : '';
    if (names.length === 0) {
      bodyEl.textContent = lang === 'en'
        ? 'No scheme in the registry has a computable subsidy rule yet.'
        : 'फिलहाल रजिस्ट्री में किसी भी योजना का अनुदान-नियम गणना योग्य नहीं है।';
      return;
    }
    const joined = names.join(lang === 'en' ? ' and ' : ' व ');
    bodyEl.textContent = lang === 'en'
      ? `Available for ${names.length} scheme${names.length > 1 ? 's' : ''} whose rule is already in the registry — ${joined}. Check eligibility first; the calculator appears there. There is no separate calculator page yet.`
      : `उन ${names.length} योजनाओं के लिए उपलब्ध जिनका नियम पहले से रजिस्ट्री में है — ${joined}। पहले पात्रता जांचें; कैलकुलेटर वहीं दिखेगा। एक अलग कैलकुलेटर पन्ना अभी नहीं बनाया गया है।`;
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

function renderNoticesStrip(schemes) {
  const container = document.getElementById('notices-strip');
  const recent = schemes
    .slice()
    .sort((a, b) => (a.last_verified < b.last_verified ? 1 : a.last_verified > b.last_verified ? -1 : 0))
    .slice(0, 3);

  const render = () => {
    const lang = getLang();
    const cls = lang === 'hi' ? 'hi' : '';
    container.innerHTML = '';
    if (recent.length === 0) {
      container.appendChild(el('p', cls, t('home.notices_load_error')));
      return;
    }
    const list = el('ul', 'doc-list');
    recent.forEach((scheme) => {
      const badge = badgeFor(scheme);
      list.appendChild(el('li', cls, `${badge.icon} ${nameFor(scheme)} — ${t('chat.verified_on')}: ${scheme.last_verified}`));
    });
    container.appendChild(list);
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

async function init() {
  let schemes;
  try {
    schemes = await (await fetch(resolvePath('data/schemes.json'))).json();
  } catch (err) {
    console.error('home: failed to load data/schemes.json:', err);
    schemes = [];
  }
  renderAgricultureCards(schemes);
  renderCalculatorCard(schemes);
  renderNoticesStrip(schemes);
}

init();
