import { resolvePath } from '../../js/paths.js';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

async function init() {
  const listEl = document.getElementById('document-list');
  let schemes;
  try {
    schemes = await (await fetch(resolvePath('data/schemes.json'))).json();
  } catch (err) {
    listEl.innerHTML = '';
    listEl.appendChild(el('p', 'hi', 'दस्तावेज़ सूची लोड नहीं हो सकी।'));
    console.error('documents page: failed to load data/schemes.json:', err);
    return;
  }

  // Aggregates by doc_id — every scheme that lists an identical doc_id is
  // assumed to mean the same real-world document (e.g. AADHAAR), so it's
  // shown once with every scheme that needs it, not once per scheme.
  const byDocId = new Map();
  for (const scheme of schemes) {
    for (const doc of scheme.documents || []) {
      if (!byDocId.has(doc.doc_id)) byDocId.set(doc.doc_id, { ...doc, schemes: [] });
      byDocId.get(doc.doc_id).schemes.push(scheme.name_hi);
    }
  }

  listEl.innerHTML = '';
  [...byDocId.values()]
    .sort((a, b) => b.schemes.length - a.schemes.length)
    .forEach((doc) => {
      const card = el('div', 'card hi');
      card.appendChild(el('div', 'answer-headline', doc.label_hi));
      card.appendChild(el('p', '', `कहाँ से मिलेगा: ${doc.where_to_get_hi}`));
      card.appendChild(el('p', 'doc-list-title', `किन योजनाओं के लिए (${doc.schemes.length}):`));
      const schemeList = el('ul', 'doc-list');
      doc.schemes.forEach((name) => schemeList.appendChild(el('li', '', name)));
      card.appendChild(schemeList);
      listEl.appendChild(card);
    });
}

init();
