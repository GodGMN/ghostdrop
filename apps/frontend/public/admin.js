import { main, api, status, escapeHtml, bytes, date, setView } from './app.js';
import { t } from './i18n.js';

let csrf;
let offset = 0;
let query = { search: '', by: 'name' };
let state = { kind: 'login', message: '' };

export async function initAdmin() {
  document.querySelector('.shell').classList.add('admin-shell');
  try {
    const session = await api('/api/admin/session');
    csrf = session.csrf;
    dashboard();
  } catch (err) {
    login(err.status === 503 ? err.message : '');
  }
}

function paint() {
  setView(paint);
  if (state.kind === 'login') renderLogin();
  else renderDashboard();
}

function login(message = '') {
  state = { kind: 'login', message };
  paint();
}

function dashboard() {
  state = { kind: 'dashboard' };
  paint();
}

function renderLogin() {
  main.innerHTML = `<section class="card login-card"><p class="eyebrow">${t('admin.eyebrow')}</p><h1>${t('admin.welcome')}</h1><form id="admin-login" class="form-grid"><label class="field">${t('admin.password')}<input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><button class="button" type="submit">${t('admin.signIn')}</button></form></section><p id="status" class="status" role="status" aria-live="polite"></p>`;
  status(state.message, !!state.message);
  document.querySelector('#admin-login').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector('button');
    button.disabled = true;
    try {
      const result = await api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: form.elements.password.value }),
      });
      csrf = result.csrf;
      offset = 0;
      query = { search: '', by: 'name' };
      dashboard();
    } catch (err) {
      status(err.message, true);
      button.disabled = false;
    }
  };
}

function renderDashboard() {
  main.innerHTML = `<section class="card"><div class="admin-toolbar"><h1>${t('admin.yourFiles')}</h1><button class="button secondary" id="logout">${t('admin.signOut')}</button></div><div class="stats" id="stats"></div>
    <form id="search" class="admin-toolbar"><input class="search-input" name="search" aria-label="${t('admin.searchFiles')}" placeholder="${t('admin.searchPlaceholder')}"><label class="field"><span class="visually-hidden">${t('admin.searchBy')}</span><select name="by"><option value="name">${t('admin.byName')}</option><option value="hash">${t('admin.byHash')}</option><option value="link">${t('admin.byLink')}</option></select></label><button class="button" type="submit">${t('admin.search')}</button></form>
    <div class="admin-toolbar"><button class="button secondary" id="cleanup">${t('admin.cleanup')}</button><button class="button secondary" id="refresh">${t('admin.refresh')}</button></div>
    <div id="file-table" class="table-scroll"></div><div id="pagination" class="actions"></div></section><p id="status" class="status" role="status" aria-live="polite"></p>`;
  const form = document.querySelector('#search');
  form.elements.search.value = query.search;
  form.elements.by.value = query.by;
  document.querySelector('#logout').onclick = async () => {
    try {
      await api('/api/admin/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf } });
      csrf = undefined;
      login();
    } catch (err) {
      status(err.message, true);
    }
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    query = { search: form.elements.search.value, by: form.elements.by.value };
    offset = 0;
    loadFiles();
  };
  document.querySelector('#refresh').onclick = () => loadFiles();
  document.querySelector('#cleanup').onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await api('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
      });
      await loadFiles();
      status(t('admin.cleanupDone', { files: result.files, partials: result.partials }));
    } catch (err) {
      status(err.message, true);
    } finally {
      button.disabled = false;
    }
  };
  loadFiles();
}

async function loadFiles() {
  try {
    const params = new URLSearchParams({ ...query, offset, limit: 25 });
    const [list, stats] = await Promise.all([
      api(`/api/admin/files?${params}`),
      api('/api/admin/stats'),
    ]);
    document.querySelector('#stats').textContent = t('admin.stats', {
      count: stats.count,
      stored: bytes(stats.storedBytes),
      partial: bytes(stats.partialBytes),
    });
    const names = new Map(list.items.map((file) => [file.id, file.name]));
    const table = document.querySelector('#file-table');
    table.innerHTML = list.items.length
      ? `<table><thead><tr><th>${t('admin.colFile')}</th><th>${t('admin.colAccess')}</th><th>${t('admin.colDates')}</th><th>${t('admin.colActions')}</th></tr></thead><tbody>${list.items
          .map((file) => {
            const badge = { expired: 'admin.stateExpired', deleting: 'admin.stateDeleting' }[
              file.state
            ];
            return `<tr>
      <td><span class="table-name">${escapeHtml(file.name)}</span><span class="table-detail">${escapeHtml(file.mime)}</span><span class="table-detail">ID: ${file.id}</span><span class="table-detail">SHA-256: ${file.sha256}</span></td>
      <td>${bytes(file.size)}<span class="table-detail">${file.passwordProtected ? t('admin.passwordProtected') : t('admin.noPassword')}</span><span class="table-detail">${file.oneTime ? t('admin.oneTime') : t('admin.reusable')}</span>${file.state !== 'available' ? `<span class="badge">${badge ? t(badge) : escapeHtml(file.state)}</span>` : ''}</td>
      <td><span class="table-detail">${t('admin.uploaded', { date: date(file.createdAt) })}</span><span class="table-detail">${t('admin.expires', { date: date(file.expiresAt) })}</span></td>
      <td><a class="button secondary admin-download" data-one-time="${file.oneTime}" href="/api/admin/files/${file.id}/download">${t('admin.download')}</a><button class="button danger delete-file" data-id="${file.id}">${t('admin.delete')}</button></td></tr>`;
          })
          .join('')}</tbody></table>`
      : `<p class="empty">${t('admin.empty')}</p>`;
    for (const button of table.querySelectorAll('.delete-file'))
      button.onclick = async () => {
        if (!confirm(t('admin.confirmDelete', { name: names.get(button.dataset.id) ?? '' })))
          return;
        button.disabled = true;
        try {
          await api(`/api/admin/files/${button.dataset.id}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrf },
          });
          await loadFiles();
          status(t('admin.deleted'));
        } catch (err) {
          status(err.message, true);
          button.disabled = false;
        }
      };
    for (const link of table.querySelectorAll('.admin-download'))
      link.onclick = (event) => {
        if (link.dataset.oneTime === 'true' && !confirm(t('admin.confirmOneTime')))
          event.preventDefault();
      };
    const pages = document.querySelector('#pagination');
    pages.innerHTML = `<button class="button secondary" id="previous" ${offset === 0 ? 'disabled' : ''}>${t('admin.previous')}</button><span class="small-note">${t('admin.range', { from: list.total ? offset + 1 : 0, to: Math.min(offset + list.limit, list.total), total: list.total })}</span><button class="button secondary" id="next" ${offset + list.limit >= list.total ? 'disabled' : ''}>${t('admin.next')}</button>`;
    document.querySelector('#previous').onclick = () => {
      offset = Math.max(0, offset - 25);
      loadFiles();
    };
    document.querySelector('#next').onclick = () => {
      offset += 25;
      loadFiles();
    };
    status('');
  } catch (err) {
    if (err.status === 401) login(t('admin.sessionExpired'));
    else status(err.message, true);
  }
}
