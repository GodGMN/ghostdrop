import { setTimeout } from 'node:timers/promises';
import assert from 'node:assert/strict';

export const headers = (session) => ({ 'X-Upload-Token': session.token });
export const path = (base, session) => `${base}/api/uploads/sessions/${session.id}`;
export async function init(base, options = {}) {
  const response = await fetch(`${base}/api/uploads/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'large.bin', size: 16, ...options }),
  });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}
export const chunk = (base, session, offset, body) =>
  fetch(`${path(base, session)}/chunks`, {
    method: 'PUT',
    headers: {
      ...headers(session),
      'Content-Type': 'application/octet-stream',
      'X-Upload-Offset': String(offset),
    },
    body,
  });
export const status = (base, session) => fetch(path(base, session), { headers: headers(session) });
export async function complete(base, session) {
  const response = await fetch(`${path(base, session)}/complete`, {
    method: 'POST',
    headers: headers(session),
  });
  assert.ok([200, 202].includes(response.status), await response.clone().text());
  let result = await response.json();
  for (let i = 0; result.state !== 'complete' && i < 300; i++) {
    await setTimeout(10);
    const response = await status(base, session);
    assert.equal(response.status, 200);
    result = await response.json();
    if (result.error) throw new Error(result.error);
  }
  assert.equal(result.state, 'complete');
  return result.file;
}
