# SECURITY.md
### Technical security specification for KISAN DWAAR — authentication, storage, retention, analytics privacy, consent, and what changes on Department infrastructure.

Every claim below is checkable against the file it describes. Where a control is designed but not yet built, this document says so explicitly — the same discipline `assertNoUnsourcedNumber`/`assertDerivedFromSourced` apply to a rupee figure applies here to a security claim: nothing is stated as live unless it is.

---

## 0 — Threat model and scope

The static core (`js/`, `index.html`, `pages/`) has almost no attack surface by design: it reads `data/*.json` and computes locally, with no write path and no citizen input ever persisted (`CONTEXT.md` constraint 1). The services layer (`services/`, `functions/`, `admin/`) is where an authenticated identity, an uploaded file, or a stored draft exists, and is therefore where this document concentrates.

Out of scope: this is a hackathon-stage prototype on Firebase's Spark (free) plan, evaluated by judges, not a production system handling real citizen documents. Every section below that describes current behaviour describes *prototype* behaviour; §7 states plainly what production on Department infrastructure would need to change before that ceases to be true.

---

## 1 — Authentication model (S1)

### 1.1 What is live today

`services/session.js` implements a provider-agnostic session shape — `login()` / `logout()` / `getSession()` / `onSessionChange()` — backed today by **Google Sign-In through Firebase Authentication**, framed throughout the codebase as a standards-compliant OIDC login, never as "sign in with your personal Google account."

- **Flow:** `signInWithRedirect`, not `signInWithPopup`. This was not a default choice — `signInWithPopup` was tested directly and threw `auth/popup-blocked`, consistent with this project's real users being on mobile browsers, low-end Android, and in-app browsers, all of which routinely block or mishandle popups. Redirect leaves the page and returns to it, so it works wherever the browser can load a page at all.
- **Persistence:** `setPersistence(auth, browserLocalPersistence)`, called explicitly rather than left to the SDK default — "the session survives a reload" is a stated decision in this file, not an accident of whatever Firebase currently defaults to.
- **Redirect-result handling:** `getRedirectResult()` is awaited once, early, on every page that calls `login()`; a failure (e.g. the citizen closes the Google screen) is captured via `getLastLoginError()` rather than left as an unhandled rejection, since there is no page left to reject a promise on by the time the browser has navigated back.
- **Minimum PII (constraint 5):** the session object kept in memory is exactly `{ uid, provider: 'google' }`. Google's OIDC response also hands back an email address and display name; both are read by the Firebase SDK and then **dropped by `toSession()`** before anything else in the app ever sees them. No caller — `services/upload.js`, `services/cms.js`, the operator tool — receives more than a `uid`.
- **Isolation from the static core:** `session.js` is imported only by `services/` and `pages/` code, never by `js/app.js` or `index.html`. The citizen-facing discovery flow has no code path that can even reference an auth state, live or broken.

### 1.2 Jan Aadhaar fallback — **not implemented**

`services/session.js`'s own header comment names a planned second provider: *"a future Jan Aadhaar-backed provider (see `janaadhaar-sim.js`, the WebCrypto adapter kept ready while Z5's sandbox credential request is still pending) can replace the implementation below without any caller changing."*

Stated plainly, because a security document is the wrong place to let an aspiration read as a fact: **`js/janaadhaar-sim.js` does not exist in this repository.** It is not in `docs/BUILD_GUIDE_V2.md`'s task list under any ID, it is referenced only in comments and planning docs, and no WebCrypto signing or key-transport code has been written. The blocker is real and external, not a dropped task: per `docs/BUILD_GUIDE_V2.md`'s **Z5**, a credential request for Jan Aadhaar/SSO sandbox access was sent to the nodal officer and `apim.rsd@rajasthan.gov.in`; as of this document, no sandbox credentials have arrived to build or test an adapter against.

What *is* true, and is the actual value of the design: `session.js`'s four-function shape (`login`/`logout`/`getSession`/`onSessionChange`) is the entire contract every caller in this codebase depends on. Swapping Google OIDC for a Jan Aadhaar-backed provider is, by construction, a change confined to this one file — no caller in `services/upload.js`, `services/cms.js`, `pages/status/`, or `admin/operator/` needs to change, because none of them reference Firebase Auth directly.

If and when sandbox access is granted, the target standard is **Jan Aadhaar Integration Document v1.8 (August 2025)** — not v1.4, which an earlier research pass incorrectly cited (`docs/EVIDENCE_LEDGER.md` B7). v1.8's exact padding scheme for key transport (`RSA-OAEP`) versus signing (`RSASSA-PKCS1-v1_5`) is confirmed as two distinct operations, not a version conflict; building against v1.4 or conflating the two operations would be the two concrete mistakes to avoid.

### 1.3 Authorization — what "logged in" grants

There is no role or claims system. `firestore.rules` and `storage.rules` distinguish exactly two states: **unauthenticated** and **authenticated as some uid**. There is no admin, staff, or operator role recognised by any security rule — see §6.1 for why this is a stated gap, not a silent one.

---

## 2 — Storage & Firestore security rules (S2, S3, S5)

Both rule files open with the same posture, stated in both files' own header comments: **deny-by-default (Z4)** — every path is unreachable unless a `match` block below explicitly opens it, narrowly.

### 2.1 Cloud Storage (`storage.rules`)

```
match /{allPaths=**} {
  allow read, write: if false;
}

match /uploads/{uid}/{docId}/{fileName} {
  allow read:   if request.auth != null && request.auth.uid == uid;
  allow write:  if request.auth != null && request.auth.uid == uid
                && request.resource.size < 10 * 1024 * 1024
                && request.resource.contentType.matches('image/.*|application/pdf');
  allow delete: if request.auth != null && request.auth.uid == uid;
}
```

- **Per-user path isolation:** the `{uid}` segment is matched against `request.auth.uid` on every operation — a citizen (or the operator tool, uploading under its own authenticated identity — see `admin/operator/`'s S6 documentation) can only ever read, write, or delete inside their own path. This is enforced at the rule layer, not the client: a request that bypasses `services/upload.js` entirely and calls the Storage REST API directly is still bound by the same check.
- **Type and size enforcement:** `contentType` is constrained to `image/*` or `application/pdf`; `size` is capped at 10MB (`10 * 1024 * 1024` bytes) — the same figure `js/policy.js`'s `UPLOAD_MAX_FILE_BYTES` states client-side, so a citizen who passes the client's pre-flight check is never surprised by a rule rejection afterward.
- **`{docId}` is one opaque path segment**, not a fixed enum — it accepts any single-segment string, including the operator tool's namespaced values (`AADHAAR_op3`) described in S6's own documentation, without needing a rule change.

### 2.2 Firestore (`firestore.rules`)

Three collections are opened, each narrowly:

**`uploads_audit/{uid}/events/{eventId}`** — the upload/deletion audit trail (§5).
```
allow create: if request.auth != null && request.auth.uid == uid
              && request.resource.data.uid == uid;
allow read:   if request.auth != null && request.auth.uid == uid;
allow update, delete: if false;
```
Append-only **by rule, not by convention** — update and delete are refused unconditionally, including to the document's own owner. An audit trail that can be edited after the fact is not one.

**`analytics_counters/{counterId}`** — S3's aggregate event counters (§4).
```
allow read: if true;
allow create: if isValidCounterShape(data) && data.count == 1;
allow update: if isValidCounterShape(data)
              && data.count == resource.data.count + 1
              && data.event_type == resource.data.event_type
              && data.discriminator == resource.data.discriminator
              && data.date == resource.data.date;
allow delete: if false;
```
No auth requirement — matching a citizen with no account and no intention of ever creating one. Read is unconditionally open, which is only safe because a counter document (e.g. `verdict_issued/ELIGIBLE/2026-08-21 → count: 41`) carries no PII by construction (§4). Write is constrained by `isValidCounterShape()` to the exact five `event_type` values `docs/ANALYTICS.md` §2 defines, and to incrementing `count` by exactly 1 per write with every other field held constant — a client can increment a counter it's allowed to touch and nothing else: it cannot create an arbitrary document, retarget an existing counter's identity, or set `count` to an arbitrary value.

**`cms_drafts/{schemeId}`** and **`cms_published/{schemeId}` (+ `versions/{versionId}`)** — the S5 rule-authoring store.
```
allow read, write: if request.auth != null;
```
Any authenticated user, not a specific role — flagged explicitly in the rule file's own comment as **"a documented gap, not a silent one — see D10/SECURITY.md,"** which this document answers in §6.1. Version history under `cms_published/{id}/versions/{id}` follows the same append-only pattern as the upload audit trail: `create` and `read` are allowed, `update`/`delete` are unconditionally refused.

### 2.3 What "publish" means here

`cms_published` is a Firestore staging area, not the live registry. The static core reads `data/schemes.json` — a git-tracked file — never Firestore (constraint 1). "Publishing" from the CMS produces registry-valid JSON that a human still reviews and commits by hand; Firestore is where that JSON and its version history live in the interim, not a path by which an unreviewed change could reach a citizen.

---

## 3 — Client-side pre-flight checker (S2)

`services/upload.js`'s `preflightCheck(file)` runs before any byte leaves the browser:

| Check | Logic |
|---|---|
| Type | `file.type` must be one of `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |
| Size | `file.size` must be under `UPLOAD_MAX_FILE_BYTES` (10MB, from `js/policy.js`) |
| PDF page count | A dependency-free heuristic — counts `/Type /Page` occurrences (excluding `/Type /Pages`, the page-*tree* node) in the raw PDF bytes, decoded as Latin-1 text. Flags anything over 10 pages. Returns `null` (treated as "unknown," never as "zero") when the count can't be determined — this is a citizen-convenience check, not a real PDF parser, and is documented as such in the file's own comment |
| Legibility | **Never automated.** Every image is flagged `needsLegibilityReview: true` unconditionally — this codebase has no image-quality model, and a fabricated automated "looks legible" pass would be exactly the kind of unverified claim `CONTEXT.md` rules out elsewhere. A human glance is required, always |

**This is explicitly not the security boundary.** The file's own header states it plainly: `storage.rules` enforces auth, per-user path, type, and size independently of this code, so a client that skips the UI entirely — or is actively hostile — still cannot write past what the rules in §2.1 allow. The pre-flight checker exists only to save a citizen on a slow connection from a failed round-trip.

---

## 4 — Analytics privacy model (S3)

Full specification: `docs/ANALYTICS.md`. Summarised here for the security posture; that document is authoritative for measurement detail.

- **Zero identifiers, by construction, not by policy.** `docs/ANALYTICS.md` §3 lists nine categories of data analytics never collects — no name/phone/email, no Jan Aadhaar/Aadhaar/SSO identifier, no IP address in any form (raw, hashed, or truncated), no device fingerprint, no precise location, no citizen-typed or citizen-tapped value (only which question was asked), no persistent cross-session identifier, no referrer or tracking parameter, and no linkage to an S1 authenticated identity. `js/policy.js`'s `ANALYTICS_NEVER_COLLECTED_HI`/`_EN` arrays are the single source both the disclosure panel (K12) and the S3 dashboard render, so the two surfaces can never quietly disagree.
- **Rotating per-tab session id, never transmitted.** `services/telemetry.js` generates `crypto.randomUUID()` once per tab (`sessionId`), used exclusively as a client-side key in an in-memory `Set` (`dedupeFired`) to suppress an accidental double-fire of the same event within one page view (e.g. a re-render triggering `page_view` twice). It is **never included in any Firestore write** — inspect `record()`'s payload (`{ event_type, discriminator, date, count: increment(1) }`) directly — and is discarded on tab close. It cannot reconstruct a session because it never leaves the browser.
- **Aggregate counters only, keyed by `{event_type, discriminator, date}`.** There is no per-event log to retain or delete; the store holds running totals. This is enforced doubly: by `services/telemetry.js`'s own write shape, and independently by `firestore.rules`' `isValidCounterShape()` (§2.2), so the guarantee holds even against a client that ignores `telemetry.js` entirely.
- **A real bug, found and fixed, worth recording here:** `trackPageView(location.pathname)` originally threw when the pathname was `/` or contained a `/`, because Firestore's `doc()` parses `/` as a path separator even inside what the caller intends as one segment. Fixed by `sanitizeForDocId()`, which replaces `/` with `_` **in the document ID only** — never in the stored `discriminator` field value, so the recorded data is unaffected. Documented in `services/telemetry.js`'s own comment as a live-discovered issue, not a hypothetical one.

---

## 5 — Document retention (S2)

**Stated policy: 30 days**, defined once at `js/policy.js`'s `UPLOAD_RETENTION_DAYS` and consumed by both the disclosure panel (K12) and `services/upload-demo.html`'s consent screen, so the citizen-facing promise and the number a developer would change are the same constant.

**Enforcement mechanism — written, not deployed.** `functions/index.js` contains `deleteExpiredUploads`, a Cloud Scheduler job (`onSchedule('every 24 hours', ...)`) that:
1. Lists every file under `uploads/` in Cloud Storage using the Firebase **Admin SDK**, which runs server-side and bypasses `storage.rules`/`firestore.rules` entirely by design — those rules govern what a citizen's browser can do, not this one trusted, scheduled process.
2. Compares each file's `timeCreated` metadata against a cutoff of `RETENTION_DAYS` (30) days ago.
3. Deletes anything older, then records an `auto_deleted` event on the **same append-only `uploads_audit` trail** the upload path itself writes to (§2.2) — "what happened to this file and when" is answerable from one place for both upload and deletion.

**Why it is not deployed:** `onSchedule` requires Firebase's Blaze (pay-as-you-go) plan — Cloud Scheduler is unavailable on the free Spark plan this prototype runs on. Enabling billing is a decision for whoever owns the project, not something to flip from inside a coding session. The source exists specifically so the retention policy stated on the consent screen is backed by real, reviewable code today, ahead of the plan upgrade that would activate it (`firebase deploy --only functions`, documented in `functions/README.md`).

**Consent sequencing (constraint 8):** `services/upload-demo.html` states the retention interval — dynamically, from `UPLOAD_RETENTION_DAYS`, never hardcoded prose — **before** the file picker is shown at all; the upload area (`#upload-area`) stays `display:none` until the consent checkbox is ticked. A citizen cannot select a file without having first been shown, in this order: (1) that this is a prototype and no real documents should be submitted, (2) the exact retention interval, (3) the consent checkbox itself.

---

## 6 — Known gaps

Stated here deliberately, per this project's own discipline of recording a `null` rather than a guess (constraint 3) applied to security posture rather than scheme data.

### 6.1 CMS access control is not role-based

`firestore.rules`' own comment on `cms_drafts`/`cms_published` states it directly: *"Any authenticated user, not a specific admin role — this project has no custom-claims/role system (that would need a deployed Cloud Function to assign roles, which nothing here does), so 'logged in' is the only gate today."* Any citizen who completes the same Google Sign-In flow described in §1.1 can read or write any scheme's draft. This is acceptable for a judged prototype with no real editorial stakes, and is not acceptable for a production rule-authoring surface — §7.1 states what closing this gap would require.

### 6.2 Jan Aadhaar adapter is designed, not built

Covered fully in §1.2. Blocked on external sandbox access (Z5), not on remaining engineering effort within this codebase.

### 6.3 Virus scanning is a documented hook, not running code

`services/upload.js`'s own comment specifies the intended design: a Cloud Storage "on finalize" trigger that reads the just-written object at `uploads/{uid}/{docId}/{fileName}`, scans it, and either leaves it in place or deletes it and writes a flagged event to `uploads_audit`. It is explicitly **not** built, because no scanning service is available in this environment to wire up honestly, and because no meaningful virus scan can run client-side, in-browser, before the bytes ever leave the device — a synchronous client-side "scan" would itself be closer to the kind of fabricated guarantee this project avoids elsewhere.

### 6.4 The retention job is source-only

Covered fully in §5. Blocked on a Blaze-plan billing decision outside this codebase's scope, not on remaining code.

### 6.5 `docs/ANALYTICS.md`'s own status line is stale

Its header still reads *"S3 (services layer, not yet built)"*, written ahead of S3's implementation per that document's own note (§6 of that file). S3 has since been built and is live (`services/telemetry.js`, this document's §4). The specification itself remains accurate; only that one status line needs updating in a future pass — noted here rather than silently left inconsistent.

---

## 7 — What production on Department infrastructure would change

Everything above describes a prototype built on Firebase's Spark plan, evaluated on `github.io`/`netlify.app` origins, authenticating against a personal Google account framed as OIDC. None of that is what a Department deployment would actually run. Stated explicitly, as a forward-looking design intent — **not** a description of anything built today:

### 7.1 SAML/SSO integration, and real role-based access

Google Sign-In would be replaced by the Department's actual SSO — most likely SAML 2.0 or OIDC federated against Rajasthan's SSO/Jan Aadhaar identity systems, once the Z5 sandbox access this document's §1.2 describes is granted. Because `services/session.js` already isolates every caller behind a four-function contract, this swap is confined to one file. Alongside it, closing §6.1's gap would require a deployed Cloud Function to assign custom claims (e.g. `role: 'editor'`) to specific staff accounts, with `firestore.rules`' `cms_drafts`/`cms_published` rules updated to check `request.auth.token.role == 'editor'` instead of merely `request.auth != null`.

### 7.2 State data center hosting

The static core's entire premise — two independent origins, zero backend in the read path — would move from Netlify + GitHub Pages to Department-controlled infrastructure (RajCOMP / NIC data centers, per standard Rajasthan e-governance hosting patterns), likely behind `.rajasthan.gov.in` or a departmental domain rather than `.netlify.app`/`.github.io`. The services layer (currently Firebase: Auth, Firestore, Cloud Storage, Cloud Functions) would move to whatever the Department's approved cloud/on-prem stack is — Firebase's role here was always "the configured stack for this prototype," not an architectural commitment (`CONTEXT.md`'s "Port deltas" table treats it as swappable).

### 7.3 HSM key management

Jan Aadhaar's WebCrypto adapter (§1.2), once built, currently anticipates browser-native `SubtleCrypto` operations (`RSASSA-PKCS1-v1_5` signing, `RSA-OAEP` key transport, per v1.8) running client-side, with no private key material held by this application at all — the adapter's job is to *use* Jan Aadhaar's own cryptographic flow, not to mint or custody keys. In a production Department deployment, any server-side signing key this application's backend held (for a callback verification step, for instance) would need to live in a Hardware Security Module (Rajasthan SDC's HSM offering, or equivalent) rather than as an environment variable or a Cloud Function's in-memory secret — the same principle `CONTEXT.md`'s secrets rule already applies at prototype scale (no credential ever committed to the repository), extended to "no credential ever held outside dedicated key-management hardware" at production scale.

---

## 8 — Verification

Every claim above is checkable directly:

```bash
# Deny-by-default posture — read both rule files, confirm the catch-all
# match block at the top of each denies before anything else opens a path
cat storage.rules firestore.rules

# Static core has zero service-call leakage (constraint 1)
grep -rn "firebase\|firestore\|fetch(.*functions" js/eligibility.js js/assemble.js js/explainer.js js/router.js js/normalise.js
# must be empty

# Minimum PII in the session object — confirm only uid/provider are kept
grep -n "toSession" services/session.js

# No identifier leaves the page on an analytics event (docs/ANALYTICS.md §6)
# — open DevTools → Network, trigger a discovery-flow question, inspect
# the outgoing Firestore write payload, confirm it matches services/telemetry.js's
# record() call exactly: { event_type, discriminator, date, count }

# Retention constant is the single source for both the consent screen and
# the (undeployed) deletion job
grep -n "UPLOAD_RETENTION_DAYS" js/policy.js
grep -n "RETENTION_DAYS" functions/index.js

# No secret ever committed (CONTEXT.md's absolute rule)
git ls-files | grep -i -E '\.env|service-account|serviceAccount|credentials\.json'
# must be empty

# No AI-tool attribution anywhere in history (CONTEXT.md's absolute rule)
git log --format='%an|%ae|%B' | grep -i -E 'claude|anthropic|co-authored|generated with'
# must be empty
```
