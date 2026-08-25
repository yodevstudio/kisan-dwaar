// K20/S3: general portal feedback, same discipline as the per-answer
// widget in js/app.js — thumbs plus a reason chip, no free-text field
// anywhere, so a citizen can never type an identifier into an analytics
// event by accident. Loaded dynamically, not statically — if telemetry
// or its Firebase import is unreachable, this page still renders; only
// the widget silently declines to record anything (see track() below).
import { resolvePath } from '../../js/paths.js';
import { getLang, t } from '../../js/i18n.js';

const REASONS = {
  up: [
    { value: 'easy_to_use', key: 'feedback.reason.easy_to_use' },
    { value: 'useful_info', key: 'feedback.reason.useful_info' },
    { value: 'fast', key: 'feedback.reason.fast' },
  ],
  down: [
    { value: 'confusing', key: 'feedback.reason.confusing' },
    { value: 'missing_scheme', key: 'feedback.reason.missing_scheme' },
    { value: 'other_issue', key: 'feedback.reason.other_issue' },
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

function langClass(base) {
  return getLang() === 'hi' ? `${base} hi` : base;
}

function renderWidget() {
  const host = document.getElementById('feedback-widget');
  const render = () => {
    host.innerHTML = '';
    const promptRow = el('div', langClass('feedback-prompt'), t('feedback.prompt'));
    const thumbsRow = el('div', 'chips');
    host.appendChild(promptRow);
    host.appendChild(thumbsRow);

    function showReasons(direction) {
      thumbsRow.remove();
      promptRow.textContent = direction === 'up' ? t('feedback.prompt_up') : t('feedback.prompt_down');
      const reasonsRow = el('div', 'chips');
      REASONS[direction].forEach((reason) => {
        const btn = el('button', langClass('chip'), t(reason.key));
        btn.type = 'button';
        btn.addEventListener('click', () => {
          reasonsRow.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          track(direction, reason.value);
          promptRow.textContent = t('chat.thanks');
          reasonsRow.remove();
        });
        reasonsRow.appendChild(btn);
      });
      host.appendChild(reasonsRow);
    }

    const upBtn = el('button', langClass('chip'), '👍');
    const downBtn = el('button', langClass('chip'), '👎');
    upBtn.type = 'button';
    downBtn.type = 'button';
    upBtn.addEventListener('click', () => showReasons('up'));
    downBtn.addEventListener('click', () => showReasons('down'));
    thumbsRow.appendChild(upBtn);
    thumbsRow.appendChild(downBtn);
  };

  render();
  window.addEventListener('kisan:langchange', render);
}

renderWidget();

// Page view for this page too — same as every other static-core page.
telemetryReady.then(() => { if (telemetryModule) telemetryModule.trackPageView(location.pathname); });
