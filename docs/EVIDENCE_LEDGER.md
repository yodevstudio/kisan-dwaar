# EVIDENCE_LEDGER.md
### Every claim we make about the Department's portals, and exactly what backs it.

Ships in the repository at `docs/EVIDENCE_LEDGER.md` and is linked from the README and the disclosure panel.

**The rule:** no claim appears in the deck, the video, the README or the demo unless it appears in this table first, worded as this table words it. If a slide needs a stronger sentence than the ledger allows, the slide is wrong, not the ledger.

**Why this exists.** We are making public criticism of a government portal in a bid to that same government. Three of the strongest-sounding claims available to us were **not observed in our own session** — they come from third-party research of uneven quality. Stating them as first-hand observation would be the single fastest way to lose this, because one judge with the site open is all it takes. Stating them accurately, with attribution, is *more* persuasive, not less: it signals that everything else in the submission was checked with the same care.

**Capture session:** 19 Aug 2026, IST. Sites: `agriculture.rajasthan.gov.in`, `rajkisan.rajasthan.gov.in`. Every screenshot carries the URL and timestamp in a burned-in caption bar. No credentials were entered and no login was completed anywhere in the session; every login-wall capture documents where anonymous access ends, not what lies behind it.

---

## A — Observed first-hand · safe to state as fact

| # | Claim, as it may be worded | Evidence | Wording constraint |
|---|---|---|---|
| A1 | Administrative content — "Employee Corner" with Transfer Order, Roster Register, Seniority List, Posting Order, APAR, DPC, NOC, Recruitment — sits in the agriculture portal's **primary navigation, at the same level as farmer-facing content** | `01_admin_nav_employee_corner.jpg` | State as observed on 19 Aug 2026 |
| A2 | Navigation nests to a second-level flyout (About Us → Organization Setup → Departmental Setup / Directors & Commissioner) | `02_nested_menu_depth.jpg` | — |
| A3 | A departmental circular is published as a **scanned raster PDF**, fixed A4 layout, requiring pinch-and-zoom on a phone | `03_scanned_circular_desktop.jpg`, `03b_scanned_circular_mobile_sim.jpg` | ⚠ `03b` is an **image-scaled simulation** of a 375px viewport, not a native narrow-viewport capture — the session's browser could not be resized below desktop resolution. Say "simulated at 375px" in the caption. The point stands because a PDF page has no responsive breakpoints. |
| A4 | The licence-application flow, which is where the applicant-category picker lives, **redirects to Rajasthan SSO before displaying anything** | `04_rajkisan_role_grid_ssowall.jpg` | Say: a farmer needs an SSO account merely to *discover* which category applies to them. Do not describe the grid's contents as seen — it sits behind the wall. |
| A5 | **~3 substantive clicks** (mega-menu → scheme page → Apply) reach the Jan Aadhaar login wall, where anonymous access ends | `00_subsidy_click_path_recording.gif`, `05a`, `05b`, `05c` | This is the observed number. See B1 for the 12–13 figure. |
| A6 | After closing a popup, the next Tab presses land in the **footer**, skipping the header, hero and all primary navigation | `06_keyboard_focus_jumps_to_footer.jpg` | — |
| A7 | **No visible focus outline was observed anywhere** during keyboard testing, including on the language toggle | `06b_keyboard_focus_english_toggle_no_ring.jpg` | Say "none observed during this test", not "none exists" |
| A8 | Tabbing onto "About Us" auto-opens its dropdown while the trigger itself shows no focus ring | `06c_keyboard_focus_aboutus_dropdown.jpg` | — |
| A9 | ⭐ The Employee Corner dropdown is **visually open but its links are never in the Tab sequence** — Tab jumps from "Employee Corner" straight to "Contact Us". Keyboard-only and screen-reader users cannot reach content that is on screen. | `06d_keyboard_admin_menu_unreachable.jpg` | The strongest accessibility finding in the pack. Use it. |
| A10 | Lighthouse **mobile** scores: `agriculture.rajasthan.gov.in` — Performance 48, **Accessibility 96**, Best Practices 73, SEO 83. `rajkisan.rajasthan.gov.in` — Performance 51, **Accessibility 65**, Best Practices 88, SEO 77. | `07a`, `07b` | Run via PageSpeed Insights (Google-hosted Lighthouse), because a local headless run could not reach the domains from that network. **Say "PageSpeed Insights, mobile" in the caption.** |
| A11 | ⭐⭐ The 96 is the argument, not the 65: **an automated accessibility score of 96 sits alongside the keyboard failures in A6–A9.** Automated audits pass while real keyboard navigation fails. | A6–A10 together | The best slide in the deck. It is not "their site is bad"; it is "the standard measurement does not detect this class of failure" — which is a systemic point, not a jab. |
| A12 | A promotional modal appears on load with a **broken/missing image** | `09_broken_image_popup.jpg` | — |
| A13 | "BT Cotton Vendor Registration" in the Agri Business menu resolves to `#` — a **dead link** | `10_dead_hash_link_btcotton.jpg` | — |

---

## B — Reported by third parties · attribute, never claim

| # | The claim | Where it comes from | How it may be worded |
|---|---|---|---|
| B1 | 12–13 discrete interactions to submit a subsidy application | `Research_02` UX audit, describing the **full post-login sequence** | *"Third-party audit material describes the full post-login application sequence as 12–13 interactions. We did not observe that sequence, because we did not log in. What we did observe is that ~3 substantive clicks reach the login wall — before any eligibility information is shown."* **Both halves, every time.** |
| B2 | >70% cumulative abandonment | `Research_02`, a **model** at an assumed 10% per-node failure rate | Present as a modelled estimate with its assumption stated, or omit. Never as a measurement. |
| B3 | `Error 505` on the Jan Aadhaar/SSO handshake | `Research_02`; **not observed in our session** | *"A reported failure mode, which we did not encounter in our own testing."* Never a screenshot claim, never "we saw". |
| B4 | Synchronous auth deadlock on the Apna Khata land-record database; advisories telling farmers to apply at 2 AM | `Research_02`, unverified | Attribute explicitly, or drop. It is a good story and a bad citation. |
| B5 | The DOM is nested `<div>` soup with layout `<table>`s violating WCAG 1.3.1 | `Research_02`, not independently verified by us | **We have something better: A6–A9 and A11 are ours.** Prefer those and drop B5 rather than borrowing an unverified structural claim. |
| B6 | Jan Soochna already runs AI voice agents in Marwari/Mewari/Dhundhari/Harauti | `Research_03`; **unverified, reads like vendor marketing** | 🔴 **Never repeat it in any artefact.** If a judge raises it, the prepared answer is in `SUBMISSION_KIT.md` §5. |
| B7 | Jan Aadhaar integration standard is v1.4 with RSA PKCS#1 | `Research_03` — **wrong**; v1.8 (Aug 2025) supersedes it on `janaadhaar.rajasthan.gov.in` | Never repeat. We build to v1.8. The OAEP-vs-PKCS#1 padding question inside v1.8 is genuinely open and gets answered in K9 with a page reference. |

---

## C — Claims about our own system · must be demonstrable live

| # | Claim | How a judge verifies it in under a minute |
|---|---|---|
| C1 | Every rupee figure is traceable to a dataset field or a citizen input | Open `tests/eligibility.test.html`; the guard-throw assertions are visible and passing |
| C2 | Change the data, the answer changes | Edit `rates.hdpe` in `data/schemes.json`, reload the explainer |
| C3 | Change the answer, the guard throws | The corrupted-derived-value assertion in the harness |
| C4 | No LLM in the request path | `grep -rn -i "llm\|openai\|anthropic\|gpt\|api key" js/` returns nothing; Network tab is empty after first load |
| C5 | No backend | Airplane mode, cold reload, full discovery flow completes |
| C6 | Machine-readable registry with provenance | `curl` a single scheme JSON from the live URL; every record carries `source_url` and `last_verified` |
| C7 | N records were transcribed by hand from raster images | `docs/SCANNED_SOURCES.md`, with the PDFs archived alongside |
| C8 | Real keyboard accessibility, not a badge | Tab through the whole flow on video, with the focus ring visible in every frame |
| C9 | No PII persisted | Open DevTools → Application → Local Storage after a full run; only dataset, slots, language |

**C8 is the one to lead with in the video**, because A11 is the strongest criticism we make and a criticism you haven't personally passed is a liability.

---

## D — Fairness clauses to state out loud, once

Include these in the deck and the README. They cost one slide and they change how everything else is received.

1. **The backend works.** Rajasthan has genuinely federated identity, land records and DBT. Our criticism is of the citizen-facing edge, not the plumbing — and the plumbing is why this front end is feasible at all.
2. **We tested anonymously.** We did not log in, so we cannot and do not describe the post-login experience from observation.
3. **One session, one network, one device class, on 19 Aug 2026.** Conditions vary.
4. **These are live services with real users.** Nothing here was probed, scraped, load-tested or accessed beyond ordinary public browsing.
5. **Our own site is measured by the same instruments** — same Lighthouse mobile run, published, plus the manual keyboard walkthrough the automated score cannot perform.

Clause 5 is the one that earns the right to make claim A11.
