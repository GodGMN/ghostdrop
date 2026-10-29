import { fileIcon, localThumbnail } from './file-visual.js';
import {
  applyTranslations,
  errorText,
  initLanguage,
  languageTag,
  onLanguageChange,
  t,
} from './i18n.js';

export const main = document.querySelector('#main');
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const units = ['B', 'KiB', 'MiB', 'GiB'];
export function bytes(value, { trim = false } = {}) {
  const exponent = value < 1024 ? 0 : Math.min(3, Math.floor(Math.log(value) / Math.log(1024)));
  const digits = exponent === 0 ? 0 : 1;
  const format = new Intl.NumberFormat(languageTag(), {
    minimumFractionDigits: trim ? 0 : digits,
    maximumFractionDigits: digits,
  });
  return `${format.format(value / 1024 ** exponent)} ${units[exponent]}`;
}
export const date = (value) =>
  new Date(value).toLocaleString(languageTag(), { dateStyle: 'medium', timeStyle: 'short' });
export function status(message, error = false) {
  const el = document.querySelector('#status');
  if (el) {
    el.textContent = message;
    el.classList.toggle('error', error);
  }
}
export async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(errorText(data.code, data.error || t('error.request_failed')));
    err.status = response.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

const landingMarkup = main.innerHTML;
let renderView;
let selected;
let uploadLimits;
let limit;
let disposeThumbnail = () => {};

// Views register themselves so a language change can re-render the current one.
export function setView(render) {
  renderView = render;
}

function renderLanding() {
  selected = undefined;
  disposeThumbnail();
  disposeThumbnail = () => {};
  main.innerHTML = landingMarkup;
  applyTranslations(main);
  wirePicker();
}

function showLimitNote() {
  const note = document.querySelector('.drop-note');
  if (!note) return;
  note.textContent = !limit
    ? t('landing.checkingLimit')
    : limit.failed
      ? t('landing.limitUnavailable')
      : t('landing.limit', { size: bytes(limit.maxFileBytes, { trim: true }) });
}

function loadLimits() {
  (uploadLimits ||= api('/api/config')).then(
    ({ maxFileBytes }) => {
      limit = { maxFileBytes };
      showLimitNote();
    },
    () => {
      uploadLimits = undefined;
      limit = { failed: true };
      showLimitNote();
    },
  );
}

function wirePicker() {
  showLimitNote();
  loadLimits();
  const picker = document.querySelector('#file-picker');
  picker.onchange = () => choose(picker.files[0]);
  document.querySelector('.drop-target').onkeydown = (event) => {
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      picker.click();
    }
  };
  const zone = document.querySelector('#drop-zone');
  zone.ondragover = (event) => {
    event.preventDefault();
    zone.classList.add('dragging');
  };
  zone.ondragleave = () => zone.classList.remove('dragging');
  zone.ondrop = (event) => {
    event.preventDefault();
    zone.classList.remove('dragging');
    if (event.dataTransfer.files.length > 1) status(t('upload.oneFileAtATime'), true);
    else choose(event.dataTransfer.files[0]);
  };
}

function renderChoose() {
  const file = selected;
  if (!file) return renderLanding();
  disposeThumbnail();
  main.innerHTML = `<form id="upload-form" class="card">
    <p class="eyebrow" id="upload-eyebrow">${t('upload.ready')}</p>
    <div class="file-row"><span class="file-icon" aria-hidden="true">${fileIcon(file.name)}</span><div class="file-info"><p class="file-name">${escapeHtml(file.name)}</p><span class="file-size" id="upload-state">${t('upload.stateReady', { size: bytes(file.size) })}</span><button class="change-file" type="button" id="replace">${t('upload.changeFile')}</button><input id="replace-picker" type="file" class="visually-hidden" aria-label="${t('upload.replaceFile')}"></div><button class="icon-button" type="button" id="remove" aria-label="${t('upload.removeFile')}">×</button></div>
    <div class="form-grid upload-settings">
      <label class="field">${t('upload.keepFor')}<select name="expiration"><option value="hour">${t('upload.oneHour')}</option><option value="day">${t('upload.oneDay')}</option><option value="week">${t('upload.oneWeek')}</option><option value="month" selected>${t('upload.oneMonth')}</option></select></label>
      <label class="field">${t('upload.password')}<input name="password" type="password" autocomplete="new-password" maxlength="256" placeholder="${t('upload.optional')}"><small>${t('upload.passwordNote')}</small></label>
      <label class="toggle-row"><input name="oneTime" type="checkbox"><span>${t('upload.oneTime')}<small>${t('upload.oneTimeNote')}</small></span></label>
    </div><div class="upload-submit"><span class="muted" id="upload-note">${t('upload.notUploaded')}</span><button class="button" type="submit">${t('upload.submit')} <span aria-hidden="true">↑</span></button></div>
    <div id="upload-progress"></div>
  </form><p id="status" class="status" role="status" aria-live="polite"></p>`;
  disposeThumbnail = localThumbnail(document.querySelector('.file-icon'), file);
  document.querySelector('#remove').onclick = reset;
  document.querySelector('#replace').onclick = () =>
    document.querySelector('#replace-picker').click();
  document.querySelector('#replace-picker').onchange = (event) => choose(event.target.files[0]);
  document.querySelector('#upload-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { upload } = await import('./upload.js');
    upload(selected, form, disposeThumbnail);
  };
  document.querySelector('#remove').focus();
}

function choose(file) {
  if (!file) return;
  selected = file;
  setView(renderChoose);
  renderChoose();
}

function reset() {
  selected = undefined;
  setView(renderLanding);
  renderLanding();
}

function renderRestricted() {
  main.innerHTML = `<section class="card login-card"><p class="eyebrow">${t('restricted.eyebrow')}</p><h1>${t('restricted.title')}</h1><p class="muted">${t('restricted.body')}</p></section>`;
}

function renderUnlock() {
  main.innerHTML = `<section class="card login-card"><p class="eyebrow">${t('unlock.eyebrow')}</p><h1>${t('unlock.title')}</h1><form id="upload-unlock" class="form-grid"><label class="field">${t('unlock.password')}<input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><button class="button" type="submit">${t('unlock.submit')}</button></form></section><p id="status" class="status" role="status" aria-live="polite"></p>`;
  document.querySelector('#upload-unlock').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector('button');
    button.disabled = true;
    try {
      await api('/api/uploads/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: form.elements.password.value }),
      });
      setView(renderLanding);
      renderLanding();
    } catch (err) {
      status(err.message, true);
      button.disabled = false;
    }
  };
  document.querySelector('#upload-unlock input').focus();
}

async function start() {
  // Older backends have no access endpoint; uploads then report their own errors.
  const access = await api('/api/uploads/access').catch(() => ({ allowed: true, unlocked: true }));
  if (!access.allowed) {
    setView(renderRestricted);
    renderRestricted();
  } else if (!access.unlocked) {
    setView(renderUnlock);
    renderUnlock();
  } else {
    setView(renderLanding);
    renderLanding();
  }
}

onLanguageChange(() => {
  // An upload in flight owns its form and progress elements; leave it alone and
  // let upload.js retranslate its live labels instead.
  const form = document.querySelector('#upload-form');
  if (form?.dataset.uploading) return;
  const values = form && {
    password: form.elements.password.value,
    expiration: form.elements.expiration.value,
    oneTime: form.elements.oneTime.checked,
  };
  renderView?.();
  if (!values) return;
  const next = document.querySelector('#upload-form');
  if (!next) return;
  next.elements.password.value = values.password;
  next.elements.expiration.value = values.expiration;
  next.elements.oneTime.checked = values.oneTime;
});

initLanguage();

if (location.pathname === '/') start();
else if (location.pathname.startsWith('/admin')) import('./admin.js').then((m) => m.initAdmin());
else import('./file.js').then((m) => m.initFile());
