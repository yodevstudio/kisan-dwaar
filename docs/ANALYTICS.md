# ANALYTICS.md
### Measurement spec for S3 — what is measured, how, and the exact list of what never is.

Ships in the repository at `docs/ANALYTICS.md` and is linked from the README and the disclosure panel (K12), since K12 must state on the same page what analytics never collects.

**Status: specification.** This document describes what S3 (services layer, not yet built) must implement and what it must never do. It is written ahead of the build, per the Day-7 gate for S3, so the build has a fixed target rather than a set of habits that drift. Where a term below ("session token," "event") names a mechanism, that is this spec proposing an implementation, not a description of code that already exists.

---

## 1 — Why this document exists

CONTEXT.md's hard constraint 5 states the ceiling this spec cannot cross:

> Analytics collects **no identifier at all** — rotating per-session random id, event counts only, no IP retention, no cross-session linkage.

Everything below is that sentence, expanded into a measurable spec — what "no identifier," "event counts only," and "no cross-session linkage" mean concretely, so S3's gate ("Dashboard shows real numbers from real usage. DevTools confirms no identifier leaves the page.") is checkable by a judge in the Network tab in under a minute, the same discipline `EVIDENCE_LEDGER.md` applies to claims about the Department's own portals.

---

## 2 — What is measured

Six counters. The first five match the S3 task description in `BUILD_GUIDE_V2.md`; `language_active` was added for T8's officer dashboard (a Hindi-vs-English usage split), on the same mechanism and under the same never-collected discipline as the rest of this table:

| Event | Fires when | What is recorded |
|---|---|---|
| `page_view` | Any static-core page loads | Page path (relative, e.g. `/pages/check/`), timestamp rounded to the hour |
| `question_answered` | A discovery-flow slot is filled (tap or typed) | The slot name only (e.g. `age`) — never the value the citizen gave |
| `verdict_issued` | `eligibility.js: evaluate()` returns a verdict | The verdict type only — `ELIGIBLE`, `NOT_ELIGIBLE`, or `NEED_MORE_INFO` — never the scheme name or the slots that produced it |
| `scheme_surfaced` | A scheme appears in a discovery result or an explainer view | `scheme_id` only |
| `feedback_vote` | K20's thumbs + reason chip is submitted | Thumbs direction and the selected reason chip only — never free text (K20 offers no free-text field for exactly this reason) |
| `language_active` | Any static-core page loads | Which UI language was active — `hi` or `en` — nothing else; this is the toggle state already visible on screen, not a new inference about the citizen |

`page_view` and `language_active` now both fire from `js/nav.js`'s shared `renderNav()` — every page calls it, so this is the first point at which "any static-core page loads" (this table's own stated trigger since before either counter existed) is actually true site-wide, not just on the two pages that happened to call `trackPageView` directly.

Each event is one write: a counter increment keyed by `{event_type, discriminator, date}` (e.g. `verdict_issued / ELIGIBLE / 2026-08-21`). The store holds running totals, not a per-event log — there is nothing to replay into a session, because nothing resembling a session is persisted server-side.

The **rotating per-session random id** CONTEXT.md requires exists only client-side, only for the tab's lifetime, and does exactly one job: deduplicating a double-fire of the same event within one page view (e.g. a component re-render triggering `page_view` twice). It is generated fresh per tab, is never sent as a field on any event payload, is never written to any store, and is discarded on tab close. It cannot be used to reconstruct a session because it never leaves the browser.

---

## 3 — The never-collected list

Published verbatim on the same dashboard page S3 builds, per its task description, and mirrored in K12's disclosure panel. Analytics never collects, stores, or derives:

- A name, phone number, email address, or any other citizen-supplied identifier
- Any Jan Aadhaar / Aadhaar / SSO identifier, token, or session credential
- IP address, in raw, hashed, or truncated form
- Device fingerprint (user agent string, screen resolution, installed fonts, canvas/WebGL fingerprinting, or any composite thereof)
- Precise location — the citizen's self-declared `district` slot answer is counted only inside `question_answered`'s slot-name tally (that a district question was answered), never as a value, and never joined to any other event
- Any value the citizen typed or tapped — only which slot was answered, never what they answered
- A persistent cross-session or cross-device identifier of any kind (cookie, local-storage id, fingerprint) — the per-session random id in §2 does not qualify because it is regenerated every tab and never transmitted
- Referrer URL, campaign parameter, or any other tracking query string
- Anything from the services layer's authenticated identity (S1) — analytics and auth are separate systems; an S1 session id is never passed to an analytics call

---

## 4 — Storage and retention

Event counters live in the services layer (Firestore, per CONTEXT.md's configured stack), behind the same deny-by-default rules Z4 establishes: the client can *increment* a counter at a narrow, specific path and cannot read raw events, only the aggregated dashboard can. This mirrors S2's pattern (client writes are rule-constrained, not merely UI-constrained) so the guarantee holds even against a client that ignores the UI entirely.

Because the store holds only aggregate counters keyed by `{event_type, discriminator, date}`, there is no per-citizen row to retain or delete — retention is a non-issue for this system in the way it is a real issue for S2's uploaded documents. Counters accumulate for the life of the dataset version they're tagged against and are never pruned in a way that would make the dashboard's historical trend line silently wrong.

---

## 5 — What the dashboard shows

Per the S3 task description: page views, questions answered (by slot), verdicts issued (by type), schemes surfaced (by `scheme_id`), and feedback votes (thumbs by reason chip) — each as a real running count from real usage, not seeded or placeholder data. Unlike S4's application-status timeline, nothing on this dashboard is demo data, so it carries no "seeded" label; it is the one live number in the services layer from day one.

**T8** turned this into the officer-facing dashboard proper, at the same URL (`services/analytics-dashboard.html`), gated behind the same Google sign-in S5's CMS already uses (no new auth mechanism):

- **Usage**, from the six counters above: visits by page, eligibility checks started (a `page_view` on the check page) vs completed (a `verdict_issued`, of any type), verdicts by type, schemes surfaced most often, drop-off by question number (`question_answered` counts for each of `data/slots.json`'s six `core_sequence` slots, in order — a fall in count between two consecutive slots is where citizens stopped), Hindi vs English (`language_active`), and the feedback split (thumbs totals, then by reason chip).
- **Operational**, needing no citizen data and no event at all — read straight from `data/schemes.json` and the CMS's own Firestore collections: schemes past their `verification_interval_days`, every record with a `null` benefit figure alongside its `rate_policy`, pending CMS drafts (`cms_drafts` — why this section needs sign-in, since that collection isn't publicly readable), and records whose `next_review_due` has passed.

A metric with no events yet reads as a real zero, captioned as such — this is a low-traffic prototype, not a broken dashboard.

---

## 6 — Verification

Matches S3's stated gate in `BUILD_GUIDE_V2.md`:

1. **Dashboard shows real numbers from real usage.** Use the live discovery flow a few times, reload the dashboard, confirm the counts moved by the same amount.
2. **DevTools confirms no identifier leaves the page.** Open the Network tab, trigger each of the five events in §2, inspect the outgoing request payload for every one, and check it against §3. No field should be found there.

---

## 7 — Relationship to other tasks

- **K12 (disclosure panel)** links this document and states the same never-collected list in citizen-facing Hindi/English copy, so the commitment is legible without reading a markdown file.
- **K20 (feedback widget)** is this spec's only source for `feedback_vote` — it is built thumbs-plus-reason-chip specifically so no free-text field can ever carry an identifier into this system by accident.
- **K18 (`/insights/`)** is a different system and is not analytics: it runs every profile in the slot catalogue through the engine statically at build time and publishes coverage findings from the registry. It involves no citizen and no live event.
- **S1 (auth)** and **S4 (application status)** hold the only citizen-linked data in the services layer; this system is designed to have no path by which their identifiers could reach it.
