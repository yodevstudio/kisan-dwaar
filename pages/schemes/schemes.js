import { resolvePath } from '../../js/paths.js';
import { getLang, t } from '../../js/i18n.js';
import { iconSpan } from '../../js/icons.js';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function nameFor(scheme) {
  return getLang() === 'en' && scheme.name_en ? scheme.name_en : scheme.name_hi;
}

function renderCard(scheme, cls, lang) {
  const card = el('div', `card service-card ${cls}`.trim());
  const head = el('div', 'card-head');
  head.appendChild(iconSpan('scheme'));
  head.appendChild(el('span', 'answer-headline', nameFor(scheme)));
  card.appendChild(head);
  card.appendChild(el('p', '', scheme.department));
  const keywords = lang === 'en' && scheme.keywords_en ? scheme.keywords_en : scheme.keywords_hi;
  if (keywords && keywords.length) {
    card.appendChild(el('p', 'citation', keywords.join(' · ')));
  }
  card.appendChild(el('p', 'citation', `${t('chat.source')}: ${scheme.source_url} · ${t('chat.verified_on')}: ${scheme.last_verified}`));

  const link = document.createElement('a');
  link.className = `button ${cls}`.trim();
  link.href = `${resolvePath('pages/check/index.html')}?scheme=${encodeURIComponent(scheme.scheme_id)}`;
  link.textContent = t('schemes.check_eligibility');
  card.appendChild(link);
  return card;
}

async function init() {
  const listEl = document.getElementById('scheme-list');
  let schemes;
  try {
    schemes = await (await fetch(resolvePath('data/schemes.json'))).json();
  } catch (err) {
    listEl.innerHTML = '';
    listEl.appendChild(el('p', 'hi', t('schemes.load_error')));
    console.error('schemes page: failed to load data/schemes.json:', err);
    return;
  }

  // T2: data/schemes.json mixes Rajasthan Agriculture Department schemes
  // with schemes issued by other departments (rural housing, health, food
  // security, LPG, rural employment) — grouped here by each record's own
  // scheme_group, never by a hard-coded list, so the split always matches
  // the data.
  const agriculture = schemes.filter((s) => s.scheme_group === 'agriculture');
  const relatedWelfare = schemes.filter((s) => s.scheme_group === 'related_welfare');

  const render = () => {
    const lang = getLang();
    const cls = lang === 'hi' ? 'hi' : '';

    document.getElementById('intro-line').textContent = lang === 'en'
      ? `${schemes.length} verified Rajasthan schemes, each with its source and verification date. Tap any scheme to check your eligibility for it directly.`
      : `राजस्थान की ${schemes.length} सत्यापित योजनाएं, हर एक स्रोत व जाँच-तिथि सहित। किसी योजना पर टैप करके सीधे उसकी पात्रता जाँच शुरू करें।`;

    listEl.innerHTML = '';

    if (agriculture.length > 0) {
      listEl.appendChild(el('h2', cls, `${t('schemes.agriculture_heading')} (${agriculture.length})`));
      const grid = el('div', 'card-grid');
      agriculture.forEach((scheme) => grid.appendChild(renderCard(scheme, cls, lang)));
      listEl.appendChild(grid);
    }

    if (relatedWelfare.length > 0) {
      listEl.appendChild(el('h2', cls, `${t('schemes.related_welfare_heading')} (${relatedWelfare.length})`));
      listEl.appendChild(el('p', `citation ${cls}`.trim(), t('schemes.related_welfare_note')));
      const grid = el('div', 'card-grid');
      relatedWelfare.forEach((scheme) => grid.appendChild(renderCard(scheme, cls, lang)));
      listEl.appendChild(grid);
    }
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

init();
