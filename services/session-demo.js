import { login, logout, onSessionChange, whenRedirectHandled, getLastLoginError } from './session.js';

const statusEl = document.getElementById('status');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

function setStatus(text) {
  statusEl.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'hi';
  p.textContent = text;
  statusEl.appendChild(p);
}

onSessionChange((session) => {
  if (session) {
    setStatus(`✅ लॉग-इन है — uid: ${session.uid}`);
    loginBtn.style.display = 'none';
    logoutBtn.style.display = '';
  } else {
    setStatus('लॉग-इन नहीं है।');
    loginBtn.style.display = '';
    logoutBtn.style.display = 'none';
  }
});

// login() uses signInWithRedirect — the page navigates away and comes
// back, so the result is collected here on load, not inside the click
// handler that started it.
whenRedirectHandled().then(() => {
  const err = getLastLoginError();
  if (err) setStatus(`लॉग-इन में समस्या: ${err.code || 'अज्ञात त्रुटि'}`);
});

loginBtn.addEventListener('click', () => {
  loginBtn.disabled = true;
  login();
});

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  await logout();
  logoutBtn.disabled = false;
});
