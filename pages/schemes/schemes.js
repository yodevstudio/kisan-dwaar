import { resolvePath } from '../../js/paths.js';
import { getLang, t } from '../../js/i18n.js';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function nameFor(scheme) {
  return getLang() === 'en' && scheme.name_en ? scheme.name_en : scheme.name_hi;
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

  const render = () => {
    const lang = getLang();
    const cls = lang === 'hi' ? 'hi' : '';
    document.getElementById('intro-line').textContent = lang === 'en'
      ? `${schemes.length} verified Rajasthan agriculture schemes, each with its source and verification date. Tap any scheme to check your eligibility for it directly.`
      : `राजस्थान की ${schemes.length} कृषि योजनाएं, हर एक स्रोत व जाँच-तिथि सहित। किसी योजना पर टैप करके सीधे उसकी पात्रता जाँच शुरू करें।`;

    listEl.innerHTML = '';
    schemes.forEach((scheme) => {
      const card = el('div', `card ${cls}`.trim());
      card.appendChild(el('div', 'answer-headline', nameFor(scheme)));
      card.appendChild(el('p', '', scheme.department));
      const keywords = lang === 'en' && scheme.keywords_en ? scheme.keywords_en : scheme.keywords_hi;
      if (keywords && keywords.length) {
        card.appendChild(el('p', 'citation', keywords.join(' · ')));
      }
      card.appendChild(el('p', 'citation', `${t('chat.source')}: ${scheme.source_url} · ${t('chat.verified_on')}: ${scheme.last_verified}`));

      const link = document.createElement('a');
      link.className = `button ${cls}`.trim();
      link.href = `${resolvePath('index.html')}?scheme=${encodeURIComponent(scheme.scheme_id)}`;
      link.textContent = t('schemes.check_eligibility');
      card.appendChild(link);

      listEl.appendChild(card);
    });
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

init();
