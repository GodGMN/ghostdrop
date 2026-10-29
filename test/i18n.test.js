import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  applyLanguage,
  catalogs,
  languages,
  preferredLanguage,
  t,
} from '../apps/frontend/public/i18n.js';

const frontendDir = 'apps/frontend/public';
const backendDir = 'apps/backend/src';

const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();

test('every language defines the same messages with the same placeholders', () => {
  const english = Object.keys(catalogs.en).sort();
  for (const { code } of languages) {
    assert.deepEqual(Object.keys(catalogs[code]).sort(), english, `${code} key set`);
    for (const key of english) {
      assert.equal(typeof catalogs[code][key], 'string', `${code} ${key}`);
      assert.ok(catalogs[code][key].trim(), `${code} ${key} is empty`);
      assert.deepEqual(
        placeholders(catalogs[code][key]),
        placeholders(catalogs.en[key]),
        `${code} ${key} placeholders`,
      );
    }
  }
});

test('every backend error code has a translated message that matches the API text', async () => {
  const pattern = /httpError\(\s*(\d+),\s*'([^']*)',\s*'([a-z_]+)'\s*,?\s*\)/g;
  let found = 0;
  for (const name of await readdir(backendDir)) {
    if (!name.endsWith('.js')) continue;
    const source = await readFile(join(backendDir, name), 'utf8');
    for (const [, , message, code] of source.matchAll(pattern)) {
      found++;
      assert.equal(catalogs.en[`error.${code}`], message, `${code} English message`);
      assert.ok(catalogs.es[`error.${code}`], `${code} needs a Spanish message`);
    }
  }
  assert.ok(found > 40, `expected the backend to expose error codes, found ${found}`);
  // Codes that are not thrown through httpError().
  for (const code of [
    'backend_unavailable',
    'internal_error',
    'request_failed',
    'route_not_found',
    'save_failed',
  ])
    assert.ok(catalogs.es[`error.${code}`], `${code} needs a Spanish message`);
});

test('every message referenced by the frontend exists', async () => {
  const keys = new Set();
  const attributes = await readFile(join(frontendDir, 'index.html'), 'utf8');
  for (const [, key] of attributes.matchAll(
    /data-i18n(?:-html|-label|-placeholder|-content)?="([^"]+)"/g,
  ))
    keys.add(key);
  for (const name of await readdir(frontendDir)) {
    if (!name.endsWith('.js') || name === 'i18n.js') continue;
    const source = await readFile(join(frontendDir, name), 'utf8');
    for (const [, key] of source.matchAll(/\bt\('([^']+)'/g)) keys.add(key);
  }
  assert.ok(keys.size > 50, `expected the frontend to reference messages, found ${keys.size}`);
  for (const key of keys)
    for (const { code } of languages) assert.ok(catalogs[code][key], `${code} is missing ${key}`);
});

test('the language is picked from the browser preferences', () => {
  assert.equal(preferredLanguage(['es-ES', 'en']), 'es');
  assert.equal(preferredLanguage(['es-419']), 'es');
  assert.equal(preferredLanguage(['EN-gb']), 'en');
  assert.equal(preferredLanguage(['fr-FR', 'de']), undefined);
});

test('translations interpolate values and fall back to English', (context) => {
  context.after(() => applyLanguage('en'));
  applyLanguage('es');
  assert.equal(t('landing.dropTitle'), 'Suelta un archivo.');
  assert.equal(
    t('upload.tooLarge', { size: '2 GiB' }),
    'Este archivo es demasiado grande. El límite es 2 GiB.',
  );
  assert.equal(
    t('upload.tooLarge', { other: 'x' }),
    'Este archivo es demasiado grande. El límite es {size}.',
  );
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(t('missing.key'), 'missing.key');
  } finally {
    console.warn = warn;
  }
  applyLanguage('en');
  assert.equal(t('landing.dropTitle'), 'Drop a file.');
});
