// S6: extension-worker / e-Mitra operator mode. Fast multi-farmer entry,
// batch document checklists, upload-on-behalf, print — built entirely on
// the same static-core engine the citizen-facing portal uses
// (js/eligibility.js, js/assemble.js), so an operator's verdict can never
// disagree with what the same farmer would see typing it in themselves.
//
// Degradation discipline (CONTEXT.md constraint 1): everything up to and
// including the printable summary works from data/schemes.json +
// data/slots.json alone — no service call. Only "upload on behalf" (one
// button, one action) touches services/session.js and services/upload.js,
// and both are imported dynamically so a Firebase/CDN outage can never
// break farmer entry, calculation, or printing — the same pattern
// js/app.js already uses for telemetry.
import { resolvePath } from '../../js/paths.js';
import { RAJASTHAN_DISTRICTS } from '../../js/router.js';
import { evaluate } from '../../js/eligibility.js';
import { assemble } from '../../js/assemble.js';
import { UPLOAD_RETENTION_DAYS } from '../../js/policy.js';

let sessionModule = null;
let uploadModule = null;
let currentSession = null;
const uploadReady = Promise.all([
  import('../../services/session.js').then((m) => { sessionModule = m; }),
  import('../../services/upload.js').then((m) => { uploadModule = m; }),
]).catch((err) => console.warn('operator: upload-on-behalf unavailable (non-fatal, discovery/print unaffected):', err));

const CORE_FIELDS = ['age', 'gender', 'occupation', 'annual_income', 'category', 'district'];

let farmerIdCounter = 0;
const state = {
  schemes: [],
  slotsDoc: { core_sequence: [], slots: [] },
  farmers: [],
  activeId: null,
};

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function findSlotDef(slotName) {
  return state.slotsDoc.slots.find((s) => s.slot === slotName);
}

// Mirrors js/app.js's optionsForCatalogSlot — district_select carries no
// inline options in data/slots.json by design (its own note: "populated
// from the Rajasthan district list in router.js"), so RAJASTHAN_DISTRICTS
// is the single source here too, not a second copy.
function optionsForSlot(def) {
  if (Array.isArray(def.options)) return def.options.filter((o) => o.value !== null);
  if (def.type === 'district_select') {
    return [...RAJASTHAN_DISTRICTS].sort((a, b) => a.localeCompare(b, 'hi')).map((d) => ({ value: d, label_hi: d }));
  }
  return [];
}

function newFarmer() {
  farmerIdCounter += 1;
  return { id: farmerIdCounter, name: '', slots: {}, results: null };
}

function activeFarmer() {
  return state.farmers.find((f) => f.id === state.activeId);
}

function recompute(farmer) {
  const results = state.schemes.map((scheme) => ({ scheme, evaluation: evaluate(farmer.slots, scheme) }));
  farmer.results = {
    eligible: results.filter((r) => r.evaluation.verdict === 'ELIGIBLE'),
    needInfo: results.filter((r) => r.evaluation.verdict === 'NEED_MORE_INFO'),
    notEligibleCount: results.filter((r) => r.evaluation.verdict === 'NOT_ELIGIBLE').length,
  };
}

function buildSelect(def, currentValue, onChange) {
  const select = document.createElement('select');
  select.className = 'hi';
  const placeholder = el('option', '', '— चुनें —');
  placeholder.value = '';
  select.appendChild(placeholder);
  optionsForSlot(def).forEach((opt) => {
    const o = el('option', '', opt.label_hi);
    o.value = JSON.stringify(opt.value);
    select.appendChild(o);
  });
  select.value = currentValue !== undefined ? JSON.stringify(currentValue) : '';
  select.addEventListener('change', () => {
    onChange(select.value === '' ? undefined : JSON.parse(select.value));
  });
  return select;
}

function renderTabs() {
  const container = document.getElementById('farmer-tabs');
  container.innerHTML = '';
  state.farmers.forEach((farmer, i) => {
    const tab = el('button', `operator-tab${farmer.id === state.activeId ? ' operator-tab-active' : ''}`);
    tab.type = 'button';
    tab.appendChild(el('span', 'hi', farmer.name || `किसान ${i + 1}`));
    if (farmer.results) {
      const badge = el('span', 'operator-tab-count', String(farmer.results.eligible.length));
      tab.appendChild(badge);
    }
    tab.addEventListener('click', () => { state.activeId = farmer.id; renderAll(); });
    if (state.farmers.length > 1) {
      const closeBtn = el('span', 'operator-tab-close', '×');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFarmer(farmer.id);
      });
      tab.appendChild(closeBtn);
    }
    container.appendChild(tab);
  });
}

function removeFarmer(id) {
  const idx = state.farmers.findIndex((f) => f.id === id);
  if (idx === -1) return;
  state.farmers.splice(idx, 1);
  if (state.farmers.length === 0) state.farmers.push(newFarmer());
  if (state.activeId === id) state.activeId = state.farmers[Math.max(0, idx - 1)].id;
  renderAll();
}

function docLabel(doc) { return `${doc.label_hi} — ${doc.where_to_get_hi}`; }

function renderUploadRow(container, farmer, doc) {
  const row = el('div', 'operator-upload-row');
  row.appendChild(el('span', 'hi', docLabel(doc)));
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,application/pdf';
  input.disabled = !currentSession;
  const status = el('span', 'citation hi', currentSession ? '' : 'अपलोड के लिए लॉग-इन ज़रूरी');
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file || !uploadModule) return;
    input.disabled = true;
    status.textContent = 'अपलोड हो रहा है…';
    try {
      // Namespaced per farmer-tab (docId + this farmer's own counter id,
      // never reused even after a tab is closed) so two farmers uploading
      // the same document type in one operator sitting can never
      // overwrite each other under storage.rules' uploads/{uid}/{docId}/…
      // path — {docId} there is one opaque path segment, so this is a
      // purely client-side choice, no rule change needed.
      const { reference } = await uploadModule.uploadDocument(`${doc.doc_id}_op${farmer.id}`, file);
      status.textContent = `✅ अपलोड सफल — संदर्भ: ${reference}`;
    } catch (err) {
      console.error('operator: upload failed:', err);
      status.textContent = `⚠ अपलोड विफल: ${err.message || err.code}`;
      input.disabled = false;
    }
  });
  row.appendChild(input);
  row.appendChild(status);
  container.appendChild(row);
}

function renderResults(farmer) {
  const wrap = el('div');
  if (!farmer.results) {
    wrap.appendChild(el('p', 'hi citation', 'ऊपर छह जानकारी भरते ही नतीजे यहाँ अपने-आप दिखेंगे।'));
    return wrap;
  }
  const { eligible, needInfo, notEligibleCount } = farmer.results;

  wrap.appendChild(el('p', 'hi', `पात्र: ${eligible.length} · जानकारी चाहिए: ${needInfo.length} · अपात्र: ${notEligibleCount}`));

  if (eligible.length > 0) {
    wrap.appendChild(el('h3', 'hi', '✅ पात्र योजनाएं व दस्तावेज़'));
    const byDoc = new Map();
    eligible.forEach(({ scheme, evaluation }) => {
      const card = el('div', 'card bg-verdict hi');
      const output = assemble('ELIGIBLE', scheme, evaluation);
      card.appendChild(el('div', 'answer-headline', scheme.name_hi));
      card.appendChild(el('p', '', output.text_hi));
      card.appendChild(el('p', 'citation', `स्रोत: ${scheme.source_url} · जाँचा गया: ${scheme.last_verified}`));
      wrap.appendChild(card);
      (scheme.documents || []).forEach((doc) => { if (!byDoc.has(doc.doc_id)) byDoc.set(doc.doc_id, doc); });
    });

    if (byDoc.size > 0) {
      const docCard = el('div', 'card hi');
      docCard.appendChild(el('div', 'answer-headline', 'बैच दस्तावेज़ सूची (सभी पात्र योजनाओं का सम्मिलित)'));
      const uploadWrap = el('div', 'no-print');
      [...byDoc.values()].forEach((doc) => renderUploadRow(uploadWrap, farmer, doc));
      docCard.appendChild(uploadWrap);
      wrap.appendChild(docCard);
    }
  }

  if (needInfo.length > 0) {
    wrap.appendChild(el('h3', 'hi', 'ℹ️ अतिरिक्त जानकारी चाहिए'));
    const missingSlots = new Set();
    needInfo.forEach(({ evaluation }) => evaluation.missing_slots.forEach((s) => missingSlots.add(s)));
    const extraGrid = el('div', 'cms-form-grid no-print');
    [...missingSlots].forEach((slotName) => {
      const def = findSlotDef(slotName);
      if (!def) return;
      const field = el('div', 'cms-field');
      field.appendChild(el('label', 'hi', def.question_hi));
      const select = buildSelect(def, farmer.slots[slotName], (value) => {
        farmer.slots[slotName] = value;
        recompute(farmer);
        renderFarmerPanel();
      });
      field.appendChild(select);
      extraGrid.appendChild(field);
    });
    wrap.appendChild(extraGrid);

    const list = el('ul', 'doc-list hi');
    needInfo.forEach(({ scheme }) => list.appendChild(el('li', '', scheme.name_hi)));
    wrap.appendChild(list);
  }

  return wrap;
}

function renderFarmerPanel() {
  const farmer = activeFarmer();
  const panel = document.getElementById('farmer-panel');
  panel.innerHTML = '';
  if (!farmer) return;

  const card = el('div', 'card hi');
  const nameField = el('div', 'cms-field');
  nameField.appendChild(el('label', 'hi', 'किसान का नाम (केवल इस स्क्रीन पर — कहीं संग्रहीत नहीं होता)'));
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'hi';
  nameInput.value = farmer.name;
  nameInput.addEventListener('input', () => { farmer.name = nameInput.value; renderTabs(); });
  nameField.appendChild(nameInput);
  card.appendChild(nameField);

  const grid = el('div', 'cms-form-grid');
  CORE_FIELDS.forEach((slotName) => {
    const def = findSlotDef(slotName);
    if (!def) return;
    const field = el('div', 'cms-field');
    field.appendChild(el('label', 'hi', def.question_hi));
    const select = buildSelect(def, farmer.slots[slotName], (value) => {
      farmer.slots[slotName] = value;
      recompute(farmer);
      renderTabs();
      renderFarmerPanel();
    });
    field.appendChild(select);
    grid.appendChild(field);
  });
  card.appendChild(grid);
  panel.appendChild(card);

  const resultsCard = el('div', 'card hi');
  resultsCard.appendChild(renderResults(farmer));
  panel.appendChild(resultsCard);
}

function renderAll() {
  renderTabs();
  renderFarmerPanel();
}

// ===== Print =====
// A one-page-per-farmer printable summary — same verdicts and document
// list the on-screen view shows, formatted for handing to a citizen. No
// state emblem, no official seal (CONTEXT.md constraint 7): this is
// clearly a prototype output, carrying the same disclosure line every
// other page does.
function buildPrintFarmer(farmer) {
  const section = el('div', 'print-farmer');
  section.appendChild(el('h2', '', farmer.name || 'किसान'));
  section.appendChild(el('p', 'citation', `बना: ${new Date().toLocaleString('hi-IN')} · प्रस्ताव प्रोटोटाइप — YoDevStudio, आधिकारिक दस्तावेज़ नहीं`));

  if (!farmer.results || (farmer.results.eligible.length === 0 && farmer.results.needInfo.length === 0)) {
    section.appendChild(el('p', '', 'कोई नतीजा उपलब्ध नहीं — पहले जानकारी भरें।'));
    return section;
  }

  const { eligible, needInfo } = farmer.results;
  if (eligible.length > 0) {
    section.appendChild(el('h3', '', 'पात्र योजनाएं'));
    const byDoc = new Map();
    eligible.forEach(({ scheme, evaluation }) => {
      const p = el('p', '');
      const output = assemble('ELIGIBLE', scheme, evaluation);
      p.innerHTML = `<strong>${scheme.name_hi}</strong> — ${output.text_hi}`;
      section.appendChild(p);
      (scheme.documents || []).forEach((doc) => { if (!byDoc.has(doc.doc_id)) byDoc.set(doc.doc_id, doc); });
    });
    if (byDoc.size > 0) {
      section.appendChild(el('h3', '', 'ज़रूरी दस्तावेज़ (सम्मिलित सूची)'));
      const list = el('ul', 'doc-list');
      [...byDoc.values()].forEach((doc) => list.appendChild(el('li', '', docLabel(doc))));
      section.appendChild(list);
    }
  }
  if (needInfo.length > 0) {
    section.appendChild(el('h3', '', 'अतिरिक्त जानकारी लंबित'));
    const list = el('ul', 'doc-list');
    needInfo.forEach(({ scheme }) => list.appendChild(el('li', '', scheme.name_hi)));
    section.appendChild(list);
  }
  return section;
}

function printFarmers(farmers) {
  const area = document.getElementById('print-area');
  area.innerHTML = '';
  farmers.forEach((farmer, i) => {
    const section = buildPrintFarmer(farmer);
    if (i < farmers.length - 1) section.classList.add('print-page-break');
    area.appendChild(section);
  });
  window.print();
}

async function init() {
  const [schemes, slotsDoc] = await Promise.all([
    fetch(resolvePath('data/schemes.json')).then((r) => r.json()),
    fetch(resolvePath('data/slots.json')).then((r) => r.json()),
  ]);
  state.schemes = schemes;
  state.slotsDoc = slotsDoc;
  state.farmers = [newFarmer()];
  state.activeId = state.farmers[0].id;
  renderAll();

  document.getElementById('add-farmer-btn').addEventListener('click', () => {
    const farmer = newFarmer();
    state.farmers.push(farmer);
    state.activeId = farmer.id;
    renderAll();
  });

  document.getElementById('print-active-btn').addEventListener('click', () => {
    const farmer = activeFarmer();
    if (farmer) printFarmers([farmer]);
  });

  document.getElementById('print-all-btn').addEventListener('click', () => {
    printFarmers(state.farmers);
  });

  // T10: stated here, before any file is chosen — same discipline as
  // services/upload-demo.html's own consent panel, since this screen (not
  // that dev-only one) is the upload path a real farmer's document
  // actually goes through today.
  document.getElementById('upload-scan-line').textContent =
    `प्रतिधारण अवधि: ${UPLOAD_RETENTION_DAYS} दिन बाद स्वतः हटाई जाती है। वायरस स्कैनिंग: अभी लागू नहीं है — डिज़ाइन में तय है, पर बनाई नहीं गई; जाँच अभी सिर्फ़ प्रकार, आकार व पृष्ठ-संख्या तक सीमित है।`;

  const statusEl = document.getElementById('upload-session-status');
  uploadReady.then(() => {
    if (!sessionModule) {
      statusEl.textContent = '⚠ अपलोड सेवा अभी उपलब्ध नहीं — पात्रता जांच व प्रिंट पर कोई असर नहीं।';
      return;
    }
    sessionModule.onSessionChange((session) => {
      currentSession = session;
      if (session) {
        statusEl.textContent = `✅ अपलोड हेतु लॉग-इन है — uid: ${session.uid}`;
      } else {
        statusEl.innerHTML = '';
        statusEl.appendChild(document.createTextNode('अपलोड करने के लिए लॉग-इन करें: '));
        const btn = el('button', 'button hi', 'Google से लॉग-इन करें');
        btn.type = 'button';
        btn.addEventListener('click', () => sessionModule.login());
        statusEl.appendChild(btn);
      }
      renderFarmerPanel(); // re-render so upload inputs enable/disable correctly
    });
  });
}

init();
