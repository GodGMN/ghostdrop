import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
import { hashPassword } from '../src/security.js';

test('admin access is disabled without a configured password hash',async t=>{
  const {base}=await fixture(t);
  assert.equal((await fetch(`${base}/api/admin/session`)).status,503);
  assert.equal((await fetch(`${base}/api/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"password":"anything"}'})).status,503);
});
test('admin login, session, CSRF protection and logout',async t=>{
  const {base}=await fixture(t,{adminPasswordHash:await hashPassword('secret')});
  assert.equal((await fetch(`${base}/api/admin/session`)).status,401);
  const options={method:'POST',headers:{'Content-Type':'application/json'},body:'{"password":"wrong"}'};
  assert.equal((await fetch(`${base}/api/admin/login`,options)).status,401);
  const response=await fetch(`${base}/api/admin/login`,{...options,body:'{"password":"secret"}'});
  assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0];const {csrf}=await response.json();
  assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await fetch(`${base}/api/admin/session`,{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(`${base}/api/admin/logout`,{method:'POST',headers:{Cookie:cookie}})).status,403);
  assert.equal((await fetch(`${base}/api/admin/logout`,{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':csrf}})).status,200);
  assert.equal((await fetch(`${base}/api/admin/session`,{headers:{Cookie:cookie}})).status,401);
});
