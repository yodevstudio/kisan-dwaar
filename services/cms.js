// S5: CMS data layer. Only ever reached through js/registry-source.js's
// attempt-then-3s-timeout-then-fallback (never a static import, never
// directly from js/eligibility.js, assemble.js, explainer.js, router.js or
// normalise.js), so this module existing, failing, or being unreachable
// can never stop the static core from working (CONTEXT.md constraint 1) —
// data/schemes.json, a git-tracked file, is always the fallback.
//
// T4: "publish" now means "the live registry a citizen's next page load
// can actually see" (loadPublishedRegistry, read publicly per
// firestore.rules), not only "finalised inside the CMS." A human still
// has to copy the emitted JSON into data/schemes.json and commit it for
// the committed-file fallback itself to reflect a change — this module
// still has no path that touches the git repository, because a browser
// tool can't have one.

import { app } from './firebase-app.js';
import { getSession } from './session.js';
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp,
  collection, addDoc, getDocs, orderBy, query,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const db = getFirestore(app);

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('cms: no active session — S5 is auth-gated');
  return session;
}

export async function loadDraft(schemeId) {
  const snap = await getDoc(doc(db, 'cms_drafts', schemeId));
  return snap.exists() ? snap.data().data : null;
}

// T8: every open draft, for the officer dashboard's "pending CMS drafts"
// count — this is why that section needs sign-in: cms_drafts has no
// public-read rule (firestore.rules), unlike cms_published/analytics_
// counters. Requires a session for the same reason every other read in
// this file that touches drafts does.
export async function listDrafts() {
  requireSession();
  const snap = await getDocs(collection(db, 'cms_drafts'));
  return snap.docs.map((d) => ({ scheme_id: d.id, ...d.data() }));
}

export async function saveDraft(schemeId, schemeData) {
  const session = requireSession();
  await setDoc(doc(db, 'cms_drafts', schemeId), {
    data: schemeData,
    updated_by: session.uid,
    updated_at: serverTimestamp(),
  });
}

export async function loadPublished(schemeId) {
  const snap = await getDoc(doc(db, 'cms_published', schemeId));
  return snap.exists() ? snap.data().data : null;
}

// T4: every published scheme in one read — this is the "registry" the
// citizen-facing boot sequence (js/registry-source.js) races against a
// 3-second timeout. Public read per firestore.rules; write stays
// authenticated-only, so this never needs a session.
export async function loadPublishedRegistry() {
  const snap = await getDocs(collection(db, 'cms_published'));
  return snap.docs.map((d) => d.data().data);
}

// dataset_version is the one field publish() never trusts from the
// caller — an officer's typed value in the draft is a placeholder that
// satisfies validate-data.mjs's format check, but the real, order-
// preserving value is always computed here from whatever's currently
// live, the same YYYY.MM.DD-N convention tools/build-registry.mjs uses.
function nextDatasetVersion(previous) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const match = typeof previous === 'string' && previous.match(/^(\d{4}\.\d{2}\.\d{2})-(\d+)$/);
  if (match && match[1] === today) return `${today}-${parseInt(match[2], 10) + 1}`;
  return `${today}-1`;
}

// Writes the "current" pointer doc and appends an immutable version, with
// the prior snapshot alongside the new one so the CMS can render a
// field-by-field diff without a second fetch — the pointer is what the
// citizen-facing boot sequence reads; the version history is what answers
// "who published what, when, and what changed" later. Returns the
// published record (with its real dataset_version) so the caller can
// reflect it back into the open draft immediately.
export async function publish(schemeId, schemeData) {
  const session = requireSession();
  const previous = await loadPublished(schemeId);
  const published = { ...schemeData, dataset_version: nextDatasetVersion(previous && previous.dataset_version) };
  const publishedAt = serverTimestamp();
  await setDoc(doc(db, 'cms_published', schemeId), {
    data: published,
    published_by: session.uid,
    published_at: publishedAt,
  });
  await addDoc(collection(db, 'cms_published', schemeId, 'versions'), {
    data: published,
    previous_data: previous || null,
    published_by: session.uid,
    published_at: publishedAt,
  });
  return published;
}

export async function listVersions(schemeId) {
  const q = query(collection(db, 'cms_published', schemeId, 'versions'), orderBy('published_at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
