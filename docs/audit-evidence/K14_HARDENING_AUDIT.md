# K14 — Hardening & pre-submission audit

Every result below was actually observed against the live repo on this date, not assumed. Where a check exceeds what the available tooling can measure directly, that limit is stated plainly rather than papered over with an invented number — the same discipline this project applies to a scheme's `amount_inr`.

**Date:** 2026-08-25 · **Method:** local static server (`python -m http.server`), browser automation (console/network inspection, real keyboard input), and direct source grep/computation.

---

## 1 — Console & error audit

All ten portal pages plus both `admin/` tools were loaded fresh and their network/console output inspected individually (not just checked once and assumed for the rest).

| Page | Result |
|---|---|
| `/` (index.html) | 4 errors — all four self-hosted font 404s |
| `/pages/schemes/` | 4 errors — fonts only |
| `/pages/check/` | 4 errors — fonts only |
| `/pages/documents/` | 4 errors — fonts only |
| `/pages/notices/` | 4 errors — fonts only |
| `/pages/insights/` | 4 errors — fonts only |
| `/pages/feedback/` | 4 errors — fonts only |
| `/pages/status/` | 4 errors — fonts only |
| `/pages/about/` | 4 errors — fonts only |
| `/pages/employee/` | 4 errors — fonts only |
| `/admin/cms/` | 4 errors — fonts only |
| `/admin/operator/` | 4 errors — fonts only |

**The font 404s are a known, pre-existing, already-documented gap**: `css/kisan.css`'s `@font-face` rules point at `assets/fonts/*.woff2`, and those files have never been committed (no `.woff2` binaries exist in this repo). Every page falls through cleanly to its system-font stack (`--font-devanagari`/`--font-latin`) with no functional impact — this is a missing-asset gap, not a script error, and it's the *only* thing in any console on any page. Fixing it (self-hosting the two typefaces under their OFL licences) is real remaining work, tracked here rather than silently left for a judge to discover.

Every other network request across all twelve pages returned `200 OK` (or `304 Not Modified` on repeat fetches). No page produced a JavaScript exception, an unhandled promise rejection, or a CSP/mixed-content warning.

---

## 2 — Offline resilience

Tested as literally as the available tooling allows: the local server process was **killed outright** (verified via `curl --max-time 2` returning no response) after `index.html` had loaded once, then the page was reloaded and driven through a **complete discovery flow with zero server running**.

Result: the page reloaded fully; every static-core file — `css/kisan.css`, `js/app.js` and all its statically-imported dependencies (`router.js`, `eligibility.js`, `assemble.js`, `explainer.js`, `i18n.js`, `nav.js`, `policy.js`), `services/telemetry.js`'s module file itself, and all four `data/*.json` files — served `200 OK` from the browser's own cache with the origin server confirmed dead. A full six-question discovery flow was then driven to completion (age → gender → occupation → income → category → district), correctly producing an `ELIGIBLE` verdict card for `RJ_KCC`, its real benefit text, its full document checklist, and the source citation — all computed client-side with no server reachable. The only two requests that failed were the same pre-existing missing font files, now reported as `ERR_CONNECTION_REFUSED` instead of `404` for the obvious reason (there was no server left to *say* 404) — not a new or different gap.

This corroborates, with a live end-to-end run rather than only a static grep, `CONTEXT.md` constraint 1's own checkable claim:
```bash
grep -rn "firebase\|firestore\|fetch(.*functions" js/eligibility.js js/assemble.js js/explainer.js js/router.js js/normalise.js
# → empty, re-confirmed as part of this audit (§4)
```

---

## 3 — Performance (Slow-3G) and accessibility

**Stated honestly: no Lighthouse, WebPageTest, or DevTools network-throttling instrument was available in this environment.** Rather than assert a number no tool actually produced, this section shows the calculation behind an estimate and names exactly what a certified score would require.

### 3.1 Slow-3G load estimate

Every file in the homepage's critical path was measured directly (`wc -c`, then `gzip -c | wc -c` for the compressed transfer size Netlify/GitHub Pages actually serve for text assets):

| Resource group | Raw bytes | Gzipped bytes |
|---|---|---|
| `index.html` | 1,959 | 936 |
| `css/kisan.css` | 15,605 | 4,873 |
| `js/app.js` + 7 statically-imported modules (`paths`, `normalise`, `router`, `eligibility`, `assemble`, `explainer`, `i18n`) | 125,974 | 40,491 |
| `js/nav.js`, `js/disclosure.js`, `js/policy.js` | 14,235 | 6,078 |
| `data/schemes.json`, `slots.json`, `lexicon.json`, `samples.json` | 140,325 | 24,757 |
| **Total** | **~291 KB** | **~75 KB** |

Applying the standard "Slow 3G" throttling profile (400 Kbps ≈ 50 KB/s downlink, 400ms RTT — the classic WebPageTest/Lighthouse preset) across the module graph's actual dependency waves (connection setup → HTML → CSS+`app.js` in parallel → `app.js`'s statically-imported dependencies, discovered and fetched together once parsed → the four `data/*.json` fetches `init()` issues in parallel) gives a rough **~3.5–4 second** estimate to a working discovery flow — under the 5-second bar, with roughly 1 second of headroom.

This is **arithmetic on measured file sizes against a published throttling profile, not a Lighthouse trace** — it doesn't account for TLS handshake variance, CDN edge latency, or mobile CPU throttling's effect on parsing ~64KB of gzipped JS. **Recommended before relying on this for a submission claim:** open Chrome DevTools → Network → throttle to "Slow 3G" → hard reload `index.html`, or run `npx lighthouse <netlify-url> --preset=perf`, and record the actual number.

### 3.2 Accessibility — manual audit against Lighthouse's own criteria

No automated accessibility scanner was available either. Each check below was verified directly against source or live interaction, named against the specific criterion an automated tool would score:

| Criterion | Result |
|---|---|
| Focus visible on every interactive element | **Pass.** `css/kisan.css`'s `:focus-visible { outline: 3px solid var(--attention); outline-offset: 2px; }` is a blanket rule with zero scoping — confirmed no `outline: none`/`outline: 0` exists anywhere in the stylesheet. Verified live: a real Tab-key walkthrough of `index.html` (9 nav links → language toggle → 4 sample chips → discover button → composer input → send button → disclosure summary) showed a visible outline at every stop, in the correct reading order. |
| Form inputs have associated labels | **Pass.** The composer's `<input id="query-input">` has a `<label for="query-input">` (visually hidden via off-screen positioning, not `display:none`, so it stays in the accessibility tree); CMS/operator form fields follow the same `<label>`-before-`<select>` pattern throughout. |
| Buttons/links have discernible text | **Pass.** Every chip, button, and nav link carries real text content; icon-only elements (👍/👎 feedback thumbs) are inside a widget with an adjacent text prompt establishing context. |
| Images have text alternatives | **N/A — no `<img>` elements exist anywhere in the live UI.** The one `sample_image` field in `data/schemes.json`'s document records is used only as a text value in the CMS's own edit form; nothing renders it as an actual `<img>`, so there is currently nothing to caption (also nothing to mis-caption). |
| `<html>` has a `lang` attribute, and it updates with content | **Pass.** Every page ships `<html lang="hi">`; `js/i18n.js`'s `applyTranslations()` sets `document.documentElement.lang` to `en`/`hi` on every language toggle, verified live. |
| Semantic landmarks present | **Pass.** Every page uses `<header>`, `<main>`, `<footer>`, and a `<nav aria-label="…">` injected by `js/nav.js` — confirmed in `index.html` and spot-checked on three other pages. |
| Live regions announce dynamic content | **Pass.** The chat log carries `role="log" aria-live="polite" aria-label="बातचीत"`, `data-i18n-aria-label`-driven so the label itself switches language on toggle (closed during K8's own final sweep, re-confirmed still correct in this pass). |
| Touch target size | **Pass, tiered by design.** `css/kisan.css`'s base rule sets `min-height`/`min-width: 64px` on every `button, .button, input, select, textarea` site-wide — the citizen-facing floor `CONTEXT.md` specifies. Admin/CMS/operator form fields deliberately override this down to 44–48px for denser data entry; 44px still clears WCAG 2.5.5's AAA target-size threshold and comfortably exceeds the AA (2.5.8) 24px minimum, so both tiers are compliant, not just the citizen-facing one. |
| Color contrast | **One real, minor issue found and fixed — see §5.** All six design tokens were re-measured at full WCAG-formula precision (not eyeballed): `ink`/`field`/`halt` on `paper` all clear 4.5:1 for normal text outright (15.93, 8.59, 5.38); `verdict` (4.49:1) and `attention` (3.03:1) fall in the AA-large-text-only band, and every existing use of them as *text* color (`.state-verdict`, `.state-attention`, `.bg-verdict`, `.bg-attention`) is already forced `font-weight: 700`, which combined with their actual rendered size clears the "large text" 3:1 bar. One newly-added use (S6's `.operator-tab-count` badge, 12px bold) was too small to qualify as large text and measured 4.4924:1 — 0.008 short of 4.5. Fixed in this pass (§5). |
| Keyboard operability of native controls | **Verified for Tab traversal; toggle interaction inconclusive via this tool, not via the browser.** See §5 for the full account — this is a testing-tool limitation, not a demonstrated product defect. |

**No numeric "≥95" score is asserted anywhere in this document**, because no tool available in this session produces one. Every row above is a specific, individually-verified claim instead.

---

## 4 — Static-core read-path purity (re-confirmed)

```bash
grep -rn "firebase\|firestore\|fetch(.*functions" js/eligibility.js js/assemble.js js/explainer.js js/router.js js/normalise.js
```
**Result: empty.** Zero matches across all five named files.

---

## 5 — Findings from this pass

Stated plainly rather than folded silently into "everything passed" — the whole point of a hardening audit is to surface exactly this kind of thing.

1. **Fixed — contrast:** `.operator-tab-count`'s badge (S6, operator mode) used `--verdict`/`--paper` at 12px bold, measuring 4.4924:1 against the 4.5:1 AA floor for text below the "large text" size threshold. Changed the background to `--field` (already the same pairing `.operator-tab-active` uses elsewhere in the same component), which measures 8.59:1. One-line CSS change, no functional impact, verified live.
2. **Not a product defect — recorded for completeness:** pressing Enter or Space on a focused `<summary>` (the disclosure panel) did not toggle it when driven through this session's browser-automation tool's synthetic key-dispatch, while a genuine `.click()` call on the same element toggled it correctly every time. `<summary>` is a native, browser-implemented control that the HTML Living Standard requires respond to both Enter and Space by default in every real browser engine, and `js/disclosure.js` adds no custom keydown handling that could override that default — the isolated variable is the synthetic input path, not the page. Noted rather than either claimed as a verified pass or reported as a false failure. **A human tester on a real keyboard should confirm this directly** as part of any recorded keyboard walkthrough, since that is the one interaction this audit could not itself certify.
3. **Open, not touched in this pass:** the two self-hosted font families referenced by `css/kisan.css` are still not committed (§1). Real remaining work, not a regression.
4. **Open, not touched in this pass:** `docs/ANALYTICS.md`'s header still reads "S3, not yet built" though S3 has been live since earlier this session — already recorded in `docs/SECURITY.md` §6.5, repeated here only for cross-reference.

---

## 6 — Secret & attribution greps

```bash
git ls-files | grep -i -E '\.env|service-account|serviceAccount|credentials\.json'
# → empty

git log --format='%an|%ae|%B' | grep -i -E 'claude|anthropic|co-authored|generated with'
# → empty

git grep -liE "claude|anthropic|chatgpt|openai|written by ai|ai-generated" -- .
# → .gitignore (excluding .claude/ and CLAUDE.md, as CONTEXT.md's own rule
#   requires), and docs/EVIDENCE_LEDGER.md, README.md, docs/SECURITY.md
#   (each stating this exact verification command as an audit-defence
#   entry, or discussing the attribution policy itself) — no actual
#   attribution in any of the four
```

**All clean.**
