// K20/S3: general portal feedback, same discipline as the per-answer
// widget in js/app.js — thumbs plus a reason chip, no free-text field
// anywhere, so a citizen can never type an identifier into an analytics
// event by accident. Loaded dynamically, not statically — if telemetry
// or its Firebase import is unreachable, this page still renders; only
// the widget silently declines to record anything (see track() below).
import { resolvePath } from '../../js/paths.js';

const REASONS = {
  up: [
    { value: 'easy_to_use', label_hi: 'इस्तेमाल करना आसान लगा' },
    { value: 'useful_info', label_hi: 'जानकारी उपयोगी लगी' },
    { value: 'fast', label_hi: 'जल्दी जवाब मिला' },
  ],
  down: [
    { value: 'confusing', label_hi: 'समझने में मुश्किल हुई' },
    { value: 'missing_scheme', label_hi: 'जो योजना चाहिए थी वह नहीं मिली' },
    { value: 'other_issue', label_hi: 'कोई और समस्या' },
  ],
};

let telemetryModule = null;
const telemetryReady = import('../../services/telemetry.js')
  .then((m) => { telemetryModule = m; })
  .catch((err) => console.warn('feedback page: telemetry unavailable (non-fatal):', err));

function track(direction, reason) {
  if (telemetryModule) telemetryModule.trackFeedbackVote(direction, reason);
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function renderWidget() {
  const host = document.getElementById('feedback-widget');
  const promptRow = el('div', 'feedback-prompt hi', 'क्या यह पोर्टल आपके लिए मददगार रहा?');
  const thumbsRow = el('div', 'chips');
  host.appendChild(promptRow);
  host.appendChild(thumbsRow);

  function showReasons(direction) {
    thumbsRow.remove();
    promptRow.textContent = direction === 'up' ? 'क्या अच्छा लगा?' : 'क्या समस्या हुई?';
    const reasonsRow = el('div', 'chips');
    REASONS[direction].forEach((reason) => {
      const btn = el('button', 'chip hi', reason.label_hi);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        reasonsRow.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        track(direction, reason.value);
        promptRow.textContent = 'धन्यवाद!';
        reasonsRow.remove();
      });
      reasonsRow.appendChild(btn);
    });
    host.appendChild(reasonsRow);
  }

  const upBtn = el('button', 'chip hi', '👍');
  const downBtn = el('button', 'chip hi', '👎');
  upBtn.type = 'button';
  downBtn.type = 'button';
  upBtn.addEventListener('click', () => showReasons('up'));
  downBtn.addEventListener('click', () => showReasons('down'));
  thumbsRow.appendChild(upBtn);
  thumbsRow.appendChild(downBtn);
}

renderWidget();

// Page view for this page too — same as every other static-core page.
telemetryReady.then(() => { if (telemetryModule) telemetryModule.trackPageView(location.pathname); });
