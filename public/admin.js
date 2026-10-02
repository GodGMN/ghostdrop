import { main, api, status } from './app.js';

let csrf;
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
  main.innerHTML='<section class="card"><h1>Your files.</h1><p class="muted">File management is being added next.</p><button class="button secondary" id="logout">Sign out</button></section><p id="status" class="status" role="status"></p>';
  document.querySelector('#logout').onclick=async()=>{
    try{await api('/api/admin/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}});csrf=undefined;login();}
    catch(err){status(err.message,true);}
  };
}
