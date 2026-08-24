// K15: one shared nav definition for all ten pages, so keeping the IA in
// sync never means hand-editing nine copies of the same links. Pure DOM
// injection, no service call, no dependency — it belongs in the static
// core (js/) for exactly that reason. Every href is built through
// resolvePath so navigation resolves correctly from any page, at any
// depth, on both the Netlify root and the GitHub Pages "/kisan-dwaar/"
// mirror (CONTEXT.md: "never write an absolute path").
import { resolvePath } from './paths.js';

// "employee" is deliberately absent from the primary menu — see
// renderFooterStaffLink below for why.
const NAV_ITEMS = [
  { path: 'index.html', label_hi: 'मुख्य पृष्ठ' },
  { path: 'pages/schemes/index.html', label_hi: 'योजनाएं' },
  { path: 'pages/check/index.html', label_hi: 'पात्रता जांचें' },
  { path: 'pages/documents/index.html', label_hi: 'दस्तावेज़' },
  { path: 'pages/notices/index.html', label_hi: 'सूचनाएं' },
  { path: 'pages/insights/index.html', label_hi: 'आंकड़े' },
  { path: 'pages/feedback/index.html', label_hi: 'प्रतिक्रिया' },
  { path: 'pages/status/index.html', label_hi: 'आवेदन स्थिति' },
  { path: 'pages/about/index.html', label_hi: 'परिचय' },
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
  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.setAttribute('aria-label', 'मुख्य नेविगेशन');
  NAV_ITEMS.forEach((item) => {
    const a = document.createElement('a');
    a.href = resolvePath(item.path);
    a.textContent = item.label_hi;
    a.className = 'hi site-nav-link';
    if (isCurrentPage(item.path)) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  });
  container.appendChild(nav);
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
  const a = document.createElement('a');
  a.href = resolvePath('pages/employee/index.html');
  a.textContent = 'कर्मचारी कॉर्नर';
  a.className = 'hi footer-staff-link';
  container.appendChild(a);
}
