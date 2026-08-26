import { onSessionChange, login } from './session.js';
import { preflightCheck, uploadDocument } from './upload.js';
import { UPLOAD_RETENTION_DAYS, UPLOAD_MAX_FILE_BYTES, UPLOAD_ALLOWED_TYPES_HI } from '../js/policy.js';

const consentCheck = document.getElementById('consent-check');
const sessionStatusEl = document.getElementById('session-status');
const uploadAreaEl = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const preflightResultEl = document.getElementById('preflight-result');
const uploadBtn = document.getElementById('upload-btn');
const uploadResultEl = document.getElementById('upload-result');
const retentionLineEl = document.getElementById('retention-line');
const scanLineEl = document.getElementById('scan-line');
const fileHintLineEl = document.getElementById('file-hint-line');

const maxMb = Math.round(UPLOAD_MAX_FILE_BYTES / (1024 * 1024));
retentionLineEl.innerHTML = `<strong>प्रतिधारण अवधि:</strong> अपलोड की गई फ़ाइलें ${UPLOAD_RETENTION_DAYS} दिन बाद स्वतः हटा दी जाती हैं। (यह डिफ़ॉल्ट नीति है — असली तैनाती से पहले विभाग की वास्तविक नीति से पुष्टि करें।)`;
// T10: stated here, not only in services/upload.js's own comment — a
// citizen deciding whether to upload a real document should not have to
// read source code to learn this. Pre-flight (type/size/page-count) is
// real and runs before every upload; a virus scan is documented as a
// planned Cloud Storage trigger (see that file) but does not exist yet.
scanLineEl.innerHTML = '<strong>वायरस स्कैनिंग:</strong> अभी लागू नहीं है — डिज़ाइन में तय है, पर इस प्रोटोटाइप में बनाई नहीं गई। फ़ाइल की जाँच अभी सिर्फ़ प्रकार, आकार व पृष्ठ-संख्या तक सीमित है।';
fileHintLineEl.textContent = `फ़ाइल चुनें (${UPLOAD_ALLOWED_TYPES_HI}, अधिकतम ${maxMb}MB):`;

let currentSession = null;
let currentFile = null;
let currentPreflightOk = false;

function setText(el, text, className) {
  el.innerHTML = '';
  const p = document.createElement('p');
  p.className = className || 'hi';
  p.textContent = text;
  el.appendChild(p);
}

function refreshUploadGate() {
  // Consent, a real session, and a file that already passed pre-flight —
  // all three, or the button stays disabled. This is convenience only;
  // storage.rules is the actual gate, per services/upload.js's own header.
  uploadBtn.disabled = !(consentCheck.checked && currentSession && currentPreflightOk);
}

onSessionChange((session) => {
  currentSession = session;
  if (session) {
    setText(sessionStatusEl, `✅ लॉग-इन है — uid: ${session.uid}`);
  } else {
    sessionStatusEl.innerHTML = '';
    setText(sessionStatusEl, 'अपलोड के लिए पहले लॉग-इन करें।');
    const loginBtn = document.createElement('button');
    loginBtn.type = 'button';
    loginBtn.className = 'button hi';
    loginBtn.textContent = 'Google से लॉग-इन करें';
    loginBtn.addEventListener('click', () => login());
    sessionStatusEl.appendChild(loginBtn);
  }
  refreshUploadGate();
});

consentCheck.addEventListener('change', () => {
  uploadAreaEl.style.display = consentCheck.checked ? '' : 'none';
  refreshUploadGate();
});

fileInput.addEventListener('change', async () => {
  currentFile = fileInput.files[0] || null;
  currentPreflightOk = false;
  uploadResultEl.innerHTML = '';
  if (!currentFile) { preflightResultEl.innerHTML = ''; refreshUploadGate(); return; }

  const result = await preflightCheck(currentFile);
  preflightResultEl.innerHTML = '';
  if (result.ok) {
    const msg = result.needsLegibilityReview
      ? '✅ प्रकार व आकार ठीक है। स्पष्टता की जाँच अपलोड के बाद व्यक्ति द्वारा होगी।'
      : '✅ प्रकार व आकार ठीक है।';
    setText(preflightResultEl, msg, 'hi result-note');
    currentPreflightOk = true;
  } else {
    result.problems.forEach((p) => setText(preflightResultEl, `⚠ ${p.message_hi}`, 'hi term-warning'));
  }
  refreshUploadGate();
});

uploadBtn.addEventListener('click', async () => {
  uploadBtn.disabled = true;
  setText(uploadResultEl, 'अपलोड हो रहा है…');
  try {
    const { reference } = await uploadDocument('demo_doc', currentFile);
    setText(uploadResultEl, `✅ अपलोड सफल — संदर्भ: ${reference}`, 'hi result-line');
  } catch (err) {
    console.error('upload failed:', err);
    setText(uploadResultEl, `⚠ अपलोड विफल: ${err.code || err.message}`, 'hi term-warning');
  } finally {
    refreshUploadGate();
  }
});
