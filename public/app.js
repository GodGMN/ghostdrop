export const main = document.querySelector('#main');
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const bytes = (value) =>
  value < 1024
    ? `${value} B`
    : `${(value / 1024 ** Math.min(3, Math.floor(Math.log(value) / Math.log(1024)))).toFixed(1)} ${['B', 'KiB', 'MiB', 'GiB'][Math.min(3, Math.floor(Math.log(value) / Math.log(1024)))]}`;
export const date = (value) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export function status(message, error = false) {
  const el = document.querySelector('#status');
  if (el) {
    el.textContent = message;
    el.classList.toggle('error', error);
  }
}
export async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error || 'Request failed.');
    err.status = response.status;
    throw err;
  }
  return data;
}

const landing = main.innerHTML;
let selected;
function reset() {
  selected = undefined;
  main.innerHTML = landing;
  wirePicker();
}
function choose(file) {
  if (!file) return;
  selected = file;
  main.innerHTML = `<form id="upload-form" class="card">
    <div class="file-row"><span class="file-icon" aria-hidden="true">↗</span><div class="file-info"><p class="file-name">${escapeHtml(file.name)}</p><span class="file-size">${bytes(file.size)} · ready to upload</span><button class="change-file" type="button" id="replace">Choose another file</button><input id="replace-picker" type="file" class="visually-hidden" aria-label="Replace selected file"></div><button class="icon-button" type="button" id="remove" aria-label="Remove selected file">×</button></div>
    <div class="form-grid">
      <label class="field">Password <span class="muted">Optional</span><input name="password" type="password" autocomplete="new-password" maxlength="256" placeholder="Only people with the password can download"><small>Protects access to the file. Does not encrypt it.</small></label>
      <label class="field">Keep it for<select name="expiration"><option value="hour">One hour</option><option value="day">One day</option><option value="week">One week</option><option value="month" selected>One month</option></select></label>
      <label class="toggle-row"><input name="oneTime" type="checkbox"><span>One-time download<small>Deleted after the first download starts, even if interrupted.</small></span></label>
    </div><button class="button full" type="submit">Upload file <span aria-hidden="true">↗</span></button>
    <p class="small-note">Your file stays on this device until you click Upload.</p>
    <div id="upload-progress"></div>
  </form><p id="status" class="status" role="status" aria-live="polite"></p>`;
  document.querySelector('#remove').onclick = reset;
  document.querySelector('#replace').onclick = () =>
    document.querySelector('#replace-picker').click();
  document.querySelector('#replace-picker').onchange = (event) => choose(event.target.files[0]);
  document.querySelector('#upload-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { upload } = await import('./upload.js');
    upload(selected, form);
  };
  document.querySelector('#remove').focus();
}
function wirePicker() {
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
    if (event.dataTransfer.files.length > 1) status('Choose one file at a time.', true);
    else choose(event.dataTransfer.files[0]);
  };
}
if (location.pathname === '/') wirePicker();
else if (location.pathname.startsWith('/admin')) import('./admin.js').then((m) => m.initAdmin());
else import('./file.js').then((m) => m.initFile());
