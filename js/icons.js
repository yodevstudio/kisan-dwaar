// T9: simple inline SVG icons — no icon library, no CDN, no image files,
// per the task's own constraint. Each is a small, hand-drawn outline in
// the site's ink/field colour (currentColor, so it inherits whatever text
// colour the caller already set), stroke-only so it reads clearly at the
// small sizes a card heading uses. Every function returns a ready-to-use
// SVG string; callers set it via a wrapper element's innerHTML, same
// pattern already used for text content elsewhere in this codebase.
const BASE = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

export const ICONS = {
  // Scheme cards (a leaf — agriculture identity, used wherever a specific
  // scheme is named: home page's scheme cards, the schemes catalogue,
  // notices' per-scheme entries).
  scheme: `<svg ${BASE}><path d="M5 20c8 0 14-6 14-14 0 0-11-1-14 6-2 4-1 8 0 8Z"/><path d="M5 20c0-5 2-9 6-11"/></svg>`,

  // Service card: check eligibility.
  checkCircle: `<svg ${BASE}><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/></svg>`,

  // Service card: subsidy calculator.
  calculator: `<svg ${BASE}><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="8" y2="12.01"/><line x1="12" y1="12" x2="12" y2="12.01"/><line x1="16" y1="12" x2="16" y2="12.01"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="12" y1="16" x2="12" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>`,

  // Document entries and the "documents" service card.
  document: `<svg ${BASE}><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="15.5" x2="15.5" y2="15.5"/></svg>`,

  // Service card: application status.
  clock: `<svg ${BASE}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,

  // Service card: notices.
  bell: `<svg ${BASE}><path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>`,

  // Service card: help.
  help: `<svg ${BASE}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.6 1.4c0 1.6-2.1 1.9-2.1 3.3"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>`,
};

export function iconSpan(name, className = 'icon') {
  const span = document.createElement('span');
  span.className = className;
  span.innerHTML = ICONS[name] || '';
  return span;
}
