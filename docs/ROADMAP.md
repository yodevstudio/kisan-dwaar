# ROADMAP.md
### Three-phase adoption. Each phase is independently valuable and independently abandonable — the Department gets real value from Phase 1 alone, with zero obligation to ever reach Phase 3.

Ships in the repository at `docs/ROADMAP.md`, feeding iStart Parameter 4 (product roadmap). No phase below assumes the one before it fails to satisfy the Department, and no phase requires migrating away from what came before it — each is additive, not a replacement for the last.

---

## Phase 1 — Publish the registry. Nothing else changes.

The Department starts hosting `api/v1/`'s generated JSON — or its own equivalent, built the same way — as static files alongside its existing portal. The existing portal, its login flow, its content, its domain: none of it moves or changes.

| | |
|---|---|
| **The Department does** | Serves a folder of static JSON files from existing web infrastructure. No new server, no new database, no new vendor contract — the same class of hosting already serving the department's current site. |
| **We do** | Hand over the generated registry, the build tooling that produces it (`tools/build-registry.mjs`, `tools/validate-data.mjs`), and the verification methodology behind every record (`docs/DATA_SPEC.md`) — so the Department (or any vendor it names) can add, correct, or re-verify a scheme record without needing us in the loop. |
| **Time to market** | Days, not months — this is a file-hosting decision, not a build. The actual bottleneck is procurement sign-off to touch existing infrastructure at all, not engineering time. |
| **What it costs** | Marginal hosting cost only (negligible for a few hundred kilobytes of JSON). The real, ongoing cost is verification labour to grow past the twelve records already shipped — the same cost this project already absorbed once. |
| **What could stop it** | Institutional caution about touching *any* production infrastructure, however trivially, without a formal change process — a real, common blocker, not a technical one. Or a judgement that a machine-readable API with no citizen-facing UI doesn't visibly "count" as a deliverable, even though it is the asset `docs/DPI.md` argues is the actual product. |

**Independently valuable because:** the moment this is live, any consumer that can send an HTTP GET — an e-Mitra kiosk tool, an NGO's app, a second department's own portal — can evaluate a citizen's eligibility against verified data, with zero dependency on KISAN DWAAR's own front end ever being adopted at all.

---

## Phase 2 — Embed the widget on the Department's own scheme pages.

A small JavaScript embed (`<script>` tag, one line) that a Department web editor pastes onto its **existing** scheme pages. Their portal, their URLs, their branding stays exactly as it is — the embed renders the eligibility check inline, calling the same registry Phase 1 already published. No migration, no redesign, no new domain.

This is proposed, not shipped: it was scoped for this challenge (an embed widget was on the original build list) and was the first item cut when time ran short, in favour of the twelve verified scheme records and the commercial documents this build guide treats as non-negotiable. It remains a small, well-understood build — the eligibility engine and the registry it calls already exist and are already tested; what Phase 2 adds is a thin, embeddable rendering layer around them, not new logic.

| | |
|---|---|
| **The Department does** | Pastes one script tag onto each scheme page it wants adjudication on, and runs its own content-security/domain-embedding review — a real step for any `.gov.in` page embedding externally-hosted JavaScript, named honestly rather than glossed over. |
| **We do** | Build and support the embed widget itself, matching the Department's existing page styling rather than KISAN DWAAR's own design tokens, and offer a Department-hosted copy of the script file as the answer to the external-hosting security review. |
| **Time to market** | Weeks — mostly the security/content review above, and light styling work to sit inside an existing page rather than a new one. |
| **What it costs** | Modest integration and support effort. No portal rebuild, no new backend. |
| **What could stop it** | A `.gov.in` domain's justified reluctance to embed third-party script without a hosting/audit arrangement that satisfies its own security posture — solvable (self-hosting the script, a signed subresource-integrity hash), but a real conversation, not a formality. |

**Independently valuable because:** citizens keep using the portal, URL, and branding they already trust — adoption cost for the Department is near zero, and it can stop here permanently and still have solved the actual discoverability problem `docs/BUSINESS_CASE.md` §2 and §3 describe.

---

## Phase 3 — The full front end. Optional, and last.

Only after Phases 1 and 2 are live does a full, KISAN-DWAAR-shaped citizen portal — chat-shaped discovery, the document checklist, the explainer, bilingual, offline-capable — become the natural next question, and only if the Department wants a dedicated front door rather than an embedded widget inside its existing one.

| | |
|---|---|
| **The Department does** | Decides whether it wants a dedicated front end at all, on what domain, under what branding, and commissions the production hardening a live citizen-facing government surface needs beyond a challenge submission — real Jan Aadhaar/SSO integration (see the capability roadmap below), a production Firebase project scoped to the Department's own governance, and a content/accessibility sign-off process. |
| **We do** | Everything the static core and services layer in this repository already demonstrate, taken from prototype to production: real auth against the Department's actual identity provider, the CMS and operator mode handed to actual Department staff and extension workers, and ongoing registry maintenance. |
| **Time to market** | The longest of the three phases — months, driven mostly by the identity-integration timeline (Jan Aadhaar sandbox credentials are an external dependency this project does not control, `docs/SECURITY.md`) and by whatever accessibility/security sign-off a production government portal requires. |
| **What it costs** | The largest of the three, but still framed against the alternative in `docs/BUSINESS_CASE.md` §5: buying a working, already-verified registry and engine and hardening it for production, not commissioning a new eligibility system from a blank page. |
| **What could stop it** | Procurement timelines; the Jan Aadhaar credential dependency stalling past this project's control; or, reasonably, the Department deciding Phases 1 and 2 already solved the actual problem and a third portal to maintain isn't worth it. That last outcome is not a failure of this roadmap — it is Phase 2 doing its job. |

---

## Capability roadmap beyond the challenge

Three specific, scoped capabilities this repository does not yet ship, named honestly rather than implied:

- **Jan Aadhaar integration, on credential issue.** `docs/SECURITY.md` states this plainly: no Jan Aadhaar/SSO adapter exists in this repository yet, blocked on a still-pending sandbox-credential request to the nodal officer. The moment those credentials arrive, this becomes a scoped adapter task against a v1.8-compliant OIDC flow — the services layer (`services/session.js`) is already written provider-agnostic for exactly this reason, so adding a second identity provider is an adapter, not a rearchitecture.
- **Dialect vocabulary, expanded and field-tested.** `data/lexicon.json` already carries a hand-built set of Marwari/Mewari/Dhundhari dialect-to-standard-Hindi phrase mappings, proving the normalisation mechanism (`js/normalise.js`) works script- and dialect-agnostically. It is a starting vocabulary, not a systematically verified or native-speaker-tested one — a dedicated dialect-expansion pass was the first item cut from this submission for time, and remains a bounded vocabulary-and-testing task against an already-working mechanism, not an open research problem.
- **Further departments.** `docs/MARKET.md` rung 2 names this directly: six of the twelve records already in this registry are non-agriculture departments, on the identical engine, today. Extending coverage further is a matter of repeating the same verification discipline against a new department's circulars — the same work Phase 1 already proved out for agriculture, not new technology.
