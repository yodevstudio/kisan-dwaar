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

// Shared page chrome every page gets from the one renderNav() call it
// already makes: the favicon, a skip link to the main content, and the
// project's own mark beside the page title. The mark is YoDevStudio's own
// logo — never a state emblem or departmental seal (CONTEXT.md §7).
function renderChrome() {
  if (!document.querySelector('link[rel="icon"]')) {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/png';
    icon.href = resolvePath('assets/favicon.png');
    document.head.appendChild(icon);
  }
  const main = document.querySelector('main');
  if (main && !main.id) main.id = 'main';
  if (main && !document.querySelector('.skip-link')) {
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = `#${main.id}`;
    skip.textContent = t('nav.skip');
    window.addEventListener('kisan:langchange', () => { skip.textContent = t('nav.skip'); });
    document.body.insertBefore(skip, document.body.firstChild);
  }
  const header = document.querySelector('.site-header');
  if (header && !header.querySelector('.site-logo')) {
    const home = document.createElement('a');
    home.className = 'site-logo';
    home.href = resolvePath('index.html');
    home.setAttribute('aria-label', t('nav.home_logo'));
    const img = document.createElement('img');
    img.src = resolvePath('logo.jpg');
    img.alt = '';
    img.width = 44;
    img.height = 44;
    home.appendChild(img);
    header.insertBefore(home, header.firstChild);
  }
}

export function renderNav(containerId = 'site-nav') {
  const container = document.getElementById(containerId);
  if (!container) return;
  renderChrome();

  // Below 900px the nine links collapse behind one menu button, so a phone
  // shows the page's own content in the first screen instead of three rows
  // of navigation. The language toggle stays outside the menu — a citizen
  // should never have to open a menu to find their language.
  let open = false;
  const render = () => {
    container.innerHTML = '';
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', t('nav.aria_label'));

    const current = NAV_ITEMS.find((item) => isCurrentPage(item.path));
    const bar = document.createElement('div');
    bar.className = 'site-nav-bar';
    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = getLang() === 'hi' ? 'hi site-nav-menu-btn' : 'site-nav-menu-btn';
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-controls', 'site-nav-list');
    menuBtn.setAttribute('aria-label', open ? t('nav.menu_close') : t('nav.menu_open'));
    menuBtn.textContent = `${open ? '✕' : '☰'}  ${current ? t(current.key) : t('nav.menu')}`;
    bar.appendChild(menuBtn);

    const list = document.createElement('div');
    list.id = 'site-nav-list';
    list.className = open ? 'site-nav-list is-open' : 'site-nav-list';
    NAV_ITEMS.forEach((item) => {
      const a = document.createElement('a');
      a.href = resolvePath(item.path);
      a.textContent = t(item.key);
      a.className = getLang() === 'hi' ? 'hi site-nav-link' : 'site-nav-link';
      if (isCurrentPage(item.path)) a.setAttribute('aria-current', 'page');
      list.appendChild(a);
    });

    const setOpen = (value, focusTarget) => {
      open = value;
      render();
      const target = focusTarget === 'first'
        ? container.querySelector('.site-nav-list a')
        : container.querySelector('.site-nav-menu-btn');
      if (target) target.focus();
    };
    menuBtn.addEventListener('click', () => setOpen(!open, open ? 'button' : 'first'));
    list.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false, 'button'); }
    });
    nav.appendChild(bar);
    nav.appendChild(list);
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
    bar.appendChild(btn);
    container.appendChild(nav);
  };

  render();
  window.addEventListener('kisan:langchange', render);

  // T8: page_view and language_active both fire once here, the one place
  // every page already calls — not re-fired on a langchange re-render,
  // since a toggle mid-visit isn't a new page view. Dynamic import, same
  // degrade-gracefully idiom js/app.js's own telemetry call already uses:
  // a missing or unreachable services layer must never affect nav itself.
  import('../services/telemetry.js')
    .then((m) => {
      m.trackPageView(location.pathname);
      m.trackLanguageActive(getLang());
    })
    .catch((err) => console.warn('nav: telemetry unavailable (non-fatal):', err));
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
