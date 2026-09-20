/**
 * Route-level tests for POST /api/reports and POST /api/ai/reanalyze/:id.
 *
 * The REAL detector (Python + YOLO model) and the REAL aiService run. Only the
 * things that need external infrastructure are stubbed: MongoDB models, JWT auth
 * and the Cloudinary upload (so no credentials/database are needed).
 * This is not a full end-to-end test; see ml/README.md for the manual E2E steps.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const express = require('express');
const fetch = require('node-fetch');

// ── stubs (installed in require.cache before the routes are loaded) ──
const calls = { destroyed: [], created: [] };
const stub = (rel, exports) => {
  const p = require.resolve(rel);
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
stub('../config/cloudinary', {
  cloudinary: { uploader: { destroy: async (id) => { calls.destroyed.push(id); return { result: 'ok' }; } } },
  // Fake upload: "uploaded" image URL comes from the x-image-url header; no header => no file.
  upload: { single: () => (req, res, next) => {
    const url = req.headers['x-image-url'];
    if (url) req.file = { path: url, filename: 'cloudinary_public_id_123' };
    next();
  } }
});
stub('../middleware/auth', {
  protect: (req, res, next) => { req.user = { _id: 'user1', role: 'citizen' }; next(); },
  restrictTo: () => (req, res, next) => next()
});
const fakeReport = (data) => ({ _id: 'rep1', ...data, populate: async function () { return this; }, save: async function () { return this; } });
stub('../models/Report', {
  create: async (data) => { calls.created.push(data); return fakeReport(data); },
  findById: async (id) => (id === 'rep1' ? fakeReport({ imageUrl: global.__reanalyzeUrl, description: '', aiAnalysis: {} }) : null)
});
stub('../models/User', { findByIdAndUpdate: async () => ({}) });

const reportsRouter = require('../routes/reports');
const aiRouter = require('../routes/ai');

// ── helpers ──
const { Buffer } = require('buffer');
const crc32 = (buf) => { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const greyPng = (() => {
  const s = 256, ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(s * 3, 128)]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(s).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
})();

let app, appServer, imgServer, base, imgBase;
test.before(async () => {
  app = express();
  app.use(express.json());
  app.use('/api/reports', reportsRouter);
  app.use('/api/ai', aiRouter);
  appServer = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  base = `http://127.0.0.1:${appServer.address().port}`;
  imgServer = http.createServer((req, res) => {
    if (req.url === '/grey.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(greyPng); }
    else if (req.url === '/corrupt.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(Buffer.from('not an image at all')); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => imgServer.listen(0, '127.0.0.1', r));
  imgBase = `http://127.0.0.1:${imgServer.address().port}`;
});
test.after(() => { appServer.close(); imgServer.close(); });
test.beforeEach(() => { calls.destroyed.length = 0; calls.created.length = 0; });

const submit = (headers = {}) => fetch(`${base}/api/reports`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ latitude: '30.3', longitude: '78.0', description: 'test' })
});

test('POST /reports with no image -> 400, nothing created', async () => {
  const res = await submit();
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /upload a road image/i);
  assert.equal(calls.created.length, 0);
});

test('POST /reports, model finds nothing -> 201, empty detectedIssues, placeholder severity, report kept', async () => {
  const res = await submit({ 'x-image-url': `${imgBase}/grey.png` });
  assert.equal(res.status, 201);
  const { report } = await res.json();
  assert.deepEqual(report.aiAnalysis.detectedIssues, []);
  assert.equal(report.aiAnalysis.primaryIssue, 'unknown');
  assert.equal(report.aiAnalysis.overallConfidence, 0);
  assert.match(report.aiAnalysis.aiExplanation, /did not detect/i);
  assert.equal(calls.created.length, 1);
  assert.equal(calls.destroyed.length, 0, 'a successfully analysed upload must not be deleted');
});

test('POST /reports with corrupt image -> 422 INVALID_IMAGE, Cloudinary asset deleted, nothing saved', async () => {
  const res = await submit({ 'x-image-url': `${imgBase}/corrupt.jpg` });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).code, 'INVALID_IMAGE');
  assert.equal(calls.created.length, 0);
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(calls.destroyed, ['cloudinary_public_id_123']);
});

test('POST /reports when the uploaded image cannot be fetched -> 502, asset deleted', async () => {
  const res = await submit({ 'x-image-url': `${imgBase}/gone.jpg` });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).code, 'IMAGE_FETCH_FAILED');
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(calls.destroyed, ['cloudinary_public_id_123']);
  assert.equal(calls.created.length, 0);
});

test('POST /reports when model weights are missing -> 503 MODEL_UNAVAILABLE, asset deleted, nothing saved', async () => {
  const saved = process.env.ROAD_DAMAGE_MODEL_PATH;
  process.env.ROAD_DAMAGE_MODEL_PATH = path.join(__dirname, 'no-such-model.pt');
  try {
    const res = await submit({ 'x-image-url': `${imgBase}/grey.png` });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'MODEL_UNAVAILABLE');
    assert.match(body.error, /download_model/);
  } finally { if (saved === undefined) delete process.env.ROAD_DAMAGE_MODEL_PATH; else process.env.ROAD_DAMAGE_MODEL_PATH = saved; }
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(calls.destroyed, ['cloudinary_public_id_123']);
  assert.equal(calls.created.length, 0);
});

test('POST /reports on inference timeout -> 504 INFERENCE_TIMEOUT, asset deleted', async () => {
  const saved = process.env.ROAD_DAMAGE_TIMEOUT_MS;
  process.env.ROAD_DAMAGE_TIMEOUT_MS = '50';
  try {
    const res = await submit({ 'x-image-url': `${imgBase}/grey.png` });
    assert.equal(res.status, 504);
    assert.equal((await res.json()).code, 'INFERENCE_TIMEOUT');
  } finally { if (saved === undefined) delete process.env.ROAD_DAMAGE_TIMEOUT_MS; else process.env.ROAD_DAMAGE_TIMEOUT_MS = saved; }
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(calls.destroyed, ['cloudinary_public_id_123']);
});

test('POST /ai/reanalyze/:id returns the error status (422) instead of always 400', async () => {
  global.__reanalyzeUrl = `${imgBase}/corrupt.jpg`;
  const res = await fetch(`${base}/api/ai/reanalyze/rep1`, { method: 'POST' });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).code, 'INVALID_IMAGE');
});

test('POST /ai/reanalyze/:id success path with real model', async () => {
  global.__reanalyzeUrl = `${imgBase}/grey.png`;
  const res = await fetch(`${base}/api/ai/reanalyze/rep1`, { method: 'POST' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.aiAnalysis.detectedIssues, []);
});

test('unknown report id still -> 404', async () => {
  const res = await fetch(`${base}/api/ai/reanalyze/does-not-exist`, { method: 'POST' });
  assert.equal(res.status, 404);
});
