import { resolvePath } from '../../js/paths.js';
import { getLang, t } from '../../js/i18n.js';

// S4: entirely static, no auth, no service call — this is seeded
// demonstration data (docs/BUILD_GUIDE_V2.md: "clearly labelled as
// demonstration data"), not a real per-citizen application feed, so
// gating it behind login would add friction without protecting anything
// real. scheme_id below references real, verified records in
// data/schemes.json; application_id, submitted_on and current_stage are
// fabricated for demonstration only, never real citizen data.
//
// T10: the section above this demo one is the opposite case — real
// records, so it IS gated behind login (services/session.js, services/
// upload.js's listMyUploads()), loaded dynamically so a Firebase/CDN
// outage degrades to "can't check real uploads right now" without ever
// touching the demo timelines below, which have no service dependency at all.

const STAGES = [
  { key: 'submitted', i18nKey: 'status.stage.submitted' },
  { key: 'under_review', i18nKey: 'status.stage.under_review' },
  { key: 'inspection', i18nKey: 'status.stage.inspection' },
  { key: 'disbursed', i18nKey: 'status.stage.disbursed' },
];

const SEED_APPLICATIONS = [
  { application_id: 'DEMO-0001', scheme_id: 'RJ_TARBANDI', submitted_on: '2026-07-02', current_stage: 'submitted' },
  { application_id: 'DEMO-0002', scheme_id: 'RJ_DRIP_SPRINKLER', submitted_on: '2026-06-18', current_stage: 'under_review' },
  { application_id: 'DEMO-0003', scheme_id: 'RJ_FARM_POND', submitted_on: '2026-05-30', current_stage: 'inspection' },
  { application_id: 'DEMO-0004', scheme_id: 'RJ_KCC', submitted_on: '2026-04-11', current_stage: 'disbursed' },
];

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function langClass(base) {
  return getLang() === 'hi' ? `${base} hi` : base;
}

function renderTimeline(app, schemeNames) {
  const card = el('div', langClass('card'));
  card.appendChild(el('div', 'answer-headline', schemeNames[app.scheme_id] || app.scheme_id));
  card.appendChild(el('p', 'citation', `${t('status.application_no')}: ${app.application_id} ${t('status.demo_note')} · ${t('status.submitted_on')}: ${app.submitted_on}`));

  const currentIndex = STAGES.findIndex((s) => s.key === app.current_stage);
  const list = el('ol', 'status-timeline');
  STAGES.forEach((stage, i) => {
    let stepClass = 'status-step-pending';
    let icon = '⚪';
    if (i < currentIndex) { stepClass = 'status-step-done'; icon = '✅'; }
    else if (i === currentIndex) { stepClass = 'status-step-current'; icon = '🟢'; }

    const li = el('li', `status-step ${stepClass}`);
    li.appendChild(el('span', 'status-icon', icon));
    li.appendChild(el('span', 'status-label', t(stage.i18nKey)));
    list.appendChild(li);
  });
  card.appendChild(list);
  return card;
}

function formatBytes(n) {
  if (typeof n !== 'number') return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Real record, visually distinct from renderTimeline's demo cards: green
// (bg-verdict) border instead of the plain default, every field read
// straight from the uploads_audit event uploadDocument() wrote — nothing
// here is a guess or a placeholder.
function renderRealUpload(record) {
  const lang = getLang();
  const card = el('div', langClass('card bg-verdict'));
  card.appendChild(el('div', 'answer-headline', record.fileName || record.docId || record.id));
  const when = record.uploadedAt && record.uploadedAt.toDate
    ? record.uploadedAt.toDate().toLocaleString(lang === 'en' ? 'en-IN' : 'hi-IN')
    : '…';
  const sizeText = formatBytes(record.size);
  card.appendChild(el('p', 'citation',
    `${t('status.real_reference')}: ${record.reference || '—'} · ${t('status.real_uploaded_on')}: ${when}${sizeText ? ' · ' + sizeText : ''}`));
  return card;
}

function initRealUploads() {
  const gateEl = document.getElementById('real-upload-gate');
  const listEl = document.getElementById('real-uploads');
  let sessionModule = null;
  let uploadModule = null;

  const ready = Promise.all([
    import('../../services/session.js').then((m) => { sessionModule = m; }),
    import('../../services/upload.js').then((m) => { uploadModule = m; }),
  ]).catch((err) => console.warn('status: real-uploads service layer unavailable (non-fatal, demo section unaffected):', err));

  ready.then(() => {
    if (!sessionModule || !uploadModule) {
      gateEl.innerHTML = '';
      gateEl.appendChild(el('p', 'hi term-warning', '⚠ सेवा-स्तर अभी उपलब्ध नहीं — असली अपलोड यहाँ नहीं दिखाए जा सकते; नीचे दी गई डेमो सूची पर कोई असर नहीं।'));
      return;
    }

    let lastSession = null;
    let lastRecords = null;

    const renderGate = () => {
      gateEl.innerHTML = '';
      listEl.innerHTML = '';
      if (!lastSession) {
        gateEl.appendChild(el('p', 'hi', t('status.real_login_prompt')));
        const btn = el('button', 'button hi', 'Google से लॉग-इन करें');
        btn.type = 'button';
        btn.addEventListener('click', () => sessionModule.login());
        gateEl.appendChild(btn);
        return;
      }
      gateEl.appendChild(el('p', 'hi citation', `✅ लॉग-इन है — uid: ${lastSession.uid}`));
      if (lastRecords === null) return; // still loading — filled in once the fetch below resolves
      if (lastRecords.length === 0) {
        listEl.appendChild(el('p', 'hi citation', t('status.real_none')));
        return;
      }
      lastRecords.forEach((r) => listEl.appendChild(renderRealUpload(r)));
    };

    // Re-render on a language toggle using whatever was already fetched —
    // never re-fetches just because the citizen switched languages.
    window.addEventListener('kisan:langchange', renderGate);

    sessionModule.onSessionChange((session) => {
      lastSession = session;
      lastRecords = null;
      renderGate();
      if (!session) return;
      uploadModule.listMyUploads()
        .then((records) => { lastRecords = records; renderGate(); })
        .catch((err) => {
          console.error('status: listMyUploads failed:', err);
          lastRecords = [];
          renderGate();
          listEl.appendChild(el('p', 'hi term-warning', 'असली अपलोड लोड नहीं हो सके।'));
        });
    });
  });
}

async function init() {
  const container = document.getElementById('timelines');
  let schemes = [];
  try {
    const res = await fetch(resolvePath('data/schemes.json'));
    schemes = await res.json();
  } catch (err) {
    // Falls back to raw scheme_id — still renders the timeline, since a
    // missing scheme-name lookup shouldn't take down a page that has
    // nothing to do with the registry otherwise.
    console.warn('status: could not load scheme names, falling back to scheme_id:', err);
  }

  const render = () => {
    const lang = getLang();
    const schemeNames = Object.fromEntries(
      schemes.map((s) => [s.scheme_id, lang === 'en' && s.name_en ? s.name_en : s.name_hi]),
    );
    container.innerHTML = '';
    SEED_APPLICATIONS.forEach((app) => container.appendChild(renderTimeline(app, schemeNames)));
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

init();
initRealUploads();
