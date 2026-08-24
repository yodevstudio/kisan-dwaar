# DPI.md
### Why this is Digital Public Infrastructure, not a portal — the UPI argument, made explicitly.

Ships in the repository at `docs/DPI.md`. Feeds Parameter 1 (approach) and Parameter 6 (roadmap/scalability) directly — this is the argument that what's being proposed outlives the one front end it ships with.

---

## 1 — The distinction that matters

A portal is a single application one team maintains, that citizens visit and everyone else ignores. Digital Public Infrastructure (DPI) is the opposite shape: a thin, open, versioned layer that many independent applications can build on, none of them needing permission from — or a contract with — whoever built the layer.

CONTEXT.md states the framing this document exists to defend: **"this is the agriculture instance of an existing scheme-rules registry. Same engine, same provenance discipline, an agriculture dataset and a portal-shaped front end. Two applications of one piece of infrastructure."** KISAN DWAAR is not the product. `api/v1/` — the versioned, source-cited eligibility registry it publishes — is the product. KISAN DWAAR is the first of what should be several things built on top of it.

---

## 2 — The UPI analogy, made explicitly

Before UPI, every bank had its own app, its own login, and its own silo. Paying a merchant who banked elsewhere meant NEFT forms or cash. UPI didn't replace those apps — the National Payments Corporation of India published an **open, versioned protocol** any licensed bank or PSP could implement, and a payment initiated in one bank's app settles against an account at a different bank, because both sides speak the same protocol, not because they share a codebase or a vendor.

The equivalent failure mode in scheme delivery is what `docs/EVIDENCE_LEDGER.md` documents first-hand: eligibility logic locked inside one department's portal, reachable only through that portal's login wall, useless to an e-Mitra kiosk operator, a farmer-facing NGO app, or a second department that wants to cross-check eligibility for its own scheme. The rules exist; they are simply unreachable by anything that isn't this one portal.

`api/v1/` is this project's UPI-shaped answer: eligibility logic published as versioned JSON — not a login flow, not a proprietary API key, not a framework dependency — so any consumer that can send an HTTP GET can evaluate a citizen's eligibility the same way KISAN DWAAR itself does, because it calls the identical registry.

| UPI property | This registry's equivalent |
|---|---|
| Open protocol, not a single app | `api/v1/` is plain JSON over HTTP; the protocol is "read a file," nothing proprietary |
| Any licensed participant can build on it | Any front end — e-Mitra kiosk software, an NGO's app, a second department's portal — can consume the same registry without asking KISAN DWAAR's operator for access |
| Versioned, so old integrations don't silently break | Every record carries `dataset_version` (`tools/validate-data.mjs`'s `YYYY.MM.DD-N` format); `tools/build-registry.mjs` emits `diff/{from}/{to}.json` so a consumer can see exactly what changed between versions, not just that something did |
| Settlement is verifiable, not trust-based | Every eligibility claim traces to `source_url` and `last_verified` on the record itself (the two guards in CONTEXT.md), so a consuming app inherits the provenance, not just the number |
| No single point of commercial lock-in | The static core has zero framework dependency and no build step — a fork can run from a folder of files on any static host, the same property that lets it run on two independent origins today |

---

## 3 — What "forkable" actually means here, concretely

Not a slogan — three specific properties, all already true of the repository as built:

1. **No build step to reproduce.** `js/` is vanilla ES modules; there is nothing to `npm install` before a fork can run the static core. Cloning the repo and opening `index.html` over any static file server is the entire deployment story for the read path.
2. **No proprietary data format.** `data/schemes.json`, `data/slots.json`, and the generated `api/v1/` registry are plain JSON against a documented schema (`docs/DATA_SPEC.md`). A second department could write their own scheme records against the same schema without touching this project's code at all.
3. **No vendor a fork is locked into.** The services layer (auth, upload, analytics, status, CMS) is the one part of the system that touches a specific vendor's stack, and CONTEXT.md's architecture makes that layer optional by construction — the read path works with it entirely absent. A fork that doesn't want that vendor can drop the services layer and keep every citizen-facing guarantee.

What is **not** yet true, and should be named rather than implied: the repository does not currently carry an explicit open-source licence file. That is a governance decision for whoever holds the registry, not a technical one — DoIT&C, as the natural institutional home for a state-run DPI layer, would need to make that call before a second department or a third-party developer could rely on forkability as a legal guarantee, not just a technical one. Until then, "forkable" describes the architecture honestly; it does not yet describe a signed permission.

---

## 4 — Why this belongs to Government, not to one vendor

The pitch this document exists to support is not "buy our app." It is: **the Department should own an open, versioned scheme-rules registry the way NPCI owns the UPI protocol — as infrastructure other things get built on, including things this team doesn't build.** A citizen-facing portal that later gets replaced, redesigned, or built by a different vendor should not require re-deriving the eligibility logic from scanned PDFs a second time. That derivation — the actual expensive, auditable work — is what `api/v1/` preserves independently of any one front end's fate.
