import { resolvePath } from '../../js/paths.js';
import { getLang, t } from '../../js/i18n.js';

// S4: entirely static, no auth, no service call — this is seeded
// demonstration data (docs/BUILD_GUIDE_V2.md: "clearly labelled as
// demonstration data"), not a real per-citizen application feed, so
// gating it behind login would add friction without protecting anything
// real. scheme_id below references real, verified records in
// data/schemes.json; application_id, submitted_on and current_stage are
// fabricated for demonstration only, never real citizen data.

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
