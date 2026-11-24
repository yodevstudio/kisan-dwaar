// T8: the officer-facing dashboard over S3's telemetry (services/telemetry.js)
// plus registry-derived operational metrics. Gated behind the same
// Google sign-in admin/cms/ already uses — not because the usage counters
// need it (analytics_counters is public-read, per firestore.rules), but
// because the operational section reads cms_drafts, which isn't, and a
// single page shouldn't be half-gated. Every number below is either a
// real Firestore counter total or a direct read of data/schemes.json —
// nothing here is computed by re-running eligibility.js or any other
// scoring path.
import { app } from './firebase-app.js';
import { resolvePath } from '../js/paths.js';
import { t } from '../js/i18n.js';
import { ANALYTICS_NEVER_COLLECTED_HI } from '../js/policy.js';
import { onSessionChange, login } from './session.js';
import { listDrafts } from './cms.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const db = getFirestore(app);

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function list(rows, formatRow) {
  const ul = el('ul', 'doc-list');
  if (rows.length === 0) {
    ul.appendChild(el('li', '', 'कोई नहीं'));
    return ul;
  }
  rows.forEach((row) => ul.appendChild(el('li', '', formatRow(row))));
  return ul;
}

const VERDICT_LABELS_HI = { ELIGIBLE: 'पात्र', NOT_ELIGIBLE: 'अपात्र', NEED_MORE_INFO: 'जानकारी चाहिए' };

// core_sequence's fixed 6-question order (data/slots.json) — the only
// slots "drop-off by question number" means anything for; every other
// slot a scheme asks (landholding, group size, ...) has no fixed ordinal
// position across schemes, so it stays out of this specific table.
const CORE_SEQUENCE_LABELS_HI = {
  age: 'आयु',
  gender: 'लिंग',
  occupation: 'व्यवसाय',
  annual_income: 'वार्षिक आय',
  category: 'श्रेणी',
  district: 'जिला',
};

async function loadSchemes() {
  const res = await fetch(resolvePath('data/schemes.json'));
  return res.json();
}

async function loadCounters() {
  const snap = await getDocs(collection(db, 'analytics_counters'));
  // Sum every date's counter into one cumulative total per
  // {event_type, discriminator} — a running total, not a day-by-day
  // trend, matching docs/ANALYTICS.md §4's own storage model.
  const totals = new Map();
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const key = `${d.event_type}\u0000${d.discriminator}`;
    totals.set(key, (totals.get(key) || 0) + d.count);
  });
  const byEventType = new Map();
  for (const [key, count] of totals) {
    const [eventType, discriminator] = key.split('\u0000');
    if (!byEventType.has(eventType)) byEventType.set(eventType, new Map());
    byEventType.get(eventType).set(discriminator, count);
  }
  return byEventType;
}

function sumMap(m) {
  return [...(m ? m.values() : [])].reduce((a, b) => a + b, 0);
}

function renderUsageSummary(byEventType) {
  const host = document.getElementById('usage-summary');
  host.innerHTML = '';
  const pageViews = byEventType.get('page_view');
  const totalVisits = sumMap(pageViews);
  host.appendChild(el('p', 'result-line', `कुल पेज व्यू: ${totalVisits}`));
  if (totalVisits === 0) {
    host.appendChild(el('p', 'citation hi', 'डैशबोर्ड लाइव है, पर प्रोटोटाइप पर अभी ट्रैफ़िक बहुत कम है — यह वास्तविक शून्य है, कोई त्रुटि नहीं।'));
    return;
  }
  const rows = [...(pageViews || new Map())].sort((a, b) => b[1] - a[1]);
  host.appendChild(list(rows, ([path, count]) => `${path.replace(/_/g, '/')} — ${count}`));
}

// "Started" = a page_view whose discriminator (a sanitized path — see
// services/telemetry.js's sanitizeForDocId) ends in the check page's own
// path segment, matched by substring since the same discriminator string
// differs between the Netlify root deployment and the GitHub Pages
// "/kisan-dwaar/" mirror (both write into the same Firestore project).
// "Completed" = any verdict_issued, of any type — evaluate() having
// produced a verdict at all, not a stricter one-session-one-check
// definition this telemetry has no way to express. Labelled as exactly
// that, not oversold as a stricter funnel.
function renderFunnel(byEventType) {
  const host = document.getElementById('funnel');
  host.innerHTML = '';
  const pageViews = byEventType.get('page_view') || new Map();
  const verdicts = byEventType.get('verdict_issued') || new Map();
  const started = [...pageViews].filter(([disc]) => disc.includes('pages/check') || disc.includes('pages_check')).reduce((a, [, c]) => a + c, 0);
  const completed = sumMap(verdicts);
  host.appendChild(el('p', 'result-line', `शुरू (पात्रता जांच पेज पर पहुंचे): ${started}`));
  host.appendChild(el('p', 'result-line', `पूर्ण (कोई भी निर्णय जारी हुआ): ${completed}`));
  host.appendChild(el('p', 'citation hi', 'ये दो संख्याएं एक ही सत्र का सख्त फ़नल नहीं हैं — एक नागरिक कई बार निर्णय पा सकता है, या पेज खोलकर कोई सवाल न जवाब दे। यह वही है जो वास्तव में गिना जाता है, न ज़्यादा न कम।'));
  if (started === 0 && completed === 0) {
    host.appendChild(el('p', 'citation hi', 'डैशबोर्ड लाइव है, पर प्रोटोटाइप पर अभी ट्रैफ़िक बहुत कम है।'));
  }
}

function renderVerdicts(byEventType) {
  const host = document.getElementById('verdicts');
  host.innerHTML = '';
  const verdicts = byEventType.get('verdict_issued') || new Map();
  if (verdicts.size === 0) {
    host.appendChild(el('p', 'citation hi', 'अभी कोई निर्णय दर्ज नहीं — डैशबोर्ड लाइव है, ट्रैफ़िक कम है।'));
    return;
  }
  const rows = [...verdicts].sort((a, b) => b[1] - a[1]);
  host.appendChild(list(rows, ([type, count]) => `${VERDICT_LABELS_HI[type] || type} — ${count}`));
}

function renderSchemesSurfaced(byEventType, schemeNames) {
  const host = document.getElementById('schemes-surfaced');
  host.innerHTML = '';
  const surfaced = byEventType.get('scheme_surfaced') || new Map();
  if (surfaced.size === 0) {
    host.appendChild(el('p', 'citation hi', 'अभी कोई योजना दर्ज नहीं हुई — डैशबोर्ड लाइव है, ट्रैफ़िक कम है।'));
    return;
  }
  const rows = [...surfaced].sort((a, b) => b[1] - a[1]);
  host.appendChild(list(rows, ([id, count]) => `${schemeNames[id] || id} — ${count}`));
}

function renderDropoff(byEventType) {
  const host = document.getElementById('dropoff');
  host.innerHTML = '';
  const answered = byEventType.get('question_answered') || new Map();
  const order = Object.keys(CORE_SEQUENCE_LABELS_HI);
  const counts = order.map((slot) => answered.get(slot) || 0);
  if (counts.every((c) => c === 0)) {
    host.appendChild(el('p', 'citation hi', 'अभी कोई सवाल दर्ज नहीं हुआ — डैशबोर्ड लाइव है, ट्रैफ़िक कम है।'));
    return;
  }
  const ul = el('ul', 'doc-list');
  order.forEach((slot, i) => {
    const count = counts[i];
    const prev = i === 0 ? null : counts[i - 1];
    const dropText = prev === null || prev === 0 ? '' : ` (पिछले सवाल से ${prev - count} कम)`;
    ul.appendChild(el('li', '', `${i + 1}. ${CORE_SEQUENCE_LABELS_HI[slot]} — ${count}${dropText}`));
  });
  host.appendChild(ul);
}

function renderLanguageSplit(byEventType) {
  const host = document.getElementById('language-split');
  host.innerHTML = '';
  const lang = byEventType.get('language_active') || new Map();
  const hi = lang.get('hi') || 0;
  const en = lang.get('en') || 0;
  if (hi === 0 && en === 0) {
    host.appendChild(el('p', 'citation hi', 'अभी कोई भाषा-चयन दर्ज नहीं हुआ — डैशबोर्ड लाइव है, ट्रैफ़िक कम है।'));
    return;
  }
  host.appendChild(el('p', 'result-line', `हिन्दी: ${hi} · अंग्रेज़ी: ${en}`));
}

function renderFeedbackSplit(byEventType) {
  const host = document.getElementById('feedback-split');
  host.innerHTML = '';
  const votes = byEventType.get('feedback_vote') || new Map();
  if (votes.size === 0) {
    host.appendChild(el('p', 'citation hi', 'अभी कोई प्रतिक्रिया दर्ज नहीं हुई — डैशबोर्ड लाइव है, ट्रैफ़िक कम है।'));
    return;
  }
  let up = 0;
  let down = 0;
  const rows = [...votes].sort((a, b) => b[1] - a[1]);
  rows.forEach(([discriminator, count]) => {
    if (discriminator.startsWith('up:')) up += count;
    else if (discriminator.startsWith('down:')) down += count;
  });
  host.appendChild(el('p', 'result-line', `👍 ${up} · 👎 ${down}`));
  host.appendChild(list(rows, ([discriminator, count]) => {
    const [direction, reason] = discriminator.split(':');
    return `${direction === 'up' ? '👍' : '👎'} ${reason} — ${count}`;
  }));
}

function daysBetween(fromIso, toDate) {
  const from = new Date(`${fromIso}T00:00:00Z`);
  return Math.floor((toDate - from) / (1000 * 60 * 60 * 24));
}

function renderOperational(schemes) {
  const today = new Date();

  const overdueVerification = schemes.filter((s) => {
    if (!s.last_verified || !s.verification_interval_days) return false;
    return daysBetween(s.last_verified, today) > s.verification_interval_days;
  });
  document.getElementById('overdue-verification').replaceChildren(
    list(overdueVerification, (s) => `${s.name_hi} — जाँचा गया ${s.last_verified}, अवधि ${s.verification_interval_days} दिन`),
  );

  const overdueReview = schemes.filter((s) => s.next_review_due && new Date(`${s.next_review_due}T00:00:00Z`) < today);
  document.getElementById('overdue-review').replaceChildren(
    list(overdueReview, (s) => `${s.name_hi} — next_review_due ${s.next_review_due}`),
  );

  const nullFigures = schemes.filter((s) => s.benefit && s.benefit.amount_inr === null);
  document.getElementById('null-figures').replaceChildren(
    list(nullFigures, (s) => `${s.name_hi} — rate_policy: ${s.benefit.rate_policy || '(कोई नहीं दर्ज़)'}`),
  );
}

async function renderPendingDrafts() {
  const host = document.getElementById('pending-drafts');
  try {
    const drafts = await listDrafts();
    host.replaceChildren(list(drafts, (d) => {
      const when = d.updated_at && d.updated_at.toDate ? d.updated_at.toDate().toLocaleString('hi-IN') : '…';
      return `${d.scheme_id} — ${when} — ${d.updated_by || '…'}`;
    }));
  } catch (err) {
    console.error('dashboard: could not load cms_drafts:', err);
    host.replaceChildren(el('p', 'term-warning', 'ड्राफ़्ट लोड नहीं हो सके।'));
  }
}

async function renderDashboard() {
  const [schemes, byEventType] = await Promise.all([loadSchemes(), loadCounters()]);
  const schemeNames = Object.fromEntries(schemes.map((s) => [s.scheme_id, s.name_hi]));

  renderUsageSummary(byEventType);
  renderFunnel(byEventType);
  renderVerdicts(byEventType);
  renderSchemesSurfaced(byEventType, schemeNames);
  renderDropoff(byEventType);
  renderLanguageSplit(byEventType);
  renderFeedbackSplit(byEventType);
  renderOperational(schemes);
  await renderPendingDrafts();
}

ANALYTICS_NEVER_COLLECTED_HI.forEach((line) => document.getElementById('never-collected-list').appendChild(el('li', '', line)));

const sessionGate = document.getElementById('session-gate');
const dashboardBody = document.getElementById('dashboard-body');

onSessionChange((session) => {
  sessionGate.innerHTML = '';
  if (session) {
    sessionGate.appendChild(el('p', 'hi', `✅ लॉग-इन है — uid: ${session.uid}`));
    dashboardBody.style.display = '';
    renderDashboard().catch((err) => {
      console.error('analytics-dashboard: failed to render:', err);
      dashboardBody.insertAdjacentElement('afterbegin', el('p', 'term-warning', 'आँकड़े लोड नहीं हो सके।'));
    });
  } else {
    sessionGate.appendChild(el('p', 'hi', 'यह डैशबोर्ड केवल लॉग-इन स्टाफ़ के लिए है।'));
    const btn = el('button', 'button hi', t('common.login_google'));
    btn.type = 'button';
    btn.addEventListener('click', () => login());
    sessionGate.appendChild(btn);
    dashboardBody.style.display = 'none';
  }
});
