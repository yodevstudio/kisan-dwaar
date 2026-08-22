// S1: provider-agnostic session module. S2/S4/S5/K20 depend on this
// shape — login()/logout()/getSession()/onSessionChange() — not on
// Firebase directly, so a future Jan Aadhaar-backed provider (see
// janaadhaar-sim.js, the WebCrypto adapter kept ready while Z5's sandbox
// credential request is still pending) can replace the implementation
// below without any caller changing. Google Sign-In is today's live,
// demonstrable OIDC provider, framed as a standards-compliant OIDC login,
// never as "sign in with your consumer Google account."
//
// This module is loaded only by services/ and pages/ code, never by
// js/app.js or index.html — the static core's read path has no import of
// this file, so eligibility, the explainer and the registry all work
// identically whether a citizen is logged in or not (CONTEXT.md
// constraint 1). The Firebase SDK is loaded from its own CDN as ES
// modules, since the static core's "no CDN" rule is scoped to the static
// core, not the services layer, and this project has no bundler anywhere.
//
// Minimum PII, per CONTEXT.md constraint 5: only `uid` is kept. Google
// also hands back an email and display name; both are dropped here rather
// than carried into every caller "for convenience," since neither is a
// field a named deliverable (uploads, application status) actually needs.

import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Explicit rather than relying on the SDK default, so "session persists
// across a reload" is a stated decision here, not an accident of whatever
// Firebase currently defaults to.
const persistenceReady = setPersistence(auth, browserLocalPersistence);

const listeners = new Set();
let lastLoginError = null;

function toSession(user) {
  if (!user) return null;
  return { uid: user.uid, provider: 'google' };
}

onAuthStateChanged(auth, (user) => {
  const session = toSession(user);
  listeners.forEach((fn) => fn(session));
});

// signInWithRedirect, not signInWithPopup: this project's actual users are
// on mobile browsers, low-end Android and in-app browsers, all of which
// routinely block or mishandle popups — confirmed directly, not assumed:
// signInWithPopup threw auth/popup-blocked in testing. Redirect leaves the
// page and comes back to it, so it works wherever the browser can load a
// page at all. login() itself resolves only if the browser blocks the
// navigation outright; the normal path is the tab leaving and this
// promise never settling.
export async function login() {
  await persistenceReady;
  await signInWithRedirect(auth, new GoogleAuthProvider());
}

// Must be called once, early, on every page that uses login() — it's how
// the redirect flow's result (success or failure) is collected after the
// browser navigates back. onSessionChange's callback fires on success; a
// failure (e.g. the citizen closed the Google screen) is available from
// getLastLoginError() afterward, since there's no page left to reject a
// promise on by the time it's known.
const redirectResultReady = getRedirectResult(auth).catch((err) => {
  lastLoginError = err;
  return null;
});

export function getLastLoginError() {
  return lastLoginError;
}

export function whenRedirectHandled() {
  return redirectResultReady;
}

export async function logout() {
  await signOut(auth);
}

export function getSession() {
  return toSession(auth.currentUser);
}

// Calls back immediately with the current session, then again on every
// change (login, logout, token refresh does not change uid so does not
// re-fire). Returns an unsubscribe function.
export function onSessionChange(callback) {
  listeners.add(callback);
  callback(getSession());
  return () => listeners.delete(callback);
}
