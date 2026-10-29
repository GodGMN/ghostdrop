import { main, escapeHtml, bytes, date, api, status, setView } from './app.js';
import { fileIcon } from './file-visual.js';
import { errorText, onLanguageChange, t } from './i18n.js';

let pending;
const randomToken = () => {
  const data = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...data))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
};
const sessionPath = (context) => `/api/uploads/sessions/${context.id}`;
const sessionHeaders = (context) => ({ 'X-Upload-Token': context.token });
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    function abort() {
      clearTimeout(timer);
      reject(new DOMException('Upload cancelled.', 'AbortError'));
    }
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
function retryable(error) {
  return (
    error.name !== 'AbortError' &&
    (!error.status || [408, 409, 500, 502, 503, 504].includes(error.status))
  );
}
async function retry(context, work, reconcile = false) {
  for (let attempt = 0; ; attempt++) {
    context.controller.signal.throwIfAborted();
    try {
      return await work();
    } catch (error) {
      if (!retryable(error) || attempt >= 3) throw error;
      status(t('upload.retrying'));
      await wait(300 * 2 ** attempt, context.controller.signal);
      if (reconcile) {
        const current = await retry(context, () =>
          api(sessionPath(context), {
            headers: sessionHeaders(context),
            signal: context.controller.signal,
          }),
        );
        context.offset = current.offset;
      }
    }
  }
}
async function discard(context) {
  try {
    const response = await fetch(sessionPath(context), {
      method: 'DELETE',
      headers: sessionHeaders(context),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok || [404, 410].includes(response.status);
  } catch {
    return false;
  }
}
function sendChunk(context, file, chunkSize, onProgress) {
  if (context.offset >= file.size) return Promise.resolve({ offset: context.offset });
  return new Promise((resolve, reject) => {
    const offset = context.offset;
    const xhr = new XMLHttpRequest();
    context.xhr = xhr;
    xhr.open('PUT', `${sessionPath(context)}/chunks`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-Upload-Token', context.token);
    xhr.setRequestHeader('X-Upload-Offset', String(offset));
    xhr.responseType = 'json';
    xhr.timeout = 2 * 60_000;
    xhr.upload.onprogress = (event) => {
      if (!context.cancelled) onProgress(offset + event.loaded);
    };
    xhr.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'));
    xhr.onerror = () => reject(new Error(t('upload.connectionLost')));
    xhr.ontimeout = () => reject(new Error(t('upload.timeout')));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) resolve(xhr.response);
      else
        reject(
          Object.assign(
            new Error(
              errorText(xhr.response?.code, xhr.response?.error || t('upload.requestFailed')),
            ),
            { status: xhr.status || 502 },
          ),
        );
    };
    xhr.send(file.slice(offset, Math.min(file.size, offset + chunkSize)));
  });
}
export async function upload(file, form, disposeThumbnail = () => {}) {
  if (form.dataset.uploading) return;
  form.dataset.uploading = 'true';
  const settings = {
    name: file.name,
    size: file.size,
    password: form.elements.password.value,
    expiration: form.elements.expiration.value,
    oneTime: form.elements.oneTime.checked,
  };
  const fingerprint = JSON.stringify(settings);
  const controls = [...form.querySelectorAll('input,select,button')];
  controls.forEach((element) => (element.disabled = true));
  const label = (selector) => form.querySelector(selector);
  const setUploadingLabels = () => {
    label('#upload-eyebrow').textContent = t('upload.eyebrowUploading');
    label('#upload-state').textContent = t('upload.stateUploading', { size: bytes(file.size) });
    label('#upload-note').textContent = t('upload.noteInProgress');
  };
  const restoreLabels = () => {
    label('#upload-eyebrow').textContent = t('upload.ready');
    label('#upload-state').textContent = t('upload.stateReady', { size: bytes(file.size) });
    label('#upload-note').textContent = t('upload.notUploaded');
  };
  setUploadingLabels();
  const progress = document.querySelector('#upload-progress');
  progress.innerHTML = `<progress max="100" value="0" aria-label="${t('upload.progressLabel')}"></progress><p class="small-note" id="progress-label"></p><button type="button" id="cancel-upload" class="button secondary full">${t('upload.cancel')}</button>`;
  let progressMessage = () => t('upload.starting');
  const renderProgressMessage = () => {
    const element = document.querySelector('#progress-label');
    if (element && main.contains(element)) element.textContent = progressMessage();
  };
  renderProgressMessage();
  // Keep the live labels of an in-flight upload in the selected language.
  const stopListening = onLanguageChange(() => {
    if (!main.contains(form)) return;
    setUploadingLabels();
    const progressBar = progress.querySelector('progress');
    if (progressBar) progressBar.setAttribute('aria-label', t('upload.progressLabel'));
    renderProgressMessage();
    const cancel = document.querySelector('#cancel-upload');
    if (cancel) cancel.textContent = t('upload.cancel');
  });
  const context =
    pending?.file === file && pending.fingerprint === fingerprint
      ? pending
      : { id: randomToken(), token: randomToken(), file, fingerprint, offset: 0 };
  const old = pending;
  pending = context;
  context.controller = new AbortController();
  context.cancelled = false;
  context.xhr = null;
  document.querySelector('#cancel-upload').onclick = () => {
    context.cancelled = true;
    context.controller.abort();
    context.xhr?.abort();
    status(t('upload.cancelling'));
    context.cancellation = discard(context);
  };
  function updateProgress(uploaded) {
    const percent = file.size ? Math.min(100, Math.round((uploaded / file.size) * 100)) : 100;
    progress.querySelector('progress').value = percent;
    progressMessage = () => t('upload.progress', { percent });
    renderProgressMessage();
  }
  try {
    status('');
    if (old && old !== context) await discard(old);
    const config = await retry(context, () =>
      api('/api/config', { signal: context.controller.signal }),
    );
    if (file.size > config.maxFileBytes)
      throw Object.assign(new Error(t('upload.tooLarge', { size: bytes(config.maxFileBytes) })), {
        status: 413,
      });
    const initialized = await retry(context, () =>
      api('/api/uploads/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: context.controller.signal,
        body: JSON.stringify({ ...settings, id: context.id, token: context.token }),
      }),
    );
    context.offset = initialized.offset;
    updateProgress(context.offset);
    while (context.offset < file.size) {
      const result = await retry(
        context,
        () => sendChunk(context, file, config.chunkSize, updateProgress),
        true,
      );
      if (
        !Number.isSafeInteger(result.offset) ||
        result.offset < context.offset ||
        (result.offset === context.offset && context.offset < file.size) ||
        result.offset > file.size
      )
        throw new Error(t('upload.badAck'));
      context.offset = result.offset;
      updateProgress(context.offset);
    }
    progressMessage = () => t('upload.saving');
    renderProgressMessage();
    const complete = () =>
      api(`${sessionPath(context)}/complete`, {
        method: 'POST',
        headers: sessionHeaders(context),
        signal: context.controller.signal,
      });
    let current = await retry(context, complete);
    const deadline = Date.now() + 10 * 60_000;
    while (current.state !== 'complete') {
      if (Date.now() > deadline) throw new Error(t('upload.saveSlow'));
      await wait(300, context.controller.signal);
      current = await retry(context, () =>
        api(sessionPath(context), {
          headers: sessionHeaders(context),
          signal: context.controller.signal,
        }),
      );
      if (current.error) throw new Error(errorText(current.error));
      if (current.state === 'uploading') current = await retry(context, complete);
    }
    pending = undefined;
    disposeThumbnail();
    receipt(current.file);
  } catch (error) {
    if (context.cancelled) {
      const removed = await context.cancellation;
      if (pending === context) pending = undefined;
      status(removed ? t('upload.cancelledSelected') : t('upload.cancelledExpire'));
    } else {
      if ([404, 410, 413].includes(error.status) && pending === context) pending = undefined;
      status(t('upload.retryHint', { message: error.message }), true);
    }
  } finally {
    stopListening();
    if (main.contains(form)) {
      delete form.dataset.uploading;
      controls.forEach((element) => (element.disabled = false));
      restoreLabels();
      progress.innerHTML = '';
    }
  }
}

function receipt(file) {
  setView(() => receipt(file));
  const base = `${location.origin}/f/${file.id}`;
  const links = [
    { label: t('receipt.shareLink'), copy: t('receipt.copyShare'), url: base },
    { label: t('receipt.directLink'), copy: t('receipt.copyDirect'), url: `${base}/direct` },
  ];
  const linkRow = (link, privateLink = false) =>
    `<div class="link-row${privateLink ? ' private-link' : ''}"><label class="link-label">${link.label}${privateLink ? t('receipt.keepPrivate') : ''}</label><div class="link-box"><input type="text" readonly aria-label="${link.label}" value="${escapeHtml(link.url)}"><button type="button" class="copy-button" aria-label="${link.copy}">${t('receipt.copy')}</button></div></div>`;
  const expires = file.oneTime
    ? t('receipt.oneTimeExpires', { date: date(file.expiresAt) })
    : t('receipt.expires', { date: date(file.expiresAt) });
  main.innerHTML = `<section class="card"><div class="receipt-head"><p class="eyebrow">${t('receipt.eyebrow')}</p><h1>${t('receipt.title')}</h1><div class="receipt-file"><span class="file-icon" aria-hidden="true">${fileIcon(file.name)}</span><p class="muted">${escapeHtml(file.name)} · ${bytes(file.size)}</p></div>${file.passwordProtected ? `<span class="badge">${t('receipt.passwordBadge')}</span>` : ''}${file.oneTime ? `<span class="badge">${t('receipt.oneTimeBadge')}</span>` : ''}</div>
    ${links.map((link) => linkRow(link)).join('')}
    ${linkRow(
      {
        label: t('receipt.deleteLink'),
        copy: t('receipt.copyDelete'),
        url: `${location.origin}/delete/${file.id}#${file.deletionToken}`,
      },
      true,
    )}
    <p class="small-note">${expires}</p>
    ${file.passwordProtected ? `<p class="small-note">${t('receipt.passwordNote')}</p>` : ''}
    <div class="actions"><a class="button full" href="/">${t('receipt.uploadAnother')}</a></div></section><p id="status" class="status" role="status" aria-live="polite">${t('receipt.saveDeletion')}</p>`;
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
        button.textContent = t('receipt.copied');
        status(t('receipt.linkCopied'));
        setTimeout(() => (button.textContent = t('receipt.copy')), 1800);
      } catch {
        input.focus();
        input.select();
        status(t('receipt.copyManually'), true);
      }
    };
  document.querySelector('h1').tabIndex = -1;
  document.querySelector('h1').focus();
}
