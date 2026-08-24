# functions/

Source for S2's scheduled deletion job (`deleteExpiredUploads` in `index.js`). **Written, not deployed.**

## Why not deployed

Deploying is a real, live change to this project's Firebase infrastructure, and `onSchedule` specifically requires the Blaze (pay-as-you-go) plan — Cloud Scheduler, which powers it, isn't available on the free Spark plan. Whether to enable Blaze billing is a decision for whoever owns the project, not something to flip from a coding session. This directory exists so the retention policy stated in `services/upload-demo.html`'s consent screen is backed by real, reviewable code today, even before it's switched on.

## What it does

Runs once every 24 hours. Lists everything under `uploads/` in Cloud Storage, deletes any file older than `RETENTION_DAYS` (30, matching the consent screen — the two must be changed together), and records each deletion as an `auto_deleted` event on the same append-only audit trail (`uploads_audit/{uid}/events`) that the upload path itself writes to.

## To deploy, when ready

```bash
firebase deploy --only functions
```

Requires: Blaze plan enabled on the `kisan-dwaar-2026` project, and `npm install` run once inside this directory (Firebase's deploy step does this automatically, but `firebase deploy --only functions` will fail fast with a clear billing error if Blaze isn't enabled — that failure is expected and not a bug in this code).

## Why this doesn't need a storage.rules or firestore.rules change

This job runs server-side with the Firebase Admin SDK, which bypasses both rules files entirely by design — they govern what a citizen's browser can do, not this trusted, scheduled process. No rule needs to open a path for it.
