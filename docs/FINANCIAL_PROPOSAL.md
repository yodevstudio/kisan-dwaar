# FINANCIAL_PROPOSAL.md
### The economics, structured — not a single quoted price. Every rupee figure below carries a source, or a stated method and a range, per this document's own rule: an invented point estimate does not score; a costed range with visible arithmetic does.

Ships in the repository at `docs/FINANCIAL_PROPOSAL.md`, feeding iStart Parameter 7. Two kinds of figure appear below, never blended without saying which is which: **measured** (a real byte count, a real field value, a real published platform limit — cited to where it came from) and **estimated** (an assumption stated before the arithmetic that uses it, so the arithmetic can be checked and the assumption can be argued with, which is the entire point of showing it).

---

## 1 — Cost to build

**Hours already invested (estimated).** No verified timesheet exists to cite, so this is built from the one real artifact that does: `docs/BUILD_GUIDE_V2.md` §4's committed 11-calendar-day schedule (21–31 Aug 2026), which carries a full slate of dataset, engineering and commercial-document work on every one of those days. Assuming **6–10 hours/day** of build effort across those 11 days —

> 11 days × 6–10 hrs/day = **66–110 hours**

`[NEEDS SOURCE: replace the 6–10 hrs/day assumption with an actual logged hours total, if one exists, before this range is quoted anywhere as final.]`

**Hours to production (estimated).** Three named, bounded remaining tasks, not an open-ended "productionise it" line:

| Remaining task | Why it's bounded | Hours (estimated) |
|---|---|---|
| Deploy the scheduled-deletion Cloud Function | `functions/index.js` is already written (source-only, not deployed — its own header states this); the work is enabling the Blaze billing plan and a deployment pass, not writing new logic | 3–6 |
| Jan Aadhaar adapter, once sandbox credentials arrive | `services/session.js` is already built provider-agnostic for exactly this (its own header: *"S1: provider-agnostic session module"*) — an adapter against a stated v1.8 OIDC flow, not a rearchitecture | 20–40 |
| Production hardening (real Blaze-plan Firestore/Storage rules review, monitoring, accessibility/content sign-off coordination) | Scoped against the same checks `docs/audit-evidence/K14_HARDENING_AUDIT.md` already ran once pre-launch | 20–40 |
| Embed widget (`docs/ROADMAP.md` Phase 2), if bundled into this production pass | Rendering layer only — the engine and registry it calls already exist and are tested | 15–30 |
| **Total** | | **58–116** |

**Rate (estimated, stated explicitly rather than hidden inside a lump sum).** ₹800–₹1,500/hour, a range consistent with skilled Indian software-consultancy work on public-sector digital infrastructure. `[NEEDS SOURCE: benchmark against comparable GeM/state e-Governance Society consultancy rate cards before quoting either bound as final.]`

| | Low (66 hrs × ₹800) | High (110 hrs × ₹1,500) |
|---|---|---|
| **Cost already invested** | ₹52,800 | ₹1,65,000 |

| | Low (58 hrs × ₹800) | High (116 hrs × ₹1,500) |
|---|---|---|
| **Cost to production, remaining** | ₹46,400 | ₹1,74,000 |

Both ranges are wide because they multiply two independent ranges (hours and rate) — the arithmetic is shown precisely so the Department can narrow either input and get a narrower answer, rather than being handed one number with no way to see what moving it would take.

---

## 2 — Cost to run: near-zero per transaction, and why

**The mechanism.** `js/eligibility.js`, `js/assemble.js` and `js/explainer.js` run **in the citizen's own browser** — every eligibility computation is client-side JavaScript against a JSON file already downloaded, not a server-side query per citizen (`CONTEXT.md` constraint 1). The registry itself, `api/v1/`, is static JSON served from a CDN, not a database queried per request. There is no per-transaction server compute to bill for, because there is no server in that path at all.

**Measured evidence of how light that path actually is.** `docs/audit-evidence/K14_HARDENING_AUDIT.md` §3.1 measured the homepage's full critical-path weight directly (`wc -c` / `gzip -c | wc -c`, not estimated): **~291 KB raw, ~75 KB gzipped**, for HTML, CSS, every statically-imported JS module, and all four `data/*.json` files combined. *(That measurement predates this submission's later visual and portal-structure passes; the true current figure will differ modestly — re-measure with the same commands before quoting it precisely, the same caveat that audit itself states.)*

**What that buys on free-tier static hosting.** Using the ~75 KB figure and Netlify's published free-tier bandwidth allowance:

> 100 GB ÷ 75 KB ≈ **~1.4 million first-time page loads per month**, before any hosting cost is incurred at all — and a repeat visit costs far less than that, since the static core is designed to work fully offline after first load (`CONTEXT.md` constraint 1), meaning a returning citizen's browser serves most of that weight from its own cache, not from the network again.

`[NEEDS SOURCE: confirm Netlify's and GitHub Pages' currently published free-tier bandwidth limits before quoting the 100 GB figure — platform free tiers change.]` The specific number may move; the structural point does not: at any bandwidth limit a static host actually publishes, this site's per-citizen cost is a small fraction of a rupee, because the entire read path — discovery, eligibility, the explainer, the document checklist, the registry — is exactly the class of workload static hosting is priced to serve for free at meaningful scale.

---

## 3 — Services-layer costs that do scale, and with what

Unlike the static core, the services layer (`services/`) runs against Firebase, and its cost genuinely scales — but each piece scales with a **named, bounded dimension**, not with raw citizen traffic on the read path (a citizen who never logs in generates zero services-layer cost at all):

| Service | Scales with | Current usage shape | Notes |
|---|---|---|---|
| **Auth** (`services/session.js`) | Monthly active authenticated users | Only officers (CMS, dashboard), extension-worker operators, and citizens who choose to upload a document — never a citizen just checking eligibility | `[NEEDS SOURCE: Firebase's current published free-tier MAU threshold and per-MAU rate beyond it.]` |
| **Firestore** (`services/cms.js`, `services/telemetry.js`, `services/upload.js`'s audit trail) | Document reads/writes/storage per day | Small, structurally: CMS drafts/published documents number in the dozens (one per scheme, plus version history), `analytics_counters` writes are single-field increments, `uploads_audit` writes one small document per upload | `[NEEDS SOURCE: Firebase's current published Firestore free-tier daily read/write/storage allowance.]` |
| **Cloud Storage** (`services/upload.js`) | GB stored + egress bandwidth | The one line item that genuinely grows with citizen adoption — every uploaded document consumes real storage | Bounded by policy (`UPLOAD_MAX_FILE_BYTES` = 10 MB/file, `UPLOAD_RETENTION_DAYS` = 30, `js/policy.js`) — **but the Cloud Function that enforces that 30-day deletion server-side is written and not yet deployed** (`functions/index.js`'s own header: *"Source only — not deployed"*). Stated honestly rather than implied as already controlling cost: deploying it is the first line item in §1's production-hardening estimate, and until it is deployed, storage can accumulate past the stated window. |

`[NEEDS SOURCE: Firebase also requires the pay-as-you-go "Blaze" plan to enable Cloud Storage at all on a new project, even for free-tier-level usage — confirm this is still Firebase's current policy before budgeting on the assumption of a genuinely free tier for the upload feature specifically.]`

---

## 4 — Maintenance: an SLA-backed registry verification retainer

`docs/DATA_SPEC.md` states this project's own discipline in its opening line: *"K3 is the critical path and it is human work."* Verification — opening the actual circular, confirming a rule still reads the way the registry says it does — is the one part of this system this document does not propose automating, because it is exactly the judgement a machine cannot certify on its own. That is the recurring cost worth pricing explicitly, per scheme, per verification cycle, rather than folding into a vague annual "maintenance" line.

**The cycle length is already in the data, not proposed here for the first time.** `data/schemes.json`'s own `verification_interval_days` field: **11 of the 12 current records on a 90-day cycle, 1 (the rural-employment wage rate, revised more often) on a 30-day cycle.**

**Per-cycle verification cost (estimated).** Re-confirming an already-known, already-located source is materially faster than first-time authoring — **0.5–1.5 hours per scheme per cycle**, at the same ₹800–₹1,500/hour rate from §1:

> 0.5–1.5 hrs × ₹800–₹1,500 = **₹400–₹2,250 per scheme, per verification cycle**

**Annualised, for the registry exactly as it stands today (12 schemes):**

| Cycle | Schemes | Cycles/year (365 ÷ interval) | Scheme-cycles/year |
|---|---|---|---|
| 90-day | 11 | 4.06 | 44.6 |
| 30-day | 1 | 12.17 | 12.17 |
| **Total** | 12 | | **~56.8** |

> 56.8 scheme-cycles/year × ₹400–₹2,250/cycle = **₹22,720 – ₹1,27,800 per year**, for the registry as it exists today, before adding a single scheme.

**The SLA this retainer is priced against:** each scheme's `next_review_due` date (already a field on every record) is a commitment, not a suggestion — the retainer's service-level term is that a re-verified record, or an honest `null`-and-`rate_policy` if the source can no longer be confirmed, is published within a stated number of business days of that date, every cycle, for every scheme under retainer. `[NEEDS SOURCE: agree the exact SLA response-time window (this document does not invent one) as part of the retainer contract itself.]`

---

## 5 — Marginal cost of the second department: a dataset, not a rebuild

`docs/BUSINESS_CASE.md` §5 makes this argument in prose; this section prices it.

**It is not hypothetical — it already happened once.** Six of the twelve schemes already in this registry are not Agriculture Department records at all (`data/schemes.json`'s `scheme_group: related_welfare`, spanning Social Justice & Empowerment, Rural Development, Health, Food, and Petroleum & Natural Gas). Each was added to the **same** engine, the **same** portal, the **same** test harness, at the **same** per-scheme cost as an agriculture record — zero incremental engine or UI spend, because none was rebuilt to add them.

**The marginal-cost formula, using §4's own per-scheme figure:**

> Marginal cost of department *N* ≈ (schemes in department *N*) × **₹1,600–₹6,000** (first-time authoring per scheme — 2–4 hrs at ₹800–₹1,500/hr, the same first-time-verification range §4's re-verification estimate is faster than) + a small one-time integration pass (re-running `tools/validate-data.mjs` and `tests/eligibility.test.html` against the new records — **5–10 hours**, not a new build)

**Worked example, at illustrative parity with this project's own current size (12 schemes):**

> 12 × ₹1,600–₹6,000 = ₹19,200–₹72,000, plus 5–10 hrs × ₹800–₹1,500 = ₹4,000–₹15,000 integration
> **Total: ₹23,200 – ₹87,000** for a second department's full initial registry — a small fraction of §1's ₹52,800–₹1,65,000 original build cost, because the fraction that doesn't repeat (the engine, the portal, the services layer, the test harness) is exactly the fraction §1 already paid for once.

`[NEEDS SOURCE: this worked example uses 12 schemes for comparability with this project's own registry, not a real second department's actual scheme count — substitute the real number once a specific department is named, and the formula above still holds.]`
