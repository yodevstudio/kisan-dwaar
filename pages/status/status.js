import { resolvePath } from '../../js/paths.js';

// S4: entirely static, no auth, no service call — this is seeded
// demonstration data (docs/BUILD_GUIDE_V2.md: "clearly labelled as
// demonstration data"), not a real per-citizen application feed, so
// gating it behind login would add friction without protecting anything
// real. scheme_id below references real, verified records in
// data/schemes.json; application_id, submitted_on and current_stage are
// fabricated for demonstration only, never real citizen data.

const STAGES = [
  { key: 'submitted', label_hi: 'प्रस्तुत किया गया' },
  { key: 'under_review', label_hi: 'समीक्षाधीन' },
  { key: 'inspection', label_hi: 'निरीक्षण' },
  { key: 'disbursed', label_hi: 'वितरित' },
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
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderTimeline(app, schemeNames) {
  const card = el('div', 'card hi');
  card.appendChild(el('div', 'answer-headline', schemeNames[app.scheme_id] || app.scheme_id));
  card.appendChild(el('p', 'citation', `आवेदन संख्या: ${app.application_id} (डेमो) · प्रस्तुत: ${app.submitted_on}`));

  const currentIndex = STAGES.findIndex((s) => s.key === app.current_stage);
  const list = el('ol', 'status-timeline');
  STAGES.forEach((stage, i) => {
    let stepClass = 'status-step-pending';
    let icon = '⚪';
    if (i < currentIndex) { stepClass = 'status-step-done'; icon = '✅'; }
    else if (i === currentIndex) { stepClass = 'status-step-current'; icon = '🟢'; }

    const li = el('li', `status-step ${stepClass}`);
    li.appendChild(el('span', 'status-icon', icon));
    li.appendChild(el('span', 'status-label', stage.label_hi));
    list.appendChild(li);
  });
  card.appendChild(list);
  return card;
}

async function init() {
  const container = document.getElementById('timelines');
  let schemeNames = {};
  try {
    const res = await fetch(resolvePath('data/schemes.json'));
    const schemes = await res.json();
    schemeNames = Object.fromEntries(schemes.map((s) => [s.scheme_id, s.name_hi]));
  } catch (err) {
    // Falls back to raw scheme_id — still renders the timeline, since a
    // missing scheme-name lookup shouldn't take down a page that has
    // nothing to do with the registry otherwise.
    console.warn('status: could not load scheme names, falling back to scheme_id:', err);
  }
  container.innerHTML = '';
  SEED_APPLICATIONS.forEach((app) => container.appendChild(renderTimeline(app, schemeNames)));
}

init();
