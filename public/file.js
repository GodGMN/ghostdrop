import { main, escapeHtml, bytes, date, status, api } from './app.js';
import { fileIcon } from './file-visual.js';

export async function initFile() {
  const id = location.pathname.split('/')[2];
  const deleting = location.pathname.startsWith('/delete/');
  const direct = location.pathname.endsWith('/direct');
  const base = `/api/files/${encodeURIComponent(id)}`;
  const deletionToken = location.hash.slice(1);
  main.innerHTML = '<p class="status">Finding your file…</p>';
  try {
    const file = await api(
      deleting ? `${base}/delete-info` : base,
      deleting
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: deletionToken }),
          }
        : {},
    );
    render(file);
  } catch (err) {
    unavailable(err.message);
  }

  function unavailable(message) {
    main.innerHTML = `<section class="card"><p class="eyebrow">Gone for good</p><h1>File unavailable.</h1><p class="muted">${escapeHtml(message)}</p><a class="button full" href="/">Share a new file</a></section>`;
  }
  function render(file) {
    main.innerHTML = `<section class="card"><p class="eyebrow">${deleting ? 'Private deletion link' : 'A little something for you'}</p><div class="shared-file"><span class="file-icon" aria-hidden="true">${fileIcon(file.name)}</span><h1>${escapeHtml(file.name)}</h1></div><p class="muted">${bytes(file.size)} · Expires ${date(file.expiresAt)}</p>${file.oneTime ? '<p class="small-note">One-time file. Starting the download deletes the stored file, even if the transfer is interrupted.</p>' : ''}<div id="file-action"></div></section><p id="status" class="status" role="status" aria-live="polite"></p>`;
    const action = document.querySelector('#file-action');
    if (deleting) {
      action.innerHTML =
        '<p>This permanently deletes the file and its sharing links.</p><button class="button danger full" id="delete">Delete this file</button>';
      document.querySelector('#delete').onclick = async (event) => {
        event.currentTarget.disabled = true;
        try {
          await api(base, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: deletionToken }),
          });
          unavailable('The file has been deleted.');
        } catch (err) {
          status(err.message, true);
          document.querySelector('#delete').disabled = false;
        }
      };
    } else if (file.locked) {
      action.innerHTML =
        '<form id="unlock" class="form-grid"><label class="field">File password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button class="button" type="submit">Unlock file</button></form>';
      document.querySelector('#unlock').onsubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button');
        button.disabled = true;
        try {
          const unlocked = await api(`${base}/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: form.elements.password.value }),
          });
          render(unlocked);
        } catch (err) {
          status(err.message, true);
          button.disabled = false;
        }
      };
    } else {
      action.innerHTML = `<div class="actions"><a class="button" id="download" href="${base}/download">Download file ↓</a></div>`;
      document.querySelector('#download').onclick = () => {
        if (file.oneTime)
          setTimeout(
            () => unavailable('The one-time download has started. This link has been consumed.'),
            1000,
          );
      };
      if (!direct && file.previewAvailable) showPreview(file);
      else if (file.passwordProtected) status('Preview is disabled for password-protected files.');
      if (direct) document.querySelector('#download').click();
    }
  }
  async function showPreview(file) {
    try {
      const response = await fetch(`${base}/preview`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      if (file.mime.startsWith('image/')) {
        const url = URL.createObjectURL(await response.blob());
        const image = document.createElement('img');
        image.alt = file.name;
        image.className = 'preview-image';
        image.src = url;
        image.onload = () => URL.revokeObjectURL(url);
        image.onerror = () => URL.revokeObjectURL(url);
        document.querySelector('#file-action').prepend(image);
      } else {
        const text = document.createElement('pre');
        text.className = 'preview-text';
        text.textContent = await response.text();
        document.querySelector('#file-action').prepend(text);
      }
    } catch (err) {
      status(err.message, true);
    }
  }
}
