# ENGINEERING.md
### The constraints KISAN DWAAR is built against — public edition.

Code comments and documents across this repository cite these rules as "`CONTEXT.md` constraint N". This file is the public edition of that engineering context, with the same numbering; internal working notes (task schedule, session protocol) are not part of it. Where this file and the code disagree, the code's own verification commands below are the arbiter.

---

## The project

**KISAN DWAAR (किसान द्वार)** — a citizen-facing front door to Rajasthan's agriculture schemes, built by **YoDevStudio** for the Rajasthan Innovation Challenge: *"Revamp of Department of Agriculture Web Portal — Citizen-Centric Digital Front-End."*

A farmer answers six questions instead of navigating a login wall, and gets a verdict, a document checklist, and a worked subsidy calculation — every figure traceable to a versioned dataset with a source URL and a verification date.

**Framing that must not drift:** this is the **agriculture instance of an existing scheme-rules registry**. Same engine, same provenance discipline, an agriculture dataset and a portal-shaped front end. Two applications of one piece of infrastructure.

**The thesis:** the Department's eligibility rules are computationally invisible — locked in PDF circulars, several of them scanned rasters — so no portal can adjudicate. We publish those rules as a machine-readable, versioned, source-cited registry, and build the front door on top.

---

## Secrets

The services layer introduces credentials. None of them enter the repository.

- **Never commit** a service-account JSON, a private key, an admin SDK credential, or a `.env` file
- Client-side config keys (Firebase web config) are **not secrets** and may be committed; service credentials are and may not
- `.gitignore` additionally excludes: `.env`, `.env.*`, `*-service-account*.json`, `*serviceAccount*.json`, `firebase-debug.log`, `.firebase/`
- Before any push, this must return nothing:
  `git ls-files | grep -i -E '\.env|service-account|serviceAccount|credentials\.json'`
- Security rules deny by default. Any rule change that opens read or write beyond the authenticated owner requires an explicit instruction and a stated reason.

---

## Hard constraints

### 1. No backend **in the read path**

The architecture is two layers, and the boundary *is* the constraint.

**Static core** — portal shell, chat-shaped discovery, `eligibility.js`, `assemble.js`, `explainer.js`, `router.js`, the document checklist, the registry under `api/v1/`, `/insights/`, the disclosure panel.
Vanilla HTML + CSS + ES modules. **Zero dependencies, no build step, no framework, no CDN, and no service call — ever.** Once a page has loaded, discovery, eligibility and the explainer make no network call at all, so they keep working with the network off; reopening a page offline depends on the browser's own cache (a service worker is a Phase 2 option). Deployed to two independent origins.

**Services layer** — authentication/session, document upload, anonymous analytics, application status, the CMS store.
May use the configured stack (Firebase Auth · Firestore · Cloud Storage). **Every call has a timeout, a failure path, and a user-visible degradation that leaves the citizen still able to act.**

**The test that decides where a feature belongs:** can a farmer with no account, no signal after first load, and no intention of logging in still reach a verdict and a document list? If yes it is core. If it needs an account, it is services.

**A change that adds a service call to a core module is rejected.** Checkable:
`grep -rn "firebase\|firestore\|fetch(.*functions" js/eligibility.js js/assemble.js js/explainer.js js/router.js js/normalise.js` → must be empty.

If a task appears to need npm, React or a bundler **in the static core** — stop and say so.

### 2. Never output a rupee figure that isn't traceable
To a field in `data/schemes.json` or a value the citizen typed in. `assemble.js` substitutes into pre-approved templates and never composes prose. `explainer.js` performs arithmetic where every operand carries a provenance tag verified before rendering (see §Two guards). If `amount_inr` is null, descriptive text is used. **Never generate, infer, estimate or interpolate an amount, ceiling, rate or date.**

### 3. Never invent scheme data
Not a Hindi name, not a threshold, not a document, not a source URL. Gaps stay `null` with a `rate_policy`, and the record's `note` says what could not be confirmed and why. The `Research_*` documents are background reading only — they may be used to *locate a URL to verify independently*, never as a value.

### 4. No LLM anywhere in the request path
Routing is deterministic keyword and slot matching. The brief's own words are **"rules-based AI chatbot"** — deterministic *is* the requirement, not a compromise. The interface is presented as a chat; the engine underneath is a rules engine. Never add a model call. `router.js`'s inherited `PRODUCTION NOTE` comments describing an LLM router are **deleted on port**.

### 5. No PII in the read path; minimum PII in the services layer
The static core persists only the dataset, the slot catalogue and UI preferences — never a name, an ID, a transcript, a land record or a quotation amount.
The services layer holds only what a named deliverable requires: an authenticated user identifier for uploads and status, and the uploaded documents themselves under a per-user path with **automatic deletion on a stated schedule**. Analytics collects **no identifier at all** — rotating per-session random id, event counts only, no IP retention, no cross-session linkage.

### 6. Never guess on low confidence
Below `CONFIDENCE_THRESHOLD`, ask a clarifying question with tappable options.

### 7. Never impersonate the Department
No Rajasthan state emblem, no Ashoka capital, no official seal, no departmental logo, no `.gov.in`-imitating chrome. Every page carries **प्रस्ताव प्रोटोटाइप — YoDevStudio**.

### 8. Demo data is labelled as demo data
Seeded application-status records, the upload screen and any placeholder are labelled in the interface, not only in the README. The upload screen states plainly that no real citizen documents should be submitted to the prototype, and states the retention interval **before** the file is chosen.

---

## Two guards — how the no-hallucination guarantee actually works

**Guard 1 — template guard (`assemble.js: assertNoUnsourcedNumber`).** Scans assembled prose for digit sequences (Latin and Devanagari) and throws if any is absent from an allowlist built from `benefit.amount_inr`, `benefit.amount_text_hi`, `name_hi` and a serialisation of `eligibility`. `dataset_version` and `last_verified` are excluded so they cannot launder a figure into speech.
*Known scope limit, stated honestly in the README:* substring test over concatenated allowlist text; comma-grouped numerals split into separate sequences. A strong tripwire, **not a formal proof**.

**Guard 2 — arithmetic guard (`explainer.js: assertDerivedFromSourced`).** Structural and exact. Every number carries `{value, from}` where `from` is `{kind:'rule', path}`, `{kind:'input', slot}` or `{kind:'derived', op, operands}`. Rule paths are re-resolved, input values re-checked, derived values **re-computed** — recursively. Anything unverifiable throws.

Describe them separately. Conflating them is an overclaim.

---

## Design tokens

```css
--ink: #14181F;  --field: #1F4D3D;  --paper: #F6F2E9;
--verdict: #1B7F4B;  --attention: #C8791A;  --halt: #B03A2E;
```

Six colours, one job each. **Colour is a semantic channel** — nothing is communicated by colour alone; every coloured state carries an icon and a word.

**Type:** Noto Sans Devanagari for Hindi, Inter for numerals and Latin, self-hosted with OFL licences. Base 20px, minimum 18px, answer headline 32px/700, Devanagari line-height ≥1.6.

**Floor:** 64px touch targets · visible keyboard focus on every interactive element · `prefers-reduced-motion` honoured · read-aloud on every verdict's decision panel · usable one-handed at 360px and at 200% zoom.

**Copy:** Hindi first, English secondary. Errors say what happened and what to do next — never a raw status code.

---

## Deployment facts that change how code is written

Served from **two independent origins**: GitHub Pages (primary) and Netlify (mirror). Both serve the full discovery → eligibility → explainer → registry path; the services layer talks to the same Firebase project from either.

- **Never write an absolute path.** `fetch('/api/v1/index.json')` breaks on a project subpath. Use `js/paths.js`, which resolves against its own `import.meta.url` (one level below the app root on either origin).
- `.nojekyll` at the repo root.
- The mirror is the resilience story: if one origin fails during evaluation, the core still demonstrates on the other URL.

---

## Known research errors — do not propagate

- `Research_03` says the Jan Aadhaar standard is v1.4 with RSA PKCS#1. **Wrong** — Integration Document **v1.8 (August 2025)** supersedes it. *Probable reconciliation: the ported simulator signs with `RSASSA-PKCS1-v1_5` and does key transport with `RSA-OAEP` — two different operations. The research most likely conflated them. Confirm against the PDF and cite the page.*
- **`Error 505` was not observed in our capture session.** Cite as a *reported* failure mode with attribution, never as something we saw.
- **"12–13 clicks"** is the full post-login sequence and was not observed. We observed **~3 substantive clicks to a login wall**. Say which is which, every time.
- All three research documents contain `[cite: N]` artifacts and escaped markdown; `Research_01`'s JSON block is unparseable. **Nothing is copy-pasted from them.**
