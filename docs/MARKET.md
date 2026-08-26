# MARKET.md
### The four-rung ladder — this department, this state → other Rajasthan departments → other states → a national eligibility-rules registry.

Ships in the repository at `docs/MARKET.md`, feeding iStart Parameter 6 (addressable market). Per `docs/BUILD_GUIDE_V2.md`'s own instruction for this document, rungs 1–2 are quantified from published sources, each cited; rungs 3–4 are qualitative — the structural argument, not a guessed number. Every figure external to this repository is marked `[NEEDS SOURCE: what, where to look]` rather than estimated. `CONTEXT.md` constraint 3 ("never invent scheme data") is treated here as applying to market figures too.

---

## Rung 1 — This department, this state: Rajasthan Department of Agriculture

The registry this project publishes already covers **12 verified schemes** (`data/schemes.json`, `api/v1/index.json`), split **6 agriculture-department schemes and 6 related-welfare schemes from other departments** relevant to a farming household (`scheme_group` field, same file). That is a curated, hand-verified starting set, not the department's full catalogue — the honest ceiling within agriculture alone is larger:

`[NEEDS SOURCE: the Rajasthan Department of Agriculture's own published count of currently active schemes/circulars — check the department's official scheme list or annual report for the true total this registry could grow to cover.]`

The addressable population for that registry is every farming household in the state:

- **Rajasthan operational landholdings.** `[NEEDS SOURCE: Agriculture Census (latest available round, Ministry of Agriculture & Farmers Welfare) — Rajasthan's total number of operational holdings and operated area.]`
- **PM-KISAN beneficiaries in Rajasthan.** This registry already verifies the scheme itself — ₹6,000/year, paid in three instalments, sourced to `pmkisan.gov.in` (`data/schemes.json`, `RJ_PMKISAN`) — but not the state-level beneficiary count. `[NEEDS SOURCE: PM-KISAN's own public beneficiary dashboard (pmkisan.gov.in) or the most recent Lok Sabha/Rajya Sabha reply citing Rajasthan's registered beneficiary count.]` PM-KISAN beneficiaries are a reasonable proxy for "farmers a state agriculture registry needs to reach," since PM-KISAN's own eligibility criteria overlap heavily with the state schemes this registry already models (occupation = farmer, a landholding record).
- **e-Mitra kiosk count.** The extension-worker/operator mode this project ships (`admin/operator/`) is designed to run from exactly this kind of kiosk. `[NEEDS SOURCE: RISL's (the Rajasthan government IT services entity that runs e-Mitra — confirm its exact current corporate name directly from its own site rather than this document) published e-Mitra kiosk count for the state — RISL's website or annual report.]`

These three published figures, once sourced, give a defensible denominator for "how many farmers and how many kiosks a Rajasthan-agriculture-only deployment already reaches" — the base of the ladder, not its ceiling.

---

## Rung 2 — Other Rajasthan departments: the engine is already proven outside agriculture, twice over

This rung does not require a hypothetical. Two pieces of evidence already exist:

**Inside this repository, today.** Six of the twelve records already in `data/schemes.json` are not Agriculture Department schemes at all — they are schemes from **Social Justice & Empowerment** (old-age/farmer pension), **Panchayati Raj & Rural Development** (the rural employment guarantee), **Rural Development** (PMAY-Gramin housing), **Medical & Health** (Ayushman/health cover), the **Food Department** (NFSA ration entitlement), and **Petroleum & Natural Gas via Oil Marketing Companies** (Ujjwala LPG connections) — grouped as `related_welfare` in the same registry, evaluated by the identical engine, because a farmer is also a citizen of every one of those departments at once (`pages/schemes/`, T2's `scheme_group` split). The registry format and the eligibility engine do not know or care which department issued a rule; that is the whole of `docs/DPI.md`'s argument, already true of the software as shipped, not proposed for the future.

**Outside this repository.** YoDevStudio has already built a second, live instance of the same underlying pattern — vernacular, deterministic scheme-discovery for Rajasthan government schemes, on a different dataset than this one — proving the engine is not a one-off built for agriculture specifically. `[NEEDS SOURCE: the specific Rajasthan department/scheme domain this second instance currently covers, and its live URL — confirm both directly from that project's own repository/README before citing either in a deck or a submission document, since this document does not carry either detail independently verified.]`

Between those two facts, rung 2's claim is not "this could work elsewhere" — it is "this already does, and a second full department-scale deployment is a matter of contracting and dataset-building, not of unproven technology."

`[NEEDS SOURCE: a count of Rajasthan state departments that currently operate a citizen-facing scheme-discovery or application portal of any kind — for a denominator on how many more rung-2 deployments are realistically addressable. The state government's own department directory (rajasthan.gov.in) is the place to start counting.]`

---

## Rung 3 — Other states (qualitative)

`CONTEXT.md`'s own thesis about Rajasthan — *"the Department's eligibility rules are computationally invisible — locked in PDF circulars, several of them scanned rasters"* — was reached by direct observation of two specific Rajasthan portals (`docs/EVIDENCE_LEDGER.md` A3), not asserted about any other state. This project's own dataset today carries two circulars published as text PDF (`data/schemes.json`'s `source_type: text_pdf` — machine-extractable, not scanned) and none yet as a scanned raster, so the specific "scanned raster" failure mode is evidenced here from the live portal capture (A3), not from this project's own registry. The structural claim this rung makes is narrower and more defensible: **every state government publishes scheme rules as circulars and government orders, and PDF of some kind — text-layer or scanned — is the dominant publishing format for that kind of document across Indian state governments generally.** That is a pattern this project is positioned to verify state-by-state the same way it verified Rajasthan's, not a number to state today.

No claim is made here about which other states, how many, or on what timeline — that belongs in `docs/ROADMAP.md`, and only after the kind of first-hand verification pass this project applied to Rajasthan, applied again per state. Rung 3 exists to name the shape of the opportunity, not to size it.

---

## Rung 4 — A national eligibility-rules registry, as Digital Public Infrastructure (qualitative)

`docs/DPI.md` makes this argument in full — the UPI analogy stated explicitly: before UPI, every bank published its own silo; NPCI's open, versioned protocol let any licensed participant settle a payment against any other bank's account without a shared codebase or a vendor contract. `api/v1/` is this project's version of that same shape at the scale of one department in one state: plain, versioned JSON, no login, no API key, `source_url` and `last_verified` on every record, so any consumer — a second department's portal, an NGO's app, a national scheme-aggregator — inherits the provenance along with the data.

The brief itself, quoted in full in `CONTEXT.md`, asks for a *"Citizen-Centric Digital Front-End"* — a front end, stated as such. This project's own interpretive framing, stated as a deliberate choice in `CONTEXT.md` ("framing that must not drift") and defended at length in `docs/DPI.md`, is that the front end the brief asks for is best built as one application on top of a registry, rather than as a monolith — and that framing is what invites rung 4, not a claim that the brief's own text names a national registry. The national version of rung 4 is the same registry pattern held by a body positioned the way NPCI is positioned for payments — a public-good custodian, not a single vendor or a single department — publishing eligibility rules for centrally-sponsored schemes (PM-KISAN, PMFBY, PMAY-G, NFSA, Ujjwala — all five already represented as real records in this project's own dataset, `data/schemes.json`) once, nationally, instead of every state re-deriving the same central scheme's rules from its own copy of the same circular.

This is stated as an argument for where the ladder leads, not as a plan this document is proposing to build. `docs/ROADMAP.md` is where a costed, phased path — if one is warranted — belongs.
