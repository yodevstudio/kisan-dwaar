// S3: anonymous analytics. Full spec in docs/ANALYTICS.md — this is that
// spec's implementation, and the two must stay in sync.
//
// Never imported by eligibility.js / assemble.js / explainer.js / router.js
// / normalise.js — those stay pure. js/app.js calls the track*() functions
// below at the moments an event actually happens, but every call is
// fire-and-forget and swallows its own failure (see record() below), so
// a citizen's flow is never slowed or broken by an analytics outage —
// the same discipline CONTEXT.md constraint 1 requires of every services
// call, applied here to a call made from the orchestration layer rather
// than from a services/ page.

import { app } from './firebase-app.js';
import { getFirestore, doc, setDoc, increment } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const db = getFirestore(app);

// Generated fresh per tab, used only to dedupe an accidental double-fire
// of the same event within one page view. Never sent in any write, never
// stored anywhere, discarded on tab close — see docs/ANALYTICS.md §2 for
// why this is not the identifier it might look like.
const sessionId = crypto.randomUUID();
const dedupeFired = new Set();

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

// A discriminator can be a path ("/", "/index.html") or anything else a
// caller passes — "/" corrupts a Firestore doc ID built by concatenation,
// since the SDK's doc() parses '/' as a path separator even inside a
// single segment string. Found live: trackPageView(location.pathname)
// threw "Document references must have an even number of segments"
// before this existed.
function sanitizeForDocId(value) {
  const cleaned = String(value).replace(/\//g, '_');
  return cleaned === '' ? '_root_' : cleaned;
}

function counterDocId(eventType, discriminator, date) {
  return `${eventType}__${sanitizeForDocId(discriminator)}__${date}`;
}

async function record(eventType, discriminator, dedupeKey) {
  if (dedupeKey) {
    if (dedupeFired.has(dedupeKey)) return;
    dedupeFired.add(dedupeKey);
  }
  const date = todayKey();
  const ref = doc(db, 'analytics_counters', counterDocId(eventType, discriminator, date));
  try {
    await setDoc(ref, { event_type: eventType, discriminator, date, count: increment(1) }, { merge: true });
  } catch (err) {
    // Never surfaced to the citizen and never retried — a missed count is
    // an acceptable loss; a blocked or slowed discovery flow is not.
    console.warn('telemetry: event not recorded (non-fatal):', eventType, discriminator, err);
  }
}

export function trackPageView(path) {
  return record('page_view', path, `page_view:${path}:${sessionId}`);
}

export function trackQuestionAnswered(slot) {
  return record('question_answered', slot);
}

export function trackVerdictIssued(verdictType) {
  return record('verdict_issued', verdictType);
}

export function trackSchemeSurfaced(schemeId) {
  return record('scheme_surfaced', schemeId);
}

export function trackFeedbackVote(direction, reasonChip) {
  return record('feedback_vote', `${direction}:${reasonChip}`);
}

// T8: the sixth counter — added for the officer dashboard's "Hindi vs
// English" usage split, which docs/ANALYTICS.md §2's original five never
// covered. Same shape as every other counter here: a discriminator
// ('hi'/'en') and nothing else, deduped per tab per page so a language
// toggle mid-page doesn't recount the same page view. See docs/ANALYTICS.md
// §2 (updated alongside this) for the formal entry.
export function trackLanguageActive(lang) {
  return record('language_active', lang, `language_active:${lang}:${sessionId}`);
}
