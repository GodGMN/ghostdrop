import { main, escapeHtml, bytes, date, api, status } from './app.js';
import { fileIcon } from './file-visual.js';

export async function upload(file, form, disposeThumbnail = () => {}) {
  if (form.dataset.uploading) return;
  form.dataset.uploading = 'true';
  const data = new FormData(form);
  data.set('oneTime', String(form.elements.oneTime.checked));
  data.append('file', file, file.name);
  const controls = [...form.querySelectorAll('input,select,button')];
  controls.forEach((el) => (el.disabled = true));
  const progress = document.querySelector('#upload-progress');
  const restore = () => {
    delete form.dataset.uploading;
    controls.forEach((el) => (el.disabled = false));
    progress.innerHTML = '';
  };
  try {
    const { maxFileBytes } = await api('/api/config');
    if (file.size > maxFileBytes)
      throw new Error(`This file is too large. The limit is ${bytes(maxFileBytes)}.`);
  } catch (err) {
    restore();
    status(err.message, true);
    return;
  }
  progress.innerHTML =
    '<progress max="100" value="0" aria-label="Upload progress"></progress><p class="small-note" id="progress-label">Uploading… 0%</p><button type="button" id="cancel-upload" class="button secondary full">Cancel upload</button>';
  status('');
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/uploads');
  xhr.responseType = 'json';
  xhr.timeout = 15 * 60_000;
  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable) return;
    const percent = Math.round((event.loaded / event.total) * 100);
    progress.querySelector('progress').value = percent;
    document.querySelector('#progress-label').textContent =
      percent === 100 ? 'Saving your file…' : `Uploading… ${percent}%`;
  };
  document.querySelector('#cancel-upload').onclick = () => xhr.abort();
  xhr.onabort = () => {
    restore();
    status('Upload cancelled. Your file is still selected.');
  };
  xhr.onerror = () => {
    restore();
    status('The connection was interrupted. Your file is still selected; try again.', true);
  };
  xhr.ontimeout = () => {
    restore();
    status('The upload timed out. Try again.', true);
  };
  xhr.onload = () => {
    if (xhr.status !== 201) {
      restore();
      status(xhr.response?.error || 'Upload failed. Please try again.', true);
      return;
    }
    disposeThumbnail();
    receipt(xhr.response);
  };
  xhr.send(data);
}
function receipt(file) {
  const base = `${location.origin}/f/${file.id}`;
  const links = [
    ['Share file', base],
    ['Direct download', `${base}/direct`],
  ];
  const linkRow = (label, url, privateLink = false) =>
    `<div class="link-row${privateLink ? ' private-link' : ''}"><label class="link-label">${label}${privateLink ? ' · keep this private' : ''}</label><div class="link-box"><input type="text" readonly aria-label="${label} URL" value="${escapeHtml(url)}"><button type="button" class="copy-button" aria-label="Copy ${label.toLowerCase()} link">Copy</button></div></div>`;
  main.innerHTML = `<section class="card"><div class="receipt-head"><p class="eyebrow">Ready to share</p><h1>Your file is up.</h1><div class="receipt-file"><span class="file-icon" aria-hidden="true">${fileIcon(file.name)}</span><p class="muted">${escapeHtml(file.name)} · ${bytes(file.size)}</p></div>${file.passwordProtected ? '<span class="badge">Password protected</span>' : ''}${file.oneTime ? '<span class="badge">One-time download</span>' : ''}</div>
    ${links.map(([label, url]) => linkRow(label, url)).join('')}
    ${linkRow('Delete file', `${location.origin}/delete/${file.id}#${file.deletionToken}`, true)}
    <p class="small-note">${file.oneTime ? 'Deleted when the first download starts, even if interrupted. Otherwise, expires' : 'Expires'} ${date(file.expiresAt)}.</p>
    ${file.passwordProtected ? '<p class="small-note">Share the password separately. It protects access; the file is not encrypted.</p>' : ''}
    <div class="actions"><a class="button full" href="/">Upload another file</a></div></section><p id="status" class="status" role="status" aria-live="polite">Save the private deletion link if you want to remove the file early.</p>`;
  for (const button of document.querySelectorAll('.copy-button'))
    button.onclick = async () => {
      const input = button.previousElementSibling;
      try {
        if (navigator.clipboard && window.isSecureContext)
          await navigator.clipboard.writeText(input.value);
        else {
          input.focus();
          input.select();
          if (!document.execCommand('copy')) throw new Error('Copy failed');
          input.setSelectionRange(0, 0);
        }
        button.textContent = 'Copied';
        status('Link copied.');
        setTimeout(() => (button.textContent = 'Copy'), 1800);
      } catch {
        input.focus();
        input.select();
        status('Select and copy the link manually.', true);
      }
    };
  document.querySelector('h1').tabIndex = -1;
  document.querySelector('h1').focus();
}
