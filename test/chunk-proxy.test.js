import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './helpers.js';
import { init, chunk, complete } from './chunk-helpers.js';
import { CHUNK_BYTES } from '../src/chunks.js';

test('an 8 MiB file uploads through an unchanged 1 MiB body-limit proxy', async (t) => {
  const { base, store } = await fixture(t);
  const limit = 1024 * 1024;
  let largestAcceptedBody = 0,
    chunkRequests = 0;
  const proxy = http.createServer((req, res) => {
    if (Number(req.headers['content-length']) > limit) {
      req.resume();
      res.writeHead(413);
      res.end();
      return;
    }
    let size = 0;
    const upstream = http.request(
      `${base}${req.url}`,
      { method: req.method, headers: req.headers },
      (reply) => {
        res.writeHead(reply.statusCode, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.on('data', (data) => {
      size += data.length;
      if (size > limit) {
        upstream.destroy();
        res.writeHead(413);
        res.end();
      }
    });
    req.on('end', () => {
      largestAcceptedBody = Math.max(largestAcceptedBody, size);
      if (req.url.endsWith('/chunks')) chunkRequests++;
    });
    req.pipe(upstream);
  });
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  t.after(() => new Promise((resolve) => proxy.close(resolve)));
  const proxyBase = `http://127.0.0.1:${proxy.address().port}`;
  const content = Buffer.alloc(8 * 1024 * 1024 + 19, 137);
  const legacy = new FormData();
  legacy.append('file', new Blob([content]), 'large.bin');
  assert.equal(
    (await fetch(`${proxyBase}/api/uploads`, { method: 'POST', body: legacy })).status,
    413,
  );
  const start = performance.now();
  const session = await init(proxyBase, { size: content.length });
  for (let offset = 0; offset < content.length; offset += CHUNK_BYTES) {
    const response = await chunk(
      proxyBase,
      session,
      offset,
      content.subarray(offset, offset + CHUNK_BYTES),
    );
    assert.equal(response.status, 200);
  }
  const file = await complete(proxyBase, session);
  assert.deepEqual(readFileSync(join(store.filesDir, file.id)), content);
  assert.equal(largestAcceptedBody, CHUNK_BYTES);
  assert.equal(chunkRequests, 17);
  t.diagnostic(
    `8 MiB + 19 bytes, ${chunkRequests} chunk requests, max body ${largestAcceptedBody} bytes, ${Math.round(performance.now() - start)} ms on local test proxy including fsync and final hashing. Not a production throughput benchmark.`,
  );
});
