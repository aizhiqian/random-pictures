const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const request = require('supertest');

const app = require('./api/randomImage');

const apiDir = path.join(__dirname, 'api');
const emptyCategory = '__empty_category_test__';
const badGlobalCategory = '__bad_global_test__';
const emptyFilePath = path.join(apiDir, `${emptyCategory}.txt`);
const badGlobalFilePath = path.join(apiDir, `${badGlobalCategory}.txt`);
const clearCaches = app._internal && app._internal.clearCaches
  ? app._internal.clearCaches
  : () => {};

let existingCategory = '';

test.before(async () => {
  const files = await fs.readdir(apiDir);
  const txtFile = files.find((file) => file.endsWith('.txt') && !file.startsWith('__'));

  if (!txtFile) {
    throw new Error('No category txt file found for tests');
  }

  existingCategory = path.basename(txtFile, '.txt');

  await fs.writeFile(
    emptyFilePath,
    '\n\njavascript:alert(1)\nftp://example.com/image.jpg\n',
    'utf8',
  );

  await fs.writeFile(
    badGlobalFilePath,
    'javascript:alert(1)\n\n',
    'utf8',
  );

  clearCaches();
});

test.after(async () => {
  await Promise.allSettled([
    fs.unlink(emptyFilePath),
    fs.unlink(badGlobalFilePath),
  ]);

  clearCaches();
});

test('GET /health 返回 200', async () => {
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('GET /random 在存在异常分类文件时仍可重定向', async () => {
  clearCaches();

  const response = await request(app).get('/random');

  assert.equal(response.status, 302);
  assert.match(response.headers.location, /^https?:\/\//);
});

test('GET /:category 对已有分类返回 302', async () => {
  clearCaches();

  const response = await request(app).get(`/${existingCategory}`);

  assert.equal(response.status, 302);
  assert.match(response.headers.location, /^https?:\/\//);
});

test('GET /:category 对不存在分类返回 404', async () => {
  clearCaches();

  const response = await request(app).get('/category_not_exists_123456');

  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'CATEGORY_NOT_FOUND');
});

test('GET /:category 对非法分类名返回 400', async () => {
  clearCaches();

  const response = await request(app).get('/bad!name');

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'INVALID_CATEGORY');
});

test('GET /:category 对路径穿越样式输入返回 400', async () => {
  clearCaches();

  const response = await request(app).get('/..%5Csecret');

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'INVALID_CATEGORY');
});

test('GET /:category 对空/无有效 URL 分类返回 422', async () => {
  clearCaches();

  const response = await request(app).get(`/${emptyCategory}`);

  assert.equal(response.status, 422);
  assert.equal(response.body.error, 'CATEGORY_NO_VALID_URLS');
});
