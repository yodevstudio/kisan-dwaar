# DATA_SPEC.md
### The dataset is the submission. This document is how it gets built.

K3 is the critical path and it is human work. Nothing in this document may be filled in by a session, from a research document, or from general knowledge. Every value comes from a page or PDF you opened yourself, on the date you write down.

---

## §1 — Record schema

Annotated against the reference implementation's actual shape, so the ported engine reads it without modification.

```jsonc
{
  "scheme_id": "RJ_IRRIGATION_PIPELINE",   // RJ_ + SCREAMING_SNAKE, stable forever
  "name_hi": "सिंचाई पाइपलाइन अनुदान योजना",  // exactly as published — never translated, never tidied
  "name_en": "Irrigation Pipeline Subsidy Scheme",
  "keywords_hi": ["पाइपलाइन", "सिंचाई पाइप", "एचडीपीई पाइप", "पीवीसी पाइप"],
                                            // ≥3 chars each; router.js scores whole-word matches only
  "department": "Agriculture Department (Agriculture Extension Division), Rajasthan / कृषि विभाग",

  "dataset_version": "2026.08.22-1",        // YYYY.MM.DD-N, N increments within a day
  "source_url": "https://rajkisan.rajasthan.gov.in/WebsiteNew/pipeline.html",
  "source_url_secondary": "https://jansoochna.rajasthan.gov.in/",
  "source_type": "html_page",               // html_page | text_pdf | scanned_pdf  ← NEW, see §2.3
  "last_verified": "2026-08-22",            // the day YOU opened it
  "verification_interval_days": 90,
  "next_review_due": "2026-11-20",
  "verified_by": "manual",

  "eligibility": {
    "all_of": [ {"slot": "occupation", "op": "eq", "value": "farmer"} ],
    "any_of": [],                            // entries may be a condition OR an array of ANDed conditions
    "none_of": []
  },

  "benefit": {
    "type": "subsidy",
    "amount_inr": null,                      // a number ONLY when a single fixed rupee figure is published
    "amount_text_hi": "…",                   // the published structure, in Hindi, when amount_inr is null
    "rate_policy": "VARIES_BY_MATERIAL_DO_NOT_COLLAPSE",   // REQUIRED whenever amount_inr is null
    "note": "…"                              // why null — one sentence, for the reader of the JSON
  },

  "subsidy_rule": { /* §3 — only for schemes whose benefit is computed */ },

  "documents": [
    { "doc_id": "LAND_RECORD", "label_hi": "जमाबंदी की नकल (छः माह से अधिक पुरानी नहीं)",
      "icon": "document", "where_to_get_hi": "तहसील (राजस्व विभाग)",
      "sample_image": "assets/docs/land_record.svg" }
  ],

  "apply_via": ["emitra", "rajkisan_portal"],

  "response_templates_hi": {
    "eligible":     "आप {{scheme_name_hi}} के लिए पात्र लग रहे हैं। {{benefit_text}}। नज़दीकी ई-मित्र पर जाकर पुष्टि करें।",
    "need_info":    "{{scheme_name_hi}} बताने के लिए मुझे {{missing}} जानना होगा।",
    "not_eligible": "{{reason_hi}} के कारण इस योजना में आप शायद पात्र नहीं हैं।",
    "unknown":      "मेरे पास इसकी पक्की जानकारी नहीं है। नज़दीकी ई-मित्र से पूछें।"
  }
}
```

**Two fields are new relative to the reference dataset:** `source_type` and `subsidy_rule`. Everything else is unchanged, which is the point — the same engine reads both datasets.

---

## §2 — Verification protocol

### 2.1 What counts as a source

| Rank | Source | Use |
|---|---|---|
| 1 | The scheme's own page on `rajkisan.rajasthan.gov.in` or `agriculture.rajasthan.gov.in` | Primary |
| 2 | A departmental circular PDF on a `.rajasthan.gov.in` domain | Primary, with `source_type` |
| 3 | `jansoochna.rajasthan.gov.in` scheme entry | Secondary corroboration |
| 4 | A central government portal (`pmkisan.gov.in`, `pmfby.gov.in`, `pmkusum.mnre.gov.in`) for centrally-run schemes | Primary for those |
| — | Blogs, news sites, aggregators, coaching sites, `hamaripanchayat.com`, YouTube | **Never.** Not even for corroboration. |
| — | The three `Research_*` documents | **Never as a value.** Only to locate a candidate URL to go and open yourself. |

If a figure appears only in rank 4-and-below, it does not go in the dataset. It goes in `docs/NEEDS_VERIFICATION.md`.

### 2.2 The four-question test, per field

Before writing any value, answer:

1. **Which URL did I open, and on what date?** → `source_url`, `last_verified`
2. **Is this a single fixed figure, or does it vary?** → varies means `amount_inr: null` + `rate_policy`
3. **If it varies, by what?** → category, material, unit count, district, year. That dimension becomes a `subsidy_rule` selector or a documented reason for staying null.
4. **Could this be stale?** → published rates change with the financial year. Note the FY on the page in `benefit.note` if one is stated.

### 2.3 When the source is a scanned raster PDF

This is the thesis, so handle it deliberately rather than working around it.

- Set `source_type: "scanned_pdf"`.
- Save the PDF into `docs/audit-evidence/source-pdfs/` with the URL and download date in a sidecar `.txt`.
- Transcribe the rule text **by hand** into `subsidy_rule.source_quote_hi` — exactly as printed, including the bureaucratic phrasing. Do not clean it up. The ugliness of the original is evidence.
- Add the record to a `docs/SCANNED_SOURCES.md` list with page number and a one-line note.

**Count these.** "N of our 15 records were transcribed by hand from raster images because the Department publishes them in a form no software can read" is a stronger slide than any adjective, and it is only available to you if you count as you go.

### 2.4 Re-verifying the six inherited records

`RJ_TARBANDI`, `RJ_PMKISAN`, `RJ_PMFBY`, `RJ_DRIP_SPRINKLER`, `RJ_FARM_POND`, `RJ_KCC` exist in the reference dataset with `last_verified: 2026-08-14`. They are inside their 90-day window, but they were verified for a different submission and the agriculture-facing fields matter more here.

For each: open the `source_url`, confirm it still resolves and still describes the same scheme, re-check every eligibility threshold and every figure, update `last_verified` and bump `dataset_version`. If the URL has moved, record the old one in `benefit.note` and the new one in `source_url`. **If a threshold has changed since 14 Aug, that is a finding worth a sentence in the deck** — it demonstrates exactly why a verification interval and a diffable registry matter.

---

## §3 — `subsidy_rule` schema ⭐

The differentiator. Read this before the K4 session.

```jsonc
"subsidy_rule": {
  "rule_id": "PIPELINE_HDPE_PVC",

  // Optional. If present and unsatisfied, explain() returns status NOT_APPLICABLE
  // with the reason — e.g. the pipeline rule applies only at ≥63 mm diameter.
  "applies_when": [ {"slot": "pipe_diameter_mm", "op": "gte", "value": 63} ],

  // Every slot named anywhere below must appear here AND in data/slots.json.
  "inputs": [
    {"slot": "pipe_material", "type": "single", "options": ["hdpe", "pvc"], "required": true,
     "prompt_hi": "पाइप किस चीज़ का है?"},
    {"slot": "pipe_metres", "type": "number", "unit_hi": "मीटर", "required": true,
     "prompt_hi": "कितने मीटर पाइप चाहिए?"},
    {"slot": "quoted_cost_inr", "type": "number", "unit_hi": "रुपये", "required": false,
     "prompt_hi": "डीलर का कोटेशन कितने का है? (न हो तो छोड़ दें)"}
  ],

  // Applied to the citizen's stated units BEFORE any term uses them.
  "unit_caps": {
    "pipe_metres": {"max": 800, "label_hi": "अधिकतम 800 मीटर तक अनुदान देय"}
  },

  "terms": [
    {
      "id": "pct",
      "label_hi": "इकाई लागत का 50%",
      "type": "percent_of_cost",
      "percent": 50,
      // OR, where the percentage varies by farmer category:
      //   "percent_by": {"small_marginal": 70, "general": 50},
      //   "percent_selector_slot": "farmer_category",
      "cost_basis": {"kind": "citizen_quotation", "slot": "quoted_cost_inr"}
      // The ONLY other legal cost_basis is
      //   {"kind": "rule_unit_cost", "unit_cost_inr": <n>, "unit_slot": "<slot>"}
      // and it may be used ONLY when the Department publishes a unit cost.
      // If it doesn't, the cost comes from the citizen or the term stays null.
    },
    {
      "id": "cap",
      "label_hi": "अधिकतम दर सीमा",
      "type": "per_unit_cap",
      "rates": {"hdpe": 50, "pvc": 35},
      "rate_selector_slot": "pipe_material",
      "unit_slot": "pipe_metres",
      "unit_hi": "प्रति मीटर"
    }
  ],

  "combine": "min",                  // min | max | sum
  "on_missing_input": "report_computable_terms_only",

  "source_quote_hi": "63 मि.मी. या इससे अधिक व्यास के पाइप खरीदने पर इकाई लागत का 50 प्रतिशत या अधिकतम रू. 50/प्रति मीटर एचडीपीई पाईप पर या रू. 35/प्रति मीटर पीवीसी पाईप पर, जो भी आनुपातिक रुप से कम हो, अनुदान देय है।",
  "source_url": "https://rajkisan.rajasthan.gov.in/WebsiteNew/pipeline.html",
  "source_page_note": "As printed on the scheme page; transcribe verbatim including spelling as published.",
  "last_verified": "2026-08-22"
}
```

### 3.1 Term types

| `type` | Computes | Required fields |
|---|---|---|
| `percent_of_cost` | percentage of a cost basis | `percent` or (`percent_by` + `percent_selector_slot`), `cost_basis` |
| `per_unit_cap` | rate × units, semantically a **ceiling** | `rates`+`rate_selector_slot` or `rate`, `unit_slot` |
| `per_unit_rate` | rate × units, semantically an **entitlement** (use with `combine: "sum"`) | as above |
| `flat_cap` | a fixed published ceiling | `amount_inr` |

### 3.2 The cost-basis rule — read this twice

**The Department frequently does not publish a unit cost.** It publishes a percentage *of the farmer's actual cost*, and a per-unit ceiling. That means the percentage term is **not computable from the dataset alone**.

There are exactly two legitimate ways to get a cost, and no third:

1. **The citizen supplies it** — `cost_basis: {kind: "citizen_quotation", slot: "quoted_cost_inr"}`. The dealer quotation is a real document they will need for the application anyway, so asking for it is useful, not a burden.
2. **The Department publishes it** — `cost_basis: {kind: "rule_unit_cost", unit_cost_inr: <n>, unit_slot: "<slot>"}`, and `<n>` is transcribed from the source with the quote in `source_quote_hi`.

**Anything else is fabrication.** If the cost is unknown, the percent term returns `null`, `status` becomes `PARTIAL`, and the card says: *"आपको अधिकतम ₹30,000 मिल सकता है। सही राशि बताने के लिए डीलर का कोटेशन चाहिए।"*

This behaviour is a feature, not a shortfall, and it should be demonstrated on video. It is the difference between a system that computes and a system that guesses, and a judge who probes the flagship feature will probe exactly here.

### 3.3 Worked reference — the pipeline case

Inputs: `pipe_material: "hdpe"`, `pipe_metres: 600`, `quoted_cost_inr: 90000`, `pipe_diameter_mm: 75`.

```
आपने बताया:  HDPE पाइप · 600 मीटर · कोटेशन ₹90,000

शर्त 1 — इकाई लागत का 50%
  ₹90,000 का 50%  =  ₹45,000

शर्त 2 — अधिकतम दर सीमा
  HDPE के लिए ₹50 प्रति मीटर
  ₹50 × 600 मीटर  =  ₹30,000

नियम कहता है: जो कम हो, वही देय।
आपको मिलेगा: ₹30,000   ← शर्त 2 (अधिकतम दर सीमा) लागू हुई

स्रोत: rajkisan.rajasthan.gov.in/WebsiteNew/pipeline.html · जाँचा गया: 2026-08-22
"63 मि.मी. या इससे अधिक व्यास के पाइप खरीदने पर …"
```

Same inputs **without** the quotation:

```
शर्त 1 — इकाई लागत का 50%
  ⚠ डीलर का कोटेशन चाहिए                    [कोटेशन दर्ज करें]

शर्त 2 — अधिकतम दर सीमा
  ₹50 × 600 मीटर  =  ₹30,000

आपको अधिकतम ₹30,000 तक मिल सकता है।
सही राशि कोटेशन के बिना नहीं बताई जा सकती।
```

Provenance of every number in the first case:

| Number | `from` |
|---|---|
| 50 (percent) | `rule` → `subsidy_rule.terms[0].percent` |
| 90000 | `input` → `quoted_cost_inr` |
| 45000 | `derived` → `percent_of(50, 90000)` |
| 50 (rate) | `rule` → `subsidy_rule.terms[1].rates.hdpe` |
| 600 | `input` → `pipe_metres` |
| 30000 | `derived` → `multiply(50, 600)` |
| 30000 (result) | `derived` → `min(45000, 30000)` |

`assertDerivedFromSourced` re-computes every `derived` row and re-resolves every `rule` path. Nothing reaches the screen unverified.

---

## §4 — `rate_policy` vocabulary

Use one of these exact strings. Add a new one only if none fits, and add it to this list in the same commit.

| Value | Meaning |
|---|---|
| `REVISED_PERIODICALLY_DO_NOT_STATE` | The figure changes on a government cycle; stating a fixed number risks going stale |
| `VARIES_BY_CATEGORY_DO_NOT_COLLAPSE` | Differs by farmer category (small/marginal vs general, SC/ST) |
| `VARIES_BY_MATERIAL_DO_NOT_COLLAPSE` | Differs by material or equipment type |
| `VARIES_BY_DISTRICT_DO_NOT_COLLAPSE` | Differs by district or agro-climatic zone |
| `COMPUTED_SEE_SUBSIDY_RULE` | Not a scalar at all; the rule is encoded in `subsidy_rule` ⭐ |
| `CENTRAL_SCHEME_RATE_SEE_SOURCE` | Set by a central ministry; we cite rather than restate |
| `UNVERIFIED_PENDING_SOURCE` | We could not verify it; also listed in `docs/NEEDS_VERIFICATION.md` |

`COMPUTED_SEE_SUBSIDY_RULE` is the one that should appear most often in this dataset. That is the whole argument.

---

## §5 — The 15-record worksheet

Print this. Tick as you go. **Three per day, days 2–6.** Run `node tools/validate-data.mjs --id RJ_X` after each.

| # | `scheme_id` | Candidate source to verify | `subsidy_rule`? | Status |
|---|---|---|---|---|
| 1 | `RJ_IRRIGATION_PIPELINE` ⭐ | `rajkisan.rajasthan.gov.in/WebsiteNew/pipeline.html` | **Yes — build this one first** | ☐ |
| 2 | `RJ_TARBANDI` ⭐ | `rajkisan.rajasthan.gov.in/WebsiteNew/fieldfencing.html` | **Yes** — %, cap, and a metre limit | ☐ re-verify |
| 3 | `RJ_DRIP_SPRINKLER` | `rajkisan.rajasthan.gov.in/WebsiteNew/dripirrigation.html` | **Yes** — `percent_by` category | ☐ re-verify |
| 4 | `RJ_FARM_POND` | `rajkisan.rajasthan.gov.in/WebsiteNew/farmpound.html` | **Yes** — % + cap varying by lining type | ☐ re-verify |
| 5 | `RJ_DIGGI` | RajKisan scheme index → Diggi page | Likely | ☐ |
| 6 | `RJ_PMKUSUM` | `pmkusum.mnre.gov.in` + state page | Likely — % split centre/state | ☐ |
| 7 | `RJ_FARM_MACHINERY` | RajKisan farm machinery page | **Yes** — `rates` by machinery type | ☐ |
| 8 | `RJ_CUSTOM_HIRING_CENTRE` | RajKisan CHC page | Likely | ☐ |
| 9 | `RJ_PMFBY` | `pmfby.gov.in` + state notification | No — premium %, not a subsidy | ☐ re-verify |
| 10 | `RJ_KRISHAK_SATHI` | Agriculture dept scheme page | No — schedule of fixed amounts | ☐ |
| 11 | `RJ_PMKISAN` | `pmkisan.gov.in` | No — fixed instalment | ☐ re-verify |
| 12 | `RJ_SOIL_HEALTH_CARD` | `soilhealth.dac.gov.in` + state page | No — service, not cash | ☐ |
| 13 | `RJ_ORGANIC_BIOFERT` | RajKisan organic farming page | Possibly | ☐ |
| 14 | `RJ_GREENHOUSE_SHADENET` | RajKisan horticulture page | **Yes** — per-m² rates | ☐ |
| 15 | `RJ_KCC` | Bank/NABARD + state page | No | ☐ re-verify |

**Target: at least 6 records carrying a `subsidy_rule`.** One is a demo; six is a system. The registry API and the embed widget both get materially more convincing at six.

The candidate URLs above are *starting points located from background reading*, not verified sources. Open each one. If it 404s or has moved, find the current page from the site's own navigation and record what you found — a dead official URL is itself a finding for the ledger.

---

## §6 — `docs/NEEDS_VERIFICATION.md`

Every gap goes here, in this shape, on the day you hit it:

```markdown
## RJ_FARM_MACHINERY — subsidy rate for rotavator
- **What's missing:** per-unit ceiling for rotavators under the state machinery subsidy
- **Where I looked:** <url>, <url>, opened 2026-08-24
- **What I found:** the page links a circular PDF; the PDF is a scanned raster and the
  relevant table is illegible at the resolution published
- **Current record state:** `amount_inr: null`, `rate_policy: "UNVERIFIED_PENDING_SOURCE"`,
  no `subsidy_rule`
- **How a citizen can still act:** document checklist and e-Mitra referral are unaffected
```

**Ship this file.** It is not an admission of incompleteness; it is the artefact that proves the discipline is real rather than asserted. A submission with a populated `NEEDS_VERIFICATION.md` is more credible than one with a suspiciously complete dataset, and it converts the Department's own publishing failures into documented evidence.
