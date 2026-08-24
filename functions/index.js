// S2: scheduled deletion of expired uploads. Source only — not deployed
// (see functions/README.md for why and what deploying would require).
//
// This is server-side, so it runs with the Admin SDK, which bypasses
// storage.rules/firestore.rules entirely by design — those rules govern
// citizen clients, not this job. That's the correct split: rules keep a
// citizen from reading/deleting another citizen's file; this job is the
// one trusted process allowed to delete on schedule regardless of owner.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

// Must match the interval stated in services/upload-demo.html's consent
// copy — that copy is the citizen-facing promise; this is what keeps it.
// Change both together, in the same commit, or the stated policy and the
// actual behaviour drift apart.
const RETENTION_DAYS = 30;

exports.deleteExpiredUploads = onSchedule('every 24 hours', async () => {
  const bucket = getStorage().bucket();
  const db = getFirestore();
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const [files] = await bucket.getFiles({ prefix: 'uploads/' });

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const createdMs = new Date(metadata.timeCreated).getTime();
    if (createdMs >= cutoffMs) continue;

    await file.delete();

    // uploads/{uid}/{docId}/{fileName} — recorded on the same append-only
    // audit trail S2's upload path writes to, so "what happened to this
    // file and when" is answerable from one place for upload AND deletion.
    const [, uid, , fileName] = file.name.split('/');
    if (!uid) continue;
    await db.collection('uploads_audit').doc(uid).collection('events').add({
      uid,
      event: 'auto_deleted',
      fileName: fileName || file.name,
      deletedAt: new Date(),
      reason: `retention period (${RETENTION_DAYS} days) elapsed`,
    });
  }
});
