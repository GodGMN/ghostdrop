import { main, escapeHtml, bytes, date, status, api, setView } from './app.js';
import { fileIcon } from './file-visual.js';
import { errorText, t } from './i18n.js';

export async function initFile() {
  const id = location.pathname.split('/')[2];
  const deleting = location.pathname.startsWith('/delete/');
  const direct = location.pathname.endsWith('/direct');
  const base = `/api/files/${encodeURIComponent(id)}`;
  const deletionToken = location.hash.slice(1);
  let state = { kind: 'loading' };
  let previewText;
  let downloadStarted = false;

  // Every view is re-renderable so a language change can repaint it in place.
  function paint() {
    setView(paint);
    if (state.kind === 'loading') {
      main.innerHTML = `<p class="status">${t('file.finding')}</p>`;
      return;
    }
    if (state.kind === 'unavailable') {
      main.innerHTML = `<section class="card"><p class="eyebrow">${t('file.goneEyebrow')}</p><h1>${t('file.unavailableTitle')}</h1><p class="muted">${escapeHtml(state.message)}</p><a class="button full" href="/">${t('file.shareNew')}</a></section>`;
      return;
    }
    renderFile(state.file);
  }

  function unavailable(message) {
    state = { kind: 'unavailable', message };
    paint();
  }

  function renderFile(file) {
    main.innerHTML = `<section class="card share-card"><p class="eyebrow">${deleting ? t('file.privateEyebrow') : t('file.sharedEyebrow')}</p><div id="file-preview"></div><div class="shared-file"><span class="file-icon" aria-hidden="true">${fileIcon(file.name)}</span><h1>${escapeHtml(file.name)}</h1></div><p class="file-size">${t('file.sizeExpires', { size: bytes(file.size), date: date(file.expiresAt) })}</p>${file.oneTime ? `<p class="small-note">${t('file.oneTimeNote')}</p>` : ''}<div id="file-action"></div></section><p id="status" class="status" role="status" aria-live="polite"></p>`;
    const action = document.querySelector('#file-action');
    if (deleting) {
      action.innerHTML = `<p>${t('file.deleteWarning')}</p><button class="button danger full" id="delete">${t('file.deleteButton')}</button>`;
      document.querySelector('#delete').onclick = async (event) => {
        event.currentTarget.disabled = true;
        try {
          await api(base, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: deletionToken }),
          });
          unavailable(t('file.deleted'));
        } catch (err) {
          status(err.message, true);
          document.querySelector('#delete').disabled = false;
        }
      };
    } else if (file.locked) {
      action.innerHTML = `<form id="unlock" class="form-grid"><label class="field">${t('file.passwordLabel')}<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button class="button" type="submit">${t('file.unlock')}</button></form>`;
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
          state = { kind: 'file', file: unlocked };
          paint();
        } catch (err) {
          status(err.message, true);
          button.disabled = false;
        }
      };
    } else {
      action.innerHTML = `<div class="actions"><a class="button" id="download" href="${base}/download">${t('file.download')} ↓</a></div>`;
      document.querySelector('#download').onclick = () => {
        if (file.oneTime) setTimeout(() => unavailable(t('file.oneTimeStarted')), 1000);
      };
      if (!direct && file.previewAvailable) showPreview(file);
      else if (file.passwordProtected) status(t('file.previewDisabled'));
      if (direct && !downloadStarted) {
        downloadStarted = true;
        document.querySelector('#download').click();
      }
    }
  }

  function appendPreviewText() {
    const text = document.createElement('pre');
    text.className = 'preview-text';
    text.textContent = previewText;
    document.querySelector('#file-preview').append(text);
  }

  async function showPreview(file) {
    if (file.mime.startsWith('image/')) {
      const image = document.createElement('img');
      image.alt = file.name;
      image.className = 'preview-image';
      image.onerror = () => status(t('file.previewFailed'), true);
      image.src = `${base}/preview`;
      document.querySelector('#file-preview').append(image);
      document.querySelector('.shared-file .file-icon').hidden = true;
      return;
    }
    if (previewText !== undefined) {
      appendPreviewText();
      return;
    }
    try {
      const response = await fetch(`${base}/preview`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(errorText(body.code, body.error));
      }
      previewText = await response.text();
      appendPreviewText();
    } catch (err) {
      status(err.message, true);
    }
  }

  paint();
  try {
    state = {
      kind: 'file',
      file: await api(
        deleting ? `${base}/delete-info` : base,
        deleting
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: deletionToken }),
            }
          : {},
      ),
    };
    paint();
  } catch (err) {
    // Older backends send no code; api() already localized the message.
    unavailable(err.message);
  }
}
