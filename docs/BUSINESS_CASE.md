# BUSINESS_CASE.md
### Who pays, what it replaces, what inaction costs a farmer, who besides the farmer benefits, and why buying this is cheaper than building it.

Ships in the repository at `docs/BUSINESS_CASE.md`, feeding iStart Parameter 2 (business use case). Every figure below either cites something already in this repository, cites a named external source, or is marked `[NEEDS SOURCE]` with what to look for and where — per `CONTEXT.md` constraint 3, this document does not get to invent a number just because it is a commercial one, not a scheme one.

---

## 1 — Who pays, and from which budget line

The commissioning entity is named in the brief itself: *"Revamp of Department of Agriculture Web Portal — Citizen-Centric Digital Front-End"* (`CONTEXT.md`). The Rajasthan **Department of Agriculture** is the natural buyer of the citizen-facing front end this repository ships; **DoIT&C** (Department of Information Technology & Communication) is the natural buyer, or at minimum the empanelment/governance gatekeeper, of the underlying registry as shared state infrastructure (`docs/DPI.md` §4 makes this distinction explicitly — the Department owns the portal's fate, DoIT&C is the more natural institutional home for a registry other departments are meant to build on).

Two funding routes exist for a system shaped like this one, and both are real, named, existing mechanisms rather than something invented for this pitch:

- **State IT/e-Governance budget**, routed through DoIT&C and RISL — the Rajasthan government's IT services entity that already runs the e-Mitra network this project's own extension-worker mode (`admin/operator/`) is designed to sit alongside — though this project has not independently confirmed RISL's exact current mandate or full corporate name.
- **Digital Agriculture Mission**, a real, centrally-sponsored Ministry of Agriculture & Farmers Welfare scheme co-funded with states for farmer-facing digital public goods — the kind of registry `api/v1/` publishes reads as squarely inside that scheme's scope, though this project has not independently verified the Mission's exact terms, current guidelines, or whether Rajasthan has drawn on it for a project of this shape.

`[NEEDS SOURCE: (a) the specific budget head or scheme code this RFP itself draws funding from — check the original tender/RFP document, or the Rajasthan Department of Agriculture's IT/e-Governance budget line for the relevant financial year; (b) RISL's full corporate name and current mandate — confirm directly from RISL's own website rather than this document's paraphrase; (c) the Digital Agriculture Mission's current official guidelines (Ministry of Agriculture & Farmers Welfare) to confirm launch year, funding pattern, and whether a state-level eligibility registry qualifies, before quoting any of the three as settled fact.]`

---

## 2 — What this replaces or avoids

Per the fairness clause this project holds itself to (`docs/EVIDENCE_LEDGER.md`, clause D1): **the backend works.** Rajasthan has genuinely federated identity, land records and DBT. Nothing below is a claim that the Department's systems are broken — it is a claim about one specific, fixable layer: whether a citizen can find out if they qualify *before* being asked to prove who they are.

Every row is a first-hand, dated observation, not an inference — `docs/EVIDENCE_LEDGER.md` §A is the citation for each:

| What exists today | What this replaces it with |
|---|---|
| Eligibility information sits behind a Jan Aadhaar/SSO login wall — a farmer needs an account merely to discover which applicant category applies to them (EVIDENCE_LEDGER A4), reached after ~3 substantive clicks (A5) | A verdict, reachable with zero account and zero login, in six questions (`js/app.js`, `js/eligibility.js`) |
| A departmental circular is published as a scanned raster PDF requiring pinch-and-zoom on a phone (A3) | The same rule, transcribed once, published as versioned JSON with a source URL and verification date (`api/v1/`, `data/schemes.json`) — read by a machine, not re-read by every citizen |
| Administrative content ("Employee Corner": Transfer Order, Roster, APAR, DPC) sits in the same primary navigation as farmer-facing content (A1) | Farmer-facing navigation only in the primary menu; the equivalent staff-facing surface (`pages/employee/`) is reachable only from the footer, on this project's own site — the fix applied to itself, not just written up about someone else's |
| An accessibility score of 96 (PageSpeed Insights, mobile) coexists with a keyboard trap that makes the Employee Corner's own links untabbable (A9, A10, A11) — automated audits do not catch this class of failure | A manual keyboard walkthrough recorded on video (`docs/EVIDENCE_LEDGER.md` C8), not just an automated badge, applied to this project's own interface under the same instrument (clause D5) |
| A promotional popup with a broken image (A12); a dead `#` link on "BT Cotton Vendor Registration" (A13) | Zero placeholder links or broken assets in the shipped portal — checkable directly, not asserted |

---

## 3 — The cost of inaction, in what a farmer loses

No rupee figure is stated here that this project did not itself verify, per `CONTEXT.md` constraint 2 — applied to this document exactly as it is applied to a scheme record.

**What is directly observed:** a farmer today cannot learn which scheme category applies to them, or what documents a scheme needs, without first creating an account and logging in (EVIDENCE_LEDGER A4). For a farmer without a smartphone, without saved Jan Aadhaar credentials, or without confidence navigating an SSO flow, that login wall is not a formality — it is the point at which the farmer's own path to an answer ends, unless they make a physical trip to an e-Mitra kiosk or the block agriculture office to ask in person.

**What a third party modelled, attributed exactly as `docs/EVIDENCE_LEDGER.md` §B requires:** third-party UX research modelled cumulative abandonment across the full multi-step application funnel at over 70%, under an assumed 10% failure rate compounding at each step (EVIDENCE_LEDGER B2) — a modelled estimate under a stated assumption, never claimed here as something this project measured itself.

**The mechanism, stated without a fabricated number:** every one of those abandonments is a farmer who was very possibly eligible for real money — ₹6,000/year under PM-KISAN alone, verified from `pmkisan.gov.in` (`data/schemes.json`, `RJ_PMKISAN`) — and did not receive it, not because they were ineligible, but because the eligibility question itself was unanswerable without a login they could not or would not complete. That is the cost of inaction: not a portal defect, but foregone entitlement, at a scale this document will not guess at.

`[NEEDS SOURCE: an estimate of the average cost (time, transport fare) of a round trip from a representative rural Rajasthan village to the nearest e-Mitra kiosk or block agriculture office — for a concrete, sourced per-farmer cost of the "ask in person instead" fallback. Likely source: NSSO/Periodic Labour Force Survey rural mobility data, combined with `docs/MARKET.md` rung 1's now-sourced count of 25,000 Mini e-Mitra operators (Rajasthan Budget 2026-27) for a per-kiosk density estimate.]`

---

## 4 — The three non-citizen stakeholders, and what each gets

The brief names three stakeholders beyond the citizen: **Department officials, extension workers, and DoIT&C.** Each has a real, working artifact in this repository already, not a slide-only promise:

| Stakeholder | What they get | Where it lives |
|---|---|---|
| **Department officials** | A rule-authoring tool (CMS) that lets a non-developer draft, validate and version a scheme rule without touching JSON, plus an officer-facing dashboard covering usage (funnel, drop-off, feedback) and operational health (schemes overdue for re-verification, records with an unresolved `rate_policy`, pending drafts) — read from the same registry the citizen-facing portal uses, so an official is never looking at a second, drifting copy of the truth | `admin/cms/` · `services/analytics-dashboard.html` · `docs/ANALYTICS.md` |
| **Extension workers** (agriculture field staff, e-Mitra operators) | A fast, multi-farmer mode: batch entry, a combined document checklist across every eligible scheme, upload-on-behalf, and a printable per-farmer summary — built on the identical eligibility engine a farmer would get typing it in themselves, so a field officer's verdict can never quietly disagree with the portal's own | `admin/operator/` |
| **DoIT&C** | Not a portal to operate, but a registry to govern: `api/v1/` is published as open, versioned, no-auth JSON — any other application (a second department's portal, an NGO tool, e-Mitra kiosk software) can consume the identical eligibility data without a contract or an API key. `docs/DPI.md` makes the case in full for why this is the state's asset to hold, not one vendor's product to sell back to it | `api/v1/` · `docs/DPI.md` |

---

## 5 — Why the Department buying this is cheaper than building it

The expensive part of a system shaped like this one is not the code — `js/eligibility.js`, `js/assemble.js` and `js/explainer.js` together are a few hundred lines of dependency-free JavaScript, already written, already tested (`tests/eligibility.test.html`, run against every real record). **The expensive, non-reusable part is the verification work behind each of the twelve scheme records already in `data/schemes.json`**: locating the correct circular, confirming it against the department's own source (two of the twelve today are `text_pdf` circulars, machine-readable but still requiring a human to locate and read them — `data/schemes.json`'s `source_type` field; the same field is what would flag a future scanned-image source if one is added), deriving a rule from that source, and recording a `source_url` and `last_verified` date a citizen or an auditor can check independently.

That verification work is sunk. A new vendor starting from zero would have to redo all of it — re-locate every circular, re-read every PDF, re-derive every threshold, and, for any future scheme sourced from a scanned raster rather than a text-layer PDF, transcribe it by hand — before writing a single line of eligibility logic, because the rules were never machine-readable to begin with (`CONTEXT.md`'s own thesis). Buying the registry this project has already built and verified means paying once for that derivation and reusing the engine underneath it for every scheme added afterward, at the **marginal cost of one more verified record**, not the fixed cost of standing up a new eligibility system from a blank page.

The architecture is also built to make a second team's future work on it cheap, not proprietary: zero framework dependency, no build step, a documented and versioned data schema (`docs/DATA_SPEC.md`), and a services layer that is optional by construction (`CONTEXT.md` constraint 1) rather than a single vendor's backend the Department would be locked into. Whoever operates this a year from now — this team, a different vendor, or an in-house DoIT&C team — inherits a working registry, not a rewrite.

`[NEEDS SOURCE: a comparable government e-governance tender's stated cost and timeline for a citizen-facing eligibility/scheme-discovery portal of similar scope, for a concrete rupee-and-months comparison against this project's own build. Likely sources: GeM (Government e-Marketplace) past tender records, or a state e-Governance Society's published RFP archive.]`
