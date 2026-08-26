# TEAM.md
### YoDevStudio — shipping discipline, demonstrated on two live repositories, not a headcount claim.

Ships in the repository at `docs/TEAM.md`, feeding iStart Parameter 5 (team ability and culture). Every claim below links to a public repository a judge can open directly — nothing here is asserted about a project that isn't linked, and nothing is linked that isn't public.

---

## The claim this document makes, and the one it doesn't

This is not a claim to a large team or a long roster. It is a narrower, checkable claim: **the two capabilities KISAN DWAAR depends on most — a real services-layer integration, and a deterministic rules engine with provenance discipline — have each already been shipped to a real release, by this team, before this submission.** A judge does not have to take KISAN DWAAR's own working demo as the only evidence of either; each capability has an independent, earlier repository proving it.

---

## ShauchMap — the services-layer capability

**[github.com/yodevstudio/shauchmap](https://github.com/yodevstudio/shauchmap)**

A Flutter/Firebase Android application, at release **v1.0.0**, with: continuous integration, an MIT licence, a security policy, a code of conduct, a contributing guide, and a changelog. Every one of those is a repository artifact a judge can open and read directly — not a claim made only in this document.

**Why it matters for this project specifically:** ShauchMap runs on **Firebase Auth and Firestore**, shipped to a tagged release, not a prototype branch. That is the exact stack KISAN DWAAR's services layer is built on (`services/session.js`, `services/cms.js`, `services/upload.js`, `services/telemetry.js`) — direct, verifiable evidence that this team can ship an authenticated, database-backed service to a real release, not evidence being asserted for the first time inside this submission.

A disciplined shipping process — versioned releases, a stated security policy, a contribution process for other people to build on — is itself the thing a procurement panel is evaluating under "team ability and culture." That process is visible in the repository's own history, independent of anything written here.

---

## VAANI — the rules-engine and provenance-discipline capability

**[github.com/yodevstudio/vaani](https://github.com/yodevstudio/vaani)**

A second, delivered instance of the same underlying pattern this project ships: a vernacular, deterministic scheme-discovery assistant for Rajasthan government schemes, built on a **different dataset** than KISAN DWAAR's agriculture registry, using the same engine shape and the same source-and-verification discipline `CONTEXT.md` and `docs/DPI.md` describe for this project.

**Why it matters for this project specifically:** `CONTEXT.md`'s own framing — *"this is the agriculture instance of an existing scheme-rules registry. Same engine, same provenance discipline, an agriculture dataset and a portal-shaped front end. Two applications of one piece of infrastructure"* — is not a claim made for the first time in this submission. VAANI is the first instance; KISAN DWAAR is the second. A judge can open VAANI directly and see the same shape applied to a different scheme domain, built before this challenge began.

*A specific note on accuracy, applied to this team's own prior work the same way `CONTEXT.md` constraint 3 applies to a scheme record:* this document does not restate VAANI's own repository description verbatim, since that description may not yet reflect the same "deterministic, no generative model" framing this project holds itself to — a judge should read VAANI's current repository description directly, not a paraphrase of it written here, and treat any characterisation of VAANI beyond "same engine shape, different dataset, delivered" as something to confirm against that repository rather than take from this file.

---

## What this means for KISAN DWAAR's own risk profile

Every capability this challenge's services layer required — an OIDC-framed login (`S1`), auth-gated per-user document storage (`S2`), and a rules engine with a provenance guard strong enough to throw on a corrupted figure (`js/explainer.js`'s `assertDerivedFromSourced`) — is a capability this team had already shipped, in one of these two repositories, before writing the first line of `kisan-dwaar`. The services layer built for this submission (`services/`) is an application of already-proven capability to a new domain, not a team learning Firebase Auth or a deterministic router for the first time under an eleven-day deadline.
