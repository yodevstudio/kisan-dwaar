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

function docLabelFor(doc) {
  return getLang() === 'en' && doc.label_en ? doc.label_en : doc.label_hi;
}

function docWhereFor(doc) {
  return getLang() === 'en' && doc.where_to_get_en ? doc.where_to_get_en : doc.where_to_get_hi;
}

async function init() {
  const listEl = document.getElementById('document-list');
  let schemes;
  try {
    schemes = await (await fetch(resolvePath('data/schemes.json'))).json();
  } catch (err) {
    listEl.innerHTML = '';
    listEl.appendChild(el('p', 'hi', t('documents.load_error')));
    console.error('documents page: failed to load data/schemes.json:', err);
    return;
  }

  // Aggregates by doc_id — every scheme that lists an identical doc_id is
  // assumed to mean the same real-world document (e.g. AADHAAR), so it's
  // shown once with every scheme that needs it, not once per scheme.
  const byDocId = new Map();
  for (const scheme of schemes) {
    for (const doc of scheme.documents || []) {
      if (!byDocId.has(doc.doc_id)) byDocId.set(doc.doc_id, { ...doc, schemeRefs: [] });
      byDocId.get(doc.doc_id).schemeRefs.push(scheme);
    }
  }

  const render = () => {
    const cls = getLang() === 'hi' ? 'hi' : '';
    listEl.innerHTML = '';
    [...byDocId.values()]
      .sort((a, b) => b.schemeRefs.length - a.schemeRefs.length)
      .forEach((doc) => {
        const card = el('div', `card ${cls}`.trim());
        card.appendChild(el('div', 'answer-headline', docLabelFor(doc)));
        card.appendChild(el('p', '', `${t('documents.where_to_get')}: ${docWhereFor(doc)}`));
        card.appendChild(el('p', 'doc-list-title', `${t('documents.for_schemes')} (${doc.schemeRefs.length}):`));
        const schemeList = el('ul', 'doc-list');
        doc.schemeRefs.forEach((scheme) => schemeList.appendChild(el('li', '', nameFor(scheme))));
        card.appendChild(schemeList);
        listEl.appendChild(card);
      });
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

init();
