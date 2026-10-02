import { main, api, status, escapeHtml, bytes, date } from './app.js';

let csrf;
let offset=0;
export async function initAdmin() {
  document.querySelector('.shell').classList.add('admin-shell');
  try {const session=await api('/api/admin/session');csrf=session.csrf;dashboard();}
  catch(err){login(err.status===503?err.message:'');}
}
function login(message='') {
  main.innerHTML=`<section class="card"><p class="eyebrow">Ghostdrop admin</p><h1>Welcome back.</h1><form id="admin-login" class="form-grid"><label class="field">Admin password<input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><button class="button" type="submit">Sign in</button></form></section><p id="status" class="status" role="status" aria-live="polite"></p>`;
  status(message,!!message);
  document.querySelector('#admin-login').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
    try{const result=await api('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:form.elements.password.value})});csrf=result.csrf;dashboard();}
    catch(err){status(err.message,true);button.disabled=false;}
  };
}
function dashboard() {
  main.innerHTML=`<section class="card"><div class="admin-toolbar"><h1>Your files.</h1><button class="button secondary" id="logout">Sign out</button></div><div class="stats" id="stats"></div>
    <form id="search" class="admin-toolbar"><input class="search-input" name="search" aria-label="Search files" placeholder="Search files…"><label class="field"><span class="visually-hidden">Search by</span><select name="by"><option value="name">Filename</option><option value="hash">SHA-256</option><option value="link">Link or ID</option></select></label><button class="button" type="submit">Search</button></form>
    <div class="admin-toolbar"><button class="button secondary" id="cleanup">Clean expired & unfinished uploads</button><button class="button secondary" id="refresh">Refresh</button></div>
    <div id="file-table" class="table-scroll"></div><div id="pagination" class="actions"></div></section><p id="status" class="status" role="status" aria-live="polite"></p>`;
  document.querySelector('#logout').onclick=async()=>{
    try{await api('/api/admin/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}});csrf=undefined;login();}
    catch(err){status(err.message,true);}
  };
  document.querySelector('#search').onsubmit=event=>{event.preventDefault();offset=0;loadFiles();};
  document.querySelector('#refresh').onclick=()=>loadFiles();
  document.querySelector('#cleanup').onclick=async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{const result=await api('/api/admin/cleanup',{method:'POST',headers:{'X-CSRF-Token':csrf}});await loadFiles();status(`Removed ${result.files} files and ${result.partials} unfinished uploads.`);}
    catch(err){status(err.message,true);}finally{button.disabled=false;}
  };
  offset=0;loadFiles();
}
async function loadFiles() {
  try{
    const form=document.querySelector('#search');
    const query=new URLSearchParams({search:form.elements.search.value,by:form.elements.by.value,offset,limit:25});
    const [list,stats]=await Promise.all([api(`/api/admin/files?${query}`),api('/api/admin/stats')]);
    document.querySelector('#stats').textContent=`${stats.count} files · ${bytes(stats.storedBytes)} stored · ${bytes(stats.partialBytes)} in progress`;
    const table=document.querySelector('#file-table');
    table.innerHTML=list.items.length?`<table><thead><tr><th>File</th><th>Size & access</th><th>Dates</th><th>Actions</th></tr></thead><tbody>${list.items.map(file=>`<tr>
      <td><span class="table-name">${escapeHtml(file.name)}</span><span class="table-detail">${escapeHtml(file.mime)}</span><span class="table-detail">ID: ${file.id}</span><span class="table-detail">SHA-256: ${file.sha256}</span></td>
      <td>${bytes(file.size)}<span class="table-detail">${file.passwordProtected?'Password protected':'No password'}</span><span class="table-detail">${file.oneTime?'One-time download':'Reusable download'}</span>${file.state!=='available'?`<span class="badge">${escapeHtml(file.state)}</span>`:''}</td>
      <td><span class="table-detail">Uploaded ${date(file.createdAt)}</span><span class="table-detail">Expires ${date(file.expiresAt)}</span></td>
      <td><a class="button secondary admin-download" data-one-time="${file.oneTime}" href="/api/admin/files/${file.id}/download">Download</a><button class="button danger delete-file" data-id="${file.id}" data-name="${escapeHtml(file.name)}">Delete</button></td></tr>`).join('')}</tbody></table>`:'<p class="empty">No files found.</p>';
    for(const button of table.querySelectorAll('.delete-file'))button.onclick=async()=>{
      if(!confirm(`Permanently delete “${button.dataset.name}” and its sharing links?`))return;
      button.disabled=true;
      try{await api(`/api/admin/files/${button.dataset.id}`,{method:'DELETE',headers:{'X-CSRF-Token':csrf}});await loadFiles();status('File deleted.');}catch(err){status(err.message,true);button.disabled=false;}
    };
    for(const link of table.querySelectorAll('.admin-download'))link.onclick=event=>{
      if(link.dataset.oneTime==='true'&&!confirm('This is a one-time file. Downloading it deletes the stored file. Continue?'))event.preventDefault();
    };
    const pages=document.querySelector('#pagination');
    pages.innerHTML=`<button class="button secondary" id="previous" ${offset===0?'disabled':''}>Previous</button><span class="small-note">${list.total?offset+1:0}–${Math.min(offset+list.limit,list.total)} of ${list.total}</span><button class="button secondary" id="next" ${offset+list.limit>=list.total?'disabled':''}>Next</button>`;
    document.querySelector('#previous').onclick=()=>{offset=Math.max(0,offset-25);loadFiles();};
    document.querySelector('#next').onclick=()=>{offset+=25;loadFiles();};
    status('');
  }catch(err){if(err.status===401)login('Your session has expired. Please sign in again.');else status(err.message,true);}
}
