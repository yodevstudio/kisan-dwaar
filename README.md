# किसान द्वार — KISAN DWAAR

## Try it in three minutes

**Live:** <https://kisan-dwaar.netlify.app/>

**Demo path:** पात्रता जांचें (Check eligibility) → तारबंदी योजना (Tarbandi) → answer as a small farmer → अनुदान राशि जानें (Calculate subsidy) → स्रोत (View source).

A citizen-facing front door to Rajasthan's agriculture schemes, built by **YoDevStudio** for the Rajasthan Innovation Challenge: *"Revamp of Department of Agriculture Web Portal — Citizen-Centric Digital Front-End."*

A farmer answers six questions instead of navigating a login wall, and gets a verdict, a document checklist, and — where the rule is known — a worked subsidy calculation. Every figure is traceable to a versioned dataset with a source URL and a verification date. This is the agriculture instance of a general scheme-rules registry — same engine, same provenance discipline, an agriculture dataset and a portal-shaped front end on top.

---

## Table A — the challenge brief's six Expected Outcomes

Every artifact link below is a path in this repository — click through, don't take our word for it.

| Expected Outcome | Key Artifact(s) | Status |
|---|---|---|
| **Mobile-first, multilingual CMS** | [`admin/cms/`](admin/cms/index.html) (authoring, drafts, version history) · [`js/i18n.js`](js/i18n.js) (Hindi/English, all ten pages) · [`css/kisan.css`](css/kisan.css) (64px touch targets, mobile-first layout) | 🟡 Partial — multilingual UI and mobile-first layout are live across the whole portal; CMS authoring works end to end, but publish writes to a staging area only — a human still copies the emitted JSON into `data/schemes.json` by hand ([`services/cms.js`](services/cms.js)). |
| **Rules-based AI chatbot** | [`index.html`](index.html) · [`js/app.js`](js/app.js) · [`js/eligibility.js`](js/eligibility.js) · [`js/router.js`](js/router.js) · [`js/normalise.js`](js/normalise.js) | 🟡 Partial — deterministic, zero-LLM engine (37/37 tests passing), full tap-to-answer discovery in Hindi and English. Typed free-text routing is Hindi-only by current design; English/Hinglish free text does not yet resolve to a scheme. |
| **API-driven scheme-eligibility checker** | [`api/v1/`](api/v1/index.json) · [`js/eligibility.js`](js/eligibility.js) · [`tools/build-registry.mjs`](tools/build-registry.mjs) | ✅ Live — versioned, diffed, no-auth registry; the same engine the portal itself uses. |
| **Secure document-upload module** | [`services/upload.js`](services/upload.js) · [`storage.rules`](storage.rules) · [`firestore.rules`](firestore.rules) · [`functions/index.js`](functions/index.js) | 🟡 Partial — auth-gating, per-user storage paths, and type/size limits are enforced at the rules layer, not just the client. Scheduled auto-deletion is written but not deployed (requires a paid Firebase plan); virus scanning is a documented, not built, hook. No upload screen exists yet in the citizen-facing ten-page portal itself. |
| **SSO / Jan Aadhaar integration** | [`services/session.js`](services/session.js) · [`docs/SECURITY.md`](docs/SECURITY.md) | 🟡 Partial — a real, working OIDC-framed login (Google Sign-In via Firebase Auth) is live. The Jan Aadhaar/Rajasthan-SSO adapter itself is designed but not built, blocked on a still-pending official sandbox-credential request (`docs/SECURITY.md` §1.2). |
| **Analytics dashboard for usage and feedback** | [`services/telemetry.js`](services/telemetry.js) · [`services/analytics-dashboard.html`](services/analytics-dashboard.html) · [`docs/ANALYTICS.md`](docs/ANALYTICS.md) | ✅ Live — real event counters from real usage, zero identifiers collected, verifiable in DevTools. |

A 🟡 row is a real gap, stated as one rather than left to be discovered — the same discipline the engine itself applies to a scheme record it can't verify (`data/schemes.json`'s `null` fields, never a guess).

## Table B — the seven iStart evaluation parameters

| Parameter | Document |
|---|---|
| Approach to problem solving | [`CONTEXT.md`](CONTEXT.md) |
| Business use case | `docs/BUSINESS_CASE.md` 🚧 not yet written |
| Solution technical feasibility | [`docs/SECURITY.md`](docs/SECURITY.md) · [`CONTEXT.md`](CONTEXT.md) |
| Product roadmap | `docs/ROADMAP.md` 🚧 not yet written |
| Team ability and culture | `docs/TEAM.md` 🚧 not yet written |
| Addressable market | `docs/MARKET.md` 🚧 not yet written |
| Financial proposal | `docs/FINANCIAL_PROPOSAL.md` 🚧 not yet written |

---

## Live origins

Deployed to **two independent origins**, deliberately — the resilience story is that if one fails during evaluation, the other still demonstrates the full discovery → eligibility → explainer → registry path end to end.

| Origin | Role | URL |
|---|---|---|
| **Netlify** | Primary — hosts the services-layer integration | <https://kisan-dwaar.netlify.app/> |
| **GitHub Pages** | Static mirror — core only | <https://yodevstudio.github.io/kisan-dwaar/> |

```bash
curl -sI https://yodevstudio.github.io/kisan-dwaar/ | head -1   # expect 200
curl -sI https://kisan-dwaar.netlify.app/ | head -1              # expect 200
```

---

## Architecture

```
┌─────────────────────── STATIC CORE ───────────────────────┐
│  Deployed to TWO origins (Netlify primary, Pages mirror)  │
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

The static core is vanilla HTML, CSS, and ES modules — no npm, no bundler, no framework, no third-party CDN in the read path. There is no `package.json` in this repository, and there is meant not to be one.

**Full technical detail:** [`CONTEXT.md`](CONTEXT.md) (architecture and hard constraints) · [`docs/SECURITY.md`](docs/SECURITY.md) (auth, rules, retention, privacy) · [`docs/DATA_SPEC.md`](docs/DATA_SPEC.md) (scheme record schema) · [`docs/ANALYTICS.md`](docs/ANALYTICS.md) (measurement spec).

---

## Run it locally

No install step, because there is nothing to install.

```bash
git clone https://github.com/yodevstudio/kisan-dwaar.git
cd kisan-dwaar
python3 -m http.server 8000
```

Then open:

- <http://localhost:8000/> — the citizen-facing portal
- <http://localhost:8000/pages/schemes/> — the twelve verified schemes, and the rest of the ten-page IA under `pages/`
- <http://localhost:8000/admin/cms/> — the S5 rule-authoring tool (requires Google Sign-In)
- <http://localhost:8000/admin/operator/> — the S6 extension-worker / e-Mitra operator mode
- <http://localhost:8000/tests/eligibility.test.html> — the engine's own test harness (see below)

Everything above works with the network offline after the first load, except the two `admin/` tools' login/upload/publish actions, which degrade to a clear message rather than a broken page (`CONTEXT.md` constraint 1).

---

## Testing

**Engine test harness** — unit tests against synthetic fixtures, plus a regression pass that runs every real `data/schemes.json` record through the engine:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/tests/eligibility.test.html
# expect: 37 / 37 passed (grows as more tests are added; check the page, not this number)
```

**Data validation** — checks every scheme record against `docs/DATA_SPEC.md`'s schema before it can reach the registry:

```bash
node tools/validate-data.mjs
# expect: validate-data: OK — 12 scheme(s) checked, 0 errors.
```

**Registry build** — regenerates `api/v1/` from `data/schemes.json`, versions it, and emits a diff against the previous version (run after any data change; commit what it writes):

```bash
node tools/build-registry.mjs
```

**Insights build** — runs `js/eligibility.js` against every real value in `data/slots.json` to compute unreachable-scheme and blocking-slot analysis, published at `/insights/`:

```bash
node tools/build-insights.mjs
```

**Pre-push checks** — must both return nothing, before any push:

```bash
git ls-files | grep -i -E '\.env|service-account|serviceAccount|credentials\.json'
git log --format='%an|%ae|%B' | grep -i -E 'claude|anthropic|co-authored|generated with'
```

---

## Open API

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

## Repository layout

```
kisan-dwaar/
├── index.html                  portal shell
├── css/kisan.css                design system
├── js/                          ── STATIC CORE — no service calls, ever ──
│   ├── app.js  eligibility.js  assemble.js  explainer.js  router.js
│   ├── normalise.js  i18n.js  nav.js  disclosure.js  policy.js  paths.js
├── services/                    ── SERVICES LAYER — optional, degradable ──
│   ├── session.js  upload.js  telemetry.js  cms.js
├── data/                        schemes.json · slots.json · lexicon.json · samples.json
├── api/v1/                      generated registry — do not hand-edit
├── pages/                       schemes · check · documents · notices · insights
│                                feedback · status · employee · about
├── admin/                       cms/ (S5 rule authoring) · operator/ (S6 operator mode)
├── functions/                   scheduled-deletion Cloud Function — source only, not deployed
├── tools/                       validate-data.mjs · build-registry.mjs · build-insights.mjs
├── tests/eligibility.test.html
├── docs/                        SECURITY.md · ANALYTICS.md · DATA_SPEC.md · DPI.md · …
├── CONTEXT.md                   engineering context — read before any change
└── README.md                    this file
```

---

## Verification checklist

Everything a reviewer needs, in one place:

- [ ] `curl -sI https://yodevstudio.github.io/kisan-dwaar/` → `200`
- [ ] `curl -sI https://kisan-dwaar.netlify.app/` → `200`
- [ ] Open the portal, complete a discovery flow with no account — reaches a verdict and a document list
- [ ] Toggle the Hindi/English switcher in the nav bar — every page, every question, every answer chip updates instantly
- [ ] `tests/eligibility.test.html` — all tests pass
- [ ] `node tools/validate-data.mjs` — `0 errors`
- [ ] Log out, then attempt an upload at `services/upload-demo.html` — denied by `storage.rules`, not just the UI
- [ ] Turn off the network — the portal and document checklist keep working; only login/upload/CMS degrade with a clear message
- [ ] `git ls-files | grep -i -E '\.env|service-account'` → empty
- [ ] `git log --format='%B' | grep -i claude` → empty

---

*प्रस्ताव प्रोटोटाइप — YoDevStudio.*
