import { resolvePath } from '../../js/paths.js';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

async function init() {
  const listEl = document.getElementById('scheme-list');
  let schemes;
  try {
    schemes = await (await fetch(resolvePath('data/schemes.json'))).json();
  } catch (err) {
    listEl.innerHTML = '';
    listEl.appendChild(el('p', 'hi', 'योजना सूची लोड नहीं हो सकी।'));
    console.error('schemes page: failed to load data/schemes.json:', err);
    return;
  }

  document.getElementById('intro-line').textContent =
    `राजस्थान की ${schemes.length} कृषि योजनाएं, हर एक स्रोत व जाँच-तिथि सहित। किसी योजना पर टैप करके सीधे उसकी पात्रता जाँच शुरू करें।`;

  listEl.innerHTML = '';
  schemes.forEach((scheme) => {
    const card = el('div', 'card hi');
    card.appendChild(el('div', 'answer-headline', scheme.name_hi));
    card.appendChild(el('p', '', scheme.department));
    if (scheme.keywords_hi && scheme.keywords_hi.length) {
      card.appendChild(el('p', 'citation', scheme.keywords_hi.join(' · ')));
    }
    card.appendChild(el('p', 'citation', `स्रोत: ${scheme.source_url} · जाँचा गया: ${scheme.last_verified}`));

    const link = document.createElement('a');
    link.className = 'button hi';
    link.href = `${resolvePath('index.html')}?scheme=${encodeURIComponent(scheme.scheme_id)}`;
    link.textContent = 'पात्रता जांचें';
    card.appendChild(link);

    listEl.appendChild(card);
  });
}

init();
