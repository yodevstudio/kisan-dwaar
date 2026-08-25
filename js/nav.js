// K15: one shared nav definition for all ten pages, so keeping the IA in
// sync never means hand-editing nine copies of the same links. Pure DOM
// injection, no service call, no dependency — it belongs in the static
// core (js/) for exactly that reason. Every href is built through
// resolvePath so navigation resolves correctly from any page, at any
// depth, on both the Netlify root and the GitHub Pages "/kisan-dwaar/"
// mirror (CONTEXT.md: "never write an absolute path").
//
// K8: the language toggle lives inside the nav bar itself (rendered here,
// not duplicated per page) so every page that already calls renderNav()
// gets bilingual switching for free. Labels re-render on 'kisan:langchange'
// since NAV_ITEMS' i18n keys must reflect whichever language is now active.
import { resolvePath } from './paths.js';
import { getLang, setLang, t } from './i18n.js';

// "employee" is deliberately absent from the primary menu — see
// renderFooterStaffLink below for why.
const NAV_ITEMS = [
  { path: 'index.html', key: 'nav.home' },
  { path: 'pages/schemes/index.html', key: 'nav.schemes' },
  { path: 'pages/check/index.html', key: 'nav.check' },
  { path: 'pages/documents/index.html', key: 'nav.documents' },
  { path: 'pages/notices/index.html', key: 'nav.notices' },
  { path: 'pages/insights/index.html', key: 'nav.insights' },
  { path: 'pages/feedback/index.html', key: 'nav.feedback' },
  { path: 'pages/status/index.html', key: 'nav.status' },
  { path: 'pages/about/index.html', key: 'nav.about' },
];

function isCurrentPage(itemPath) {
  const target = resolvePath(itemPath).split('?')[0].split('#')[0];
  const here = location.href.split('?')[0].split('#')[0];
  if (target === here) return true;
  // "index.html" and its directory ("/") are the same page.
  return here === target.replace(/index\.html$/, '');
}

export function renderNav(containerId = 'site-nav') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const render = () => {
    container.innerHTML = '';
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', t('nav.aria_label'));
    NAV_ITEMS.forEach((item) => {
      const a = document.createElement('a');
      a.href = resolvePath(item.path);
      a.textContent = t(item.key);
      a.className = getLang() === 'hi' ? 'hi site-nav-link' : 'site-nav-link';
      if (isCurrentPage(item.path)) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    // Built inline rather than via i18n.js's renderLangToggle: this
    // whole render() already re-runs on every langchange (it rebuilds the
    // entire nav), so delegating to a second self-re-rendering helper
    // would attach one more stale listener, bound to a since-discarded
    // DOM node, on every toggle.
    const lang = getLang();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-toggle-btn site-nav-lang-toggle';
    btn.setAttribute('aria-label', lang === 'hi' ? t('lang.switch_to_en') : t('lang.switch_to_hi'));
    btn.textContent = lang === 'hi' ? 'EN' : 'हिं';
    btn.addEventListener('click', () => setLang(lang === 'hi' ? 'en' : 'hi'));
    nav.appendChild(btn);
    container.appendChild(nav);
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

// Deliberately separate from renderNav and visually secondary (see
// css/kisan.css's .footer-staff-link) — docs/EVIDENCE_LEDGER.md A1 flags
// the Department's own portal for putting "Employee Corner" in the
// *primary* navigation, at the same level as farmer-facing content. This
// project's own employee-facing page exists (pages/employee/), but it is
// reachable only from the footer, never from the main menu a farmer sees
// first — the fix for A1, applied to our own IA rather than just written
// up as a finding about someone else's.
export function renderFooterStaffLink(containerId = 'site-footer-links') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const render = () => {
    container.innerHTML = '';
    const a = document.createElement('a');
    a.href = resolvePath('pages/employee/index.html');
    a.textContent = t('nav.employee');
    a.className = getLang() === 'hi' ? 'hi footer-staff-link' : 'footer-staff-link';
    container.appendChild(a);
  };

  render();
  window.addEventListener('kisan:langchange', render);
}
