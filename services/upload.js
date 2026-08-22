// S2: document upload. Everything in this file is optional and
// degradable by construction — it is never imported by js/app.js or
// index.html, so the document checklist (rendered straight from
// scheme.documents in data/schemes.json) prints identically whether this
// module, Firebase Storage, or the network itself is entirely unreachable
// (CONTEXT.md constraint 1, S2's own gate: "kill the service — the
// checklist still prints").
//
// The pre-flight checker below is a client-side convenience — it saves a
// citizen on a slow connection from a failed round trip. It is NOT the
// security boundary. storage.rules enforces auth, per-user path, type and
// size independently of this file, so a client that skips this checker
// entirely (or is hostile) still can't write past what the rules allow.

import { app } from './firebase-app.js';
import { getSession } from './session.js';
import { getStorage, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const storage = getStorage(app);
const db = getFirestore(app);

// Mirrors storage.rules' own limits exactly — both need to agree, since a
// pre-flight pass that the rules then reject would be a confusing failure
// mode right after telling the citizen everything looked fine.
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — a default; see K12/D10 for the operator-facing policy call
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_PDF_PAGES = 10;

// A page count without a PDF parser library (the "no bundler, no
// dependency" story applies to this file too, since it ships to the
// browser the same way the static core does). PDF page objects declare
// themselves as "/Type /Page" — "/Type /Pages" (the page-tree node, not a
// page) is excluded by requiring a non-"s" character right after. Good
// enough to catch a citizen who tries to upload an entire land-record
// bundle instead of one page; not a substitute for a real parser.
async function countPdfPages(file) {
  const buf = await file.arrayBuffer();
  const text = new TextDecoder('latin1').decode(buf);
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : null; // null = couldn't determine, treated as "don't know", never as zero
}

// Never guesses "legible" or "illegible" — that judgement needs a real
// image-quality model this project doesn't have, and a fabricated
// automated pass would be exactly the kind of unverified claim CONTEXT.md
// rules out elsewhere. Every image is flagged for a human glance instead.
export async function preflightCheck(file) {
  const problems = [];

  if (!ALLOWED_TYPES.includes(file.type)) {
    problems.push({ code: 'type', message_hi: 'केवल JPG, PNG या PDF फ़ाइल स्वीकार की जाती है।' });
  }
  if (file.size > MAX_FILE_BYTES) {
    problems.push({ code: 'size', message_hi: `फ़ाइल का आकार ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB से कम होना चाहिए।` });
  }
  if (file.type === 'application/pdf') {
    const pages = await countPdfPages(file);
    if (pages !== null && pages > MAX_PDF_PAGES) {
      problems.push({ code: 'pages', message_hi: `PDF अधिकतम ${MAX_PDF_PAGES} पृष्ठ तक ही स्वीकार किया जाता है।` });
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    needsLegibilityReview: file.type.startsWith('image/'),
  };
}

// Virus-scan hook (documented, not built — no scanning service is
// available in this environment to wire up honestly): the intended design
// is a Cloud Storage "on finalize" trigger that reads the just-written
// object at uploads/{uid}/{docId}/{fileName}, scans it, and either leaves
// it in place (clean) or deletes it and writes a flagged event to
// uploads_audit — never a synchronous client-side scan, since no
// meaningful virus scan can run in-browser before the bytes ever leave
// the device.

export async function uploadDocument(docId, file) {
  const session = getSession();
  if (!session) throw new Error('uploadDocument: no active session — S2 is auth-gated');

  const preflight = await preflightCheck(file);
  if (!preflight.ok) {
    throw new Error('uploadDocument: file failed pre-flight: ' + preflight.problems.map((p) => p.code).join(','));
  }

  const path = `uploads/${session.uid}/${docId}/${file.name}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });

  // Append-only audit trail — firestore.rules refuses update/delete on
  // this collection even for the document's own owner.
  await addDoc(collection(db, 'uploads_audit', session.uid, 'events'), {
    uid: session.uid,
    docId,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    uploadedAt: serverTimestamp(),
  });

  return { path };
}
