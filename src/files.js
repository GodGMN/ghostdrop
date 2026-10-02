import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { availableFile, deleteFile } from './lifecycle.js';
import { token, digest, equal, verifyPassword, rateLimiter, cookies, httpError } from './security.js';

export const canPreview = record => !record.one_time && (record.mime.startsWith('image/') || (record.mime === 'text/plain' && record.size <= 1024 * 1024));
export function publicFile(record, locked = false) {
  return { id:record.id, name:record.name, mime:record.mime, size:record.size, expiresAt:record.expires_at, oneTime:!!record.one_time, passwordProtected:!!record.password_hash, locked, previewAvailable:canPreview(record) };
}
export function registerFileRoutes(app, store, config) {
  const grants = new Map();
  const limit = rateLimiter();
  function authorized(req, record) {
    if (!record.password_hash) return true;
    const grant = grants.get(cookies(req)[`gd_access_${record.id}`]);
    return grant?.id === record.id && grant.expires > Date.now();
  }
  function authorize(req, record) {
    if (!authorized(req,record)) throw httpError(401, 'Enter the file password to continue.');
  }
  function deletionCapability(req, record) {
    if (typeof req.body?.token !== 'string' || !equal(digest(req.body.token),record.delete_hash)) throw httpError(403, 'This deletion link is invalid.');
  }
  app.get('/api/files/:id', async (req,res) => {
    const file = await availableFile(store,req.params.id);
    res.json(publicFile(file,!authorized(req,file)));
  });
  app.post('/api/files/:id/unlock', async (req,res) => {
    limit(req.ip);
    const file = await availableFile(store,req.params.id);
    if (file.password_hash && (typeof req.body?.password !== 'string' || req.body.password.length > 256 || !await verifyPassword(req.body.password,file.password_hash))) throw httpError(401, 'That password is incorrect.');
    for (const [key,grant] of grants) if (grant.expires <= Date.now()) grants.delete(key);
    if (grants.size >= 5000) throw httpError(503, 'Please try again later.');
    const value = token();
    grants.set(value,{id:file.id,expires:Date.now()+30*60_000});
    res.cookie(`gd_access_${file.id}`,value,{httpOnly:true,sameSite:'strict',secure:config.cookieSecure,maxAge:30*60_000,path:`/api/files/${file.id}`});
    res.json(publicFile(file));
  });
  for (const type of ['download','preview']) {
    app.all(`/api/files/:id/${type}`, async (req,res) => {
      const file = await availableFile(store,req.params.id);
      authorize(req,file);
      await serveFile(req,res,file,store,type);
    });
  }
  app.post('/api/files/:id/delete-info', async (req,res) => {
    const file = await availableFile(store,req.params.id);
    deletionCapability(req,file);
    res.json(publicFile(file));
  });
  app.delete('/api/files/:id', async (req,res) => {
    const file = await availableFile(store,req.params.id);
    deletionCapability(req,file);
    await deleteFile(store,file.id);
    res.json({deleted:true});
  });
}

export async function serveFile(req,res,file,store,type='download') {
if (req.method !== 'GET') throw httpError(405, 'Use the download page to start a download.');
if (req.headers.range) throw httpError(416, 'Partial downloads are not supported.');
if (type === 'preview' && !canPreview(file)) throw httpError(400, 'Preview is not available for this file.');
const handle = await open(join(store.filesDir,file.id),'r').catch(() => { throw httpError(404, 'This file is no longer available.'); });
try {
  // The update is atomic across simultaneous requests and SQLite connections.
  const claimed = store.db.prepare("UPDATE files SET state = CASE WHEN one_time = 1 THEN 'deleting' ELSE state END WHERE id = ? AND state = 'available' AND expires_at > ?").run(file.id,Date.now());
  if (!claimed.changes) throw httpError(404, 'This file is no longer available.');
  // The open descriptor remains readable after unlink. Future requests cannot access it.
  if (file.one_time) await deleteFile(store,file.id);
  const ascii = file.name.replace(/[^\x20-\x7e]|["\\]/g,'_');
  res.set({
    'Content-Type':type === 'preview' ? file.mime : 'application/octet-stream',
    'Content-Length':String(file.size),
    'Content-Disposition':`${type === 'preview' ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g,c => '%'+c.charCodeAt(0).toString(16).toUpperCase())}`,
    'Cache-Control':'no-store',
    'Content-Security-Policy':"default-src 'none'; sandbox",
    'Accept-Ranges':'none',
  });
  await pipeline(handle.createReadStream({autoClose:false}),res);
} finally { await handle.close(); }
}
