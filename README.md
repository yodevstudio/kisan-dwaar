# किसान द्वार — KISAN DWAAR

**This is a challenge-submission prototype built by YoDevStudio for the Rajasthan Innovation Challenge. It is not a deployed government service, it does not impersonate the Department of Agriculture or any Rajasthan government entity, and no real citizen data is processed anywhere in it.** Every page carries this disclosure in the interface itself, not only here (`CONTEXT.md` constraint 7).

---

## Try it in three minutes

**Live:** <https://yodevstudio.github.io/kisan-dwaar/>
**Mirror:** <https://kisan-dwaar.netlify.app/>

**Demo path:** पात्रता जांचें (Check eligibility) → तारबंदी योजना (Tarbandi) → farmer, and when asked for landholding pick **1 से 2 हेक्टेयर / 1 to 2 hectares** (this clears Tarbandi's 0.5-hectare threshold cleanly — a smaller "up to 1 hectare" answer is a real landholding size the engine correctly won't guess about, since it straddles the threshold rather than resolving it) → अनुदान राशि जानें (Calculate subsidy) → स्रोत (View source).

That path takes a citizen from the home page to a specific scheme's specific subsidy figure, with the source URL and verification date attached — with no account, no login, and no form submitted anywhere along the way.

---

## The problem, in one paragraph

What follows is worded to `docs/EVIDENCE_LEDGER.md`'s own discipline: what we observed first-hand on 19 Aug 2026 is stated as observed, and what a third party modelled is attributed as reported, never blended into one voice. Observed directly, on Rajasthan's own agriculture portals: the licence-application flow — where the applicant-category picker lives — redirects to the Rajasthan SSO login wall before displaying anything, so a farmer needs an SSO account merely to discover which category applies to them, reached after ~3 substantive clicks (`docs/EVIDENCE_LEDGER.md` A4, A5); a departmental circular is published as a scanned raster PDF requiring pinch-and-zoom on a phone (A3); and an automated accessibility score of 96 (PageSpeed Insights, mobile) coexists with a keyboard trap that makes an entire navigation menu untabbable (A9–A11) — the standard measurement does not catch this class of failure. Reported, not observed by us, and stated with both halves every time per the ledger's own rule: third-party UX research models cumulative abandonment across the full application funnel at over 70%, under an assumed 10% per-step failure rate — a modelled estimate under a stated assumption, not something this project measured itself (`docs/EVIDENCE_LEDGER.md` B2). None of this is a claim that Rajasthan's backend is broken — the state has genuinely federated identity, land records and DBT (`docs/EVIDENCE_LEDGER.md` D1) — it is a claim about one specific, fixable layer: whether a citizen can find out if they qualify *before* being asked to prove who they are.

---

## The solution, in one paragraph

A farmer answers six questions instead of navigating a login wall, and gets a verdict, a document checklist, and — where the rule is known — a worked subsidy calculation, in Hindi or English, entirely in the browser with zero account and zero login. Every figure a citizen sees is traceable to a specific field in a versioned dataset with a source URL and a verification date, enforced by two independent guards (below), not asserted by prose. This is the agriculture instance of a general scheme-rules registry — same engine, same provenance discipline, an agriculture dataset and a portal-shaped front end on top — so the actual product is `api/v1/`, the machine-readable registry, and this portal is the first of what should be several things built on it (`docs/DPI.md`).

---

## Table A — the challenge brief's six Expected Outcomes

Every artifact link below is a path in this repository — click through, don't take our word for it.

| Expected Outcome | Key Artifact(s) | Status |
|---|---|---|
| **Mobile-first, multilingual CMS** | [`admin/cms/`](admin/cms/index.html) (authoring, drafts, version history) · [`js/i18n.js`](js/i18n.js) (Hindi/English, every page) · [`css/kisan.css`](css/kisan.css) (64px touch targets, mobile-first layout) | 🟡 Partial — multilingual UI and mobile-first layout are live across the whole portal. CMS authoring, validation, and version history work end to end, and publishing now reaches citizens directly: the citizen-facing boot sequence (`js/registry-source.js`) reads the CMS's published Firestore registry first, races it against a 3-second timeout, and falls back to the git-tracked `data/schemes.json` on any failure — so a publish can update what a citizen sees with no developer in the loop. A human still copies the emitted JSON into `data/schemes.json` and commits it for the offline/fallback copy to also carry the change. |
| **Rules-based AI chatbot** | [`index.html`](index.html) · [`js/app.js`](js/app.js) · [`js/eligibility.js`](js/eligibility.js) · [`js/router.js`](js/router.js) · [`js/normalise.js`](js/normalise.js) | ✅ Live — deterministic, zero-LLM engine, full tap-to-answer discovery and typed free-text routing in both Hindi and English/Hinglish. Dialect vocabulary (`data/lexicon.json`) is a starting set, not a field-tested one — see Known limitations. |
| **API-driven scheme-eligibility checker** | [`api/v1/`](api/v1/index.json) · [`js/eligibility.js`](js/eligibility.js) · [`tools/build-registry.mjs`](tools/build-registry.mjs) | ✅ Live — versioned, diffed, no-auth registry; the same engine the portal itself uses. |
| **Secure document-upload module** | [`services/upload.js`](services/upload.js) · [`storage.rules`](storage.rules) · [`firestore.rules`](firestore.rules) · [`functions/index.js`](functions/index.js) | 🟡 Partial — auth-gating, per-user storage paths, and type/size limits are enforced at the rules layer, not just the client. A completed upload now generates a real reference and appears in `pages/status/` as a genuine record, visually distinct from seeded demo entries. Retention (30 days) and virus-scanning's documented-not-built status are disclosed on the upload screen itself, before a file is chosen. Scheduled auto-deletion is written (`functions/index.js`) but not deployed — it needs Firebase's paid Blaze plan, unavailable on this prototype's free tier. No dedicated upload page exists yet in the citizen-facing ten-page portal itself; today's disclosure lives on the dev-tool and operator-mode upload paths. |
| **SSO / Jan Aadhaar integration** | [`services/session.js`](services/session.js) · [`docs/SECURITY.md`](docs/SECURITY.md) | 🟡 Partial — a real, working OIDC-framed login (Google Sign-In via Firebase Auth) is live, with exactly `{uid, provider}` kept in memory. The Jan Aadhaar/Rajasthan-SSO adapter itself is designed but not built, blocked on a still-pending official sandbox-credential request (`docs/SECURITY.md` §1.2). |
| **Analytics dashboard for usage and feedback** | [`services/telemetry.js`](services/telemetry.js) · [`services/analytics-dashboard.html`](services/analytics-dashboard.html) · [`docs/ANALYTICS.md`](docs/ANALYTICS.md) | ✅ Live — real event counters from real usage: a usage funnel, per-question drop-off, verdict and scheme-surfaced breakdowns, Hindi/English split, feedback split, and operator-facing operational metrics (schemes overdue for re-verification, unresolved `rate_policy` records, pending drafts), behind sign-in. The list of what is never collected is published on the same page, publicly, with no login required. |

A 🟡 row is a real gap, stated as one rather than left to be discovered — the same discipline the engine itself applies to a scheme record it can't verify (`data/schemes.json`'s `null` fields, never a guess).

---

## Table B — the seven iStart evaluation parameters

| Parameter | Document |
|---|---|
| Approach to problem solving | [`CONTEXT.md`](CONTEXT.md) · [`docs/DPI.md`](docs/DPI.md) |
| Business use case | [`docs/BUSINESS_CASE.md`](docs/BUSINESS_CASE.md) |
| Solution technical feasibility | [`docs/SECURITY.md`](docs/SECURITY.md) · [`CONTEXT.md`](CONTEXT.md) |
| Product roadmap | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| Team ability and culture | [`docs/TEAM.md`](docs/TEAM.md) |
| Addressable market | [`docs/MARKET.md`](docs/MARKET.md) |
| Financial proposal | [`docs/FINANCIAL_PROPOSAL.md`](docs/FINANCIAL_PROPOSAL.md) |

All seven now exist and are linked directly — none is a placeholder.

---

## Documents

Everything a reviewer might want, in one place, each linked once:

| Document | What it's for |
|---|---|
| [`CONTEXT.md`](CONTEXT.md) | Engineering context and hard constraints — the architecture, the two guards, the design tokens, the rules this project holds itself to |
| [`docs/EVIDENCE_LEDGER.md`](docs/EVIDENCE_LEDGER.md) | Every claim made about the Department's own portals, and exactly what backs each one — observed, reported, or about our own system |
| [`docs/DATA_SPEC.md`](docs/DATA_SPEC.md) | The scheme record schema every entry in `data/schemes.json` must satisfy |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Authentication, storage and Firestore rules, retention, analytics privacy, and what production on Department infrastructure would change |
| [`docs/ANALYTICS.md`](docs/ANALYTICS.md) | The measurement specification behind the analytics dashboard, including what is never collected |
| [`docs/DPI.md`](docs/DPI.md) | Why this is Digital Public Infrastructure, not a portal — the UPI analogy, made explicitly |
| [`docs/BUSINESS_CASE.md`](docs/BUSINESS_CASE.md) | Who pays, what this replaces, the cost of inaction, and why buying beats building |
| [`docs/MARKET.md`](docs/MARKET.md) | The four-rung addressable-market ladder, quantified where a published source exists |
| [`docs/TEAM.md`](docs/TEAM.md) | YoDevStudio's shipping discipline, evidenced on two other public repositories |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | The three-phase adoption path, each phase independently valuable and independently abandonable |
| [`docs/FINANCIAL_PROPOSAL.md`](docs/FINANCIAL_PROPOSAL.md) | The economics, structured as sourced figures and costed ranges, not a single quoted price |
| [`docs/audit-evidence/K14_HARDENING_AUDIT.md`](docs/audit-evidence/K14_HARDENING_AUDIT.md) | Measured page-weight and hardening pass this project ran on its own interface |
| [`docs/BUILD_GUIDE_V2.md`](docs/BUILD_GUIDE_V2.md) | The committed build schedule this submission was built against, cited elsewhere as the basis for hours-invested estimates |

---

## Architecture

```
┌─────────────────────── STATIC CORE ───────────────────────┐
│  Deployed to TWO origins (Pages primary, Netlify mirror)  │
│  Zero dependencies · no build step · no framework · no CDN │
│  Works offline after first load · nothing to 502            │
│                                                            │
│  portal shell · chat-shaped discovery · eligibility engine │
│  subsidy explainer · document checklist · registry API     │
│  /insights/ coverage analytics · disclosure panel · i18n    │
│                                                            │
│  ⛔ NO service call may enter this path. Ever.             │
└────────────────────────────┬──────────────────────────────┘
                             │ optional, always degradable
┌────────────────────────────┴──────── SERVICES LAYER ──────┐
│  auth/session (OIDC)  ·  document upload + retention       │
│  anonymous analytics  ·  application status  ·  CMS store  │
│  extension-worker / operator mode                           │
│                                                            │
│  Every call: timeout, failure path, and a user-visible     │
│  degradation that keeps the citizen able to act.           │
└───────────────────────────────────────────────────────────┘
```

**The test that decides where a feature belongs:** can a farmer with no account, no signal after first load, and no intention of logging in still reach a verdict and a document list? If yes, it's core. If it needs an account, it's services.

The static core is vanilla HTML, CSS, and ES modules — no npm, no bundler, no framework, no third-party CDN in the read path. There is no `package.json` in this repository, and there is meant not to be one. The one bridge between the two layers, `js/registry-source.js`, is read-only from the static core's side: it can only ever *receive* a scheme array from the services layer, never call back into it, and always falls back to the committed file on any failure.

---

## The two guards

Two independently-enforced mechanisms are why no figure a citizen sees can be invented, and they do different jobs — describing them as one thing is an overclaim.

**Guard 1 — the template guard** (`js/assemble.js`, `assertNoUnsourcedNumber`). Scans assembled prose for digit sequences, in both Latin and Devanagari numerals, and throws if any digit sequence is absent from an allowlist built from the scheme's own `benefit.amount_inr`, `benefit.amount_text_hi`, `name_hi`, and a serialisation of its eligibility rules. `dataset_version` and `last_verified` are deliberately excluded from that allowlist so a version number or a date can never be reused to smuggle an unrelated figure into speech. **Known scope limit, stated honestly rather than left for a reviewer to find:** this is a substring test over concatenated allowlist text, not a formal proof — a comma-grouped numeral can split into separate digit sequences that each happen to match something else in the allowlist. It is a strong tripwire, not a guarantee that no adversarially-constructed string could ever slip past it.

**Guard 2 — the arithmetic guard** (`js/explainer.js`, `assertDerivedFromSourced`). Structural and exact, not a substring test. Every number the subsidy explainer computes carries a `{value, from}` tag, where `from` is one of `{kind:'rule', path}` (traced to a specific field in the scheme record), `{kind:'input', slot}` (traced to what the citizen actually answered), or `{kind:'derived', op, operands}` (traced to an arithmetic operation over already-tagged operands). Rule paths are re-resolved against the live record, input values are re-checked against the citizen's actual answers, and derived values are **re-computed**, recursively, before anything is rendered. Anything that can't be verified this way throws, rather than rendering.

`tests/eligibility.test.html`'s own guard-throw assertions are the fastest way to see both in action: corrupt a derived value in the test harness and watch Guard 2 throw; the harness's passing suite is Guard 1 and Guard 2 both holding on every real record in `data/schemes.json`.

---

## The explainability layer (XAI)

Every verdict a citizen sees carries an auditable-decision panel underneath it — collapsed by default, one tap to open, printable, and read aloud by the same speaker button every other answer uses. This is explainable AI in the literal sense the term names, not the marketing sense: a probabilistic confidence score states how sure a model is and stops there; this panel instead names **the exact clause of the rule that decided the outcome**, **the citizen input it was evaluated against**, and **the source document with its verification date** — every one of the three things a reviewer would need to reproduce the decision by hand, not merely trust a number. Reproducibility is a stronger claim than confidence, and it's the one this system can actually back with a re-run, not a probability.

`NEED_MORE_INFO` — the third verdict state alongside `ELIGIBLE` and `NOT_ELIGIBLE` — is this system's explicit, named form of what an XAI framework calls **"human review required."** A confidence-scored system would fold that case into a low score and move on; here it is its own state, and the panel names precisely which input is still missing rather than reporting a number a citizen has no way to act on.

---

## Data provenance

The registry holds **12 schemes** today (`data/schemes.json`, `api/v1/index.json`), split by `scheme_group`: **6 schemes** are Rajasthan Department of Agriculture records, and a separate **6 schemes** are related-welfare records from other departments (Social Justice & Empowerment, Rural Development, Health, Food, and Petroleum & Natural Gas via Oil Marketing Companies) that a farming household also depends on — the two counts are kept and reported separately, never silently summed into one undifferentiated total, because they answer different questions (how deep is agriculture coverage, versus how far has the same engine already reached beyond it).

Every record carries a `source_url` and a `last_verified` date, and a `verification_interval_days` field that sets a re-check cadence rather than leaving verification open-ended: **11 schemes** sit on a 90-day cycle, and the remaining **1 scheme** — the rural-employment wage rate, which the source revises more often — sits on a 30-day cycle. `next_review_due`, computed from that interval, is a real field a Department official's dashboard already reads to flag anything overdue (Table A's analytics row). Of the 12 records, 2 are sourced from `text_pdf` circulars — machine-extractable, but still requiring a human to locate and read them — and none today are sourced from a scanned raster image; `source_type` is the field that would flag one if a future scheme is.

Where a rule genuinely cannot be confirmed, the field stays `null` with a `rate_policy` explaining why, rather than a guessed figure — `CONTEXT.md` constraint 3, applied identically to every record.

---

## The open registry API

The scheme registry is published as static, versioned JSON — no auth, no rate limit, no key — so any other application (e-Mitra software, another department, a third-party aggregator) can build on the same data this portal uses, without asking permission.

| Endpoint | Contents |
|---|---|
| [`/api/v1/index.json`](api/v1/index.json) | Registry version, generation timestamp, and a summary row per scheme (name, department, source, `has_subsidy_rule`) |
| `/api/v1/schemes/{scheme_id}.json` | The full verbatim record for one scheme — eligibility rules, benefit, documents, `subsidy_rule` where one exists |
| `/api/v1/diff/{from}/{to}.json` | Field-level diff between two registry versions, emitted automatically on any change |
| [`/api/v1/insights.json`](api/v1/insights.json) | Generated coverage analytics — unreachable schemes, most-often-blocking slots, headline profile analysis |

```bash
curl -s https://yodevstudio.github.io/kisan-dwaar/api/v1/index.json | head -20
```

---

## Security, retention, and what is not implemented

Full specification: [`docs/SECURITY.md`](docs/SECURITY.md). Summarised here, stated the same way that document states it — nothing below is described as live unless it is.

**Live today:** Google Sign-In through Firebase Authentication, framed throughout as a standards-compliant OIDC login — `signInWithRedirect`, not a popup, because popups are unreliable on the mobile and in-app browsers this project's users are actually on. The session object kept in memory is exactly `{uid, provider}` — Google's response also returns an email and display name, and both are dropped before anything else in the app ever sees them. `storage.rules` and `firestore.rules` are deny-by-default: every path is unreachable unless a rule explicitly opens it, and that enforcement holds even against a client that bypasses this project's own code entirely and calls the Firebase REST API directly. Analytics collects zero identifiers by construction — aggregate counters only, keyed by event type, a coarse discriminator, and date, with no IP address, no device fingerprint, no cross-session identifier, and no linkage to a signed-in identity, ever written.

**Stated as policy, not yet enforced server-side:** the 30-day upload retention interval is defined once (`js/policy.js`) and shown to the citizen before a file is ever chosen, but the scheduled Cloud Function that deletes expired files (`functions/index.js`) is written and not deployed — it requires Firebase's paid Blaze plan, unavailable on this prototype's free tier. Virus scanning is a documented hook, not running code: no scanning service is wired up, and a synchronous client-side "scan" would itself be exactly the kind of fabricated guarantee this project avoids elsewhere.

**A named, not silent, access-control gap:** the CMS's Firestore rules require only that a user be authenticated, not that they hold a specific staff role — there is no custom-claims/role system in this prototype, so any citizen who completes the same Google Sign-In flow could read or write any scheme's draft. Acceptable for a judged prototype with no real editorial stakes; not acceptable for a production rule-authoring surface, and `docs/SECURITY.md` §7.1 states what closing it would require.

---

## DPI alignment

`docs/DPI.md` makes the argument in full; the shape of it: before UPI, every bank ran its own silo, and NPCI's open, versioned protocol let any licensed participant settle a payment against any other bank's account without sharing a codebase. `api/v1/` is this project's version of that same shape at the scale of one department in one state — plain, versioned JSON, no login, no API key, `source_url` and `last_verified` on every record — so any consumer, from an e-Mitra kiosk tool to a second department's own portal, inherits the provenance along with the data. The pitch this document supports is not "buy our app" — it is that the Department should own this registry the way NPCI owns the UPI protocol, as infrastructure other things get built on, including things this team does not build.

---

## Impact

Measured, not asserted: running `js/eligibility.js` — the identical engine the portal itself uses — against every value in `data/slots.json` shows all **12 schemes** are reachable today; **0 schemes** are structurally unreachable by any combination of answers (`api/v1/insights.json`, published at `/insights/`). The single most-often-blocking question across every profile tested is occupation, responsible for roughly 28% of all "not eligible" outcomes generated — a citizen who isn't a farmer is, correctly, screened out earliest, not stalled deep in a form. Set against `docs/EVIDENCE_LEDGER.md`'s observed baseline — a login wall crossed before any eligibility information is shown at all — replacing that with a zero-account, six-question path is the actual product. `docs/BUSINESS_CASE.md` §4 names what each of the brief's three named non-citizen stakeholders — Department officials, extension workers, and DoIT&C — gets from this today, not as a future promise: a rule-authoring and monitoring tool, a batch multi-farmer mode built on the identical engine a citizen would use, and an open registry to govern rather than a portal to operate.

---

## Rollout

Three phases, each independently valuable and independently abandonable — the Department gets real value from Phase 1 alone, with no obligation to reach Phase 3 (`docs/ROADMAP.md`).

1. **Publish the registry.** The Department hosts `api/v1/`'s JSON alongside its existing portal — nothing else changes, days not months, and the real ongoing cost is the verification labour this project already absorbed once.
2. **Embed the widget** on the Department's own existing scheme pages — their portal, their URLs, their branding, this project's adjudication. Proposed, not shipped: it was the first item cut from this build for time, in favour of the twelve verified records and the commercial documents this challenge treats as non-negotiable.
3. **The full front end**, optional and last, only after Phases 1 and 2 are live and only if the Department wants a dedicated front door rather than an embedded widget inside its existing one.

Beyond the challenge: a Jan Aadhaar adapter the moment sandbox credentials arrive (an adapter, not a rearchitecture, since `services/session.js` is already provider-agnostic), an expanded and field-tested dialect vocabulary, and further departments — six of the twelve records already prove this is a matter of repeating the same verification discipline, not new technology.

---

## Financial model

Structured as economics, not a single quoted price (`docs/FINANCIAL_PROPOSAL.md`) — every figure carries a source or a `[NEEDS SOURCE]` marker and a stated method:

- **Cost to build:** an estimated ₹52,800–₹1,65,000 already invested, and an estimated ₹46,400–₹1,74,000 to production, both ranges built from named, bounded remaining tasks rather than a lump sum.
- **Cost to run:** near-zero per transaction, because the eligibility engine runs in the citizen's own browser against static JSON, not a server queried per citizen. First load measures **~48 KB of own code** (HTML/CSS/JS/data — what the portal actually depends on before it's usable), **~149 KB of self-hosted fonts**, and **~177 KB of third-party SDK loaded lazily, only after render, only if online** — an honest total of **~374 KB** (`docs/FINANCIAL_PROPOSAL.md` §2, re-measured after the fonts were self-hosted and the SDK moved out of the boot path). On Netlify's published free-tier bandwidth, that supports roughly **280,000 first-time page loads a month** worst-case (everything downloads), or **~532,000** for the offline-safe own-code-plus-fonts portion alone — before any hosting cost is incurred either way.
- **Services-layer costs that do scale:** Auth, Firestore, and Cloud Storage each scale with a named, bounded dimension (monthly active authenticated users, document reads/writes, GB stored) — never with citizen traffic on the read path, since a citizen who never logs in generates zero services-layer cost.
- **Maintenance:** an SLA-backed verification retainer, priced per scheme per cycle using the registry's own `verification_interval_days` field — an estimated ₹22,720–₹1,27,800 per year for the 12 schemes as they stand today, before adding a single new one.
- **The second department is a dataset, not a rebuild:** already proven, not hypothetical — 6 of the 12 schemes already in this registry belong to departments other than Agriculture, added at the same per-scheme cost as any agriculture record, with zero incremental engine or portal spend.

---

## Team

YoDevStudio's claim is narrow and checkable, not a headcount (`docs/TEAM.md`): the two capabilities this project depends on most have each already shipped to a real, public release before this submission.

- **[ShauchMap](https://github.com/yodevstudio/shauchmap)** — a Flutter/Firebase Android app at release v1.0.0, with CI, an MIT licence, a security policy, a code of conduct, a contributing guide, and a changelog. It runs on Firebase Auth and Firestore, the exact stack this project's services layer (`services/session.js`, `services/cms.js`, `services/upload.js`, `services/telemetry.js`) is built on.
- **[VAANI](https://github.com/yodevstudio/vaani)** — a second, delivered instance of this project's own pattern: a vernacular, deterministic scheme-discovery assistant for Rajasthan government schemes, on a different dataset, using the same engine shape and the same source-and-verification discipline. KISAN DWAAR is the second application of that same registry engine, not the first time this team has built one.

---

## Known limitations

Stated as limitations, not glossed over:

- The Jan Aadhaar/Rajasthan-SSO adapter is designed but not built, blocked on a still-pending external sandbox-credential request — not on remaining engineering effort in this codebase.
- The embed widget (Rollout Phase 2) is proposed, not shipped — it was the first item cut from this build when time ran short.
- The dialect vocabulary (`data/lexicon.json`) is a hand-built starting set proving the normalisation mechanism works dialect-agnostically; it is not systematically verified or native-speaker field-tested.
- Virus scanning on uploaded documents is a documented design hook, not running code — no scanning service is wired up in this prototype.
- The scheduled auto-deletion Cloud Function that enforces the 30-day retention policy server-side is written but not deployed — it requires Firebase's paid Blaze plan, a billing decision outside this codebase's scope.
- CMS access control gates on being signed in, not on holding a specific staff role — any authenticated user can read or write any scheme's draft, a documented gap named in `docs/SECURITY.md` §6.1.
- There is no dedicated upload page yet in the citizen-facing ten-page portal itself; today's upload paths are a developer demo screen and the extension-worker operator tool.
- Guard 1 (the template guard) is a substring tripwire over concatenated allowlist text, not a formal proof — stated in full above, under "The two guards."
- Several figures in `docs/BUSINESS_CASE.md`, `docs/MARKET.md`, and `docs/FINANCIAL_PROPOSAL.md` still carry an explicit `[NEEDS SOURCE]` marker where this project has not independently confirmed a figure against its primary document — marked rather than quoted as settled.

---

*प्रस्ताव प्रोटोटाइप — YoDevStudio.* This is a challenge submission prototype, not a deployed government service. It does not impersonate the Department of Agriculture or any Rajasthan government entity — no state emblem, no Ashoka capital, no official seal, no `.gov.in`-imitating chrome, anywhere in this repository. No real citizen data is processed: application-status records, the upload screen, and every other placeholder are labelled as demo data in the interface itself, not only in this file.
