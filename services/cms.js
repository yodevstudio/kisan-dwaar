// S5: CMS data layer. Never imported by js/app.js or index.html — the
// static core reads data/schemes.json (a git-tracked file) and never
// Firestore, so this module existing, failing, or being unreachable can
// never affect the citizen-facing read path (CONTEXT.md constraint 1).
// "Publish" here means "finalised inside the CMS, with a version history
// entry" — not "live to citizens." Going live is still a human copying
// the emitted JSON into data/schemes.json and committing it; this module
// has no path that touches the git repository, because a browser tool
// can't have one.

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

// Writes the "current" pointer doc and appends an immutable version —
// the pointer is what a human would copy into data/schemes.json; the
// version history is what answers "who published what, when" later.
export async function publish(schemeId, schemeData) {
  const session = requireSession();
  const publishedAt = serverTimestamp();
  await setDoc(doc(db, 'cms_published', schemeId), {
    data: schemeData,
    published_by: session.uid,
    published_at: publishedAt,
  });
  await addDoc(collection(db, 'cms_published', schemeId, 'versions'), {
    data: schemeData,
    published_by: session.uid,
    published_at: publishedAt,
  });
}

export async function listVersions(schemeId) {
  const q = query(collection(db, 'cms_published', schemeId, 'versions'), orderBy('published_at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
