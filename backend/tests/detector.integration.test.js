/**
 * Integration tests: Node service -> Python -> real YOLOv8 road-damage model.
 * Run from /backend:  npm test
 *
 * Requires the ML setup from ml/README.md (deps + downloaded weights).
 *
 * Optional: set ROAD_DAMAGE_TEST_POTHOLE_IMAGE=/path/to/photo-of-a-pothole.jpg to
 * also run the positive-detection tests. No road photos are committed to the repo
 * (licensing), so those tests are skipped, and reported as skipped, without it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');

const { detectRoadDamage, DetectionError } = require('../services/roadDamageDetector');
const { analyzeRoadImage, generateRoadExplanation } = require('../services/aiService');

const POTHOLE_IMAGE = process.env.ROAD_DAMAGE_TEST_POTHOLE_IMAGE;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-test-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Minimal valid PNG (flat grey 256x256) built by hand so no image library is needed.
const crc32 = (buf) => {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const makeGreyPng = (size = 256) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 128)]);
  const raw = Buffer.concat(Array(size).fill(row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
};

const greyPng = path.join(tmp, 'grey.png');
fs.writeFileSync(greyPng, makeGreyPng());
const garbage = path.join(tmp, 'garbage.jpg');
fs.writeFileSync(garbage, Buffer.from('this is definitely not a jpeg'));

// Run fn with temporary env overrides (the detector reads env at call time).
const withEnv = async (vars, fn) => {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; process.env[k] = vars[k]; }
  try { return await fn(); } finally {
    for (const k of Object.keys(vars)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
};
const rejectsWith = async (promise, code, status) => {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof DetectionError, `expected DetectionError, got ${err && err.name}: ${err && err.message}`);
    assert.equal(err.code, code);
    assert.equal(err.status, status);
    return true;
  });
};

// ── Real model, output contract ────────────────────────────
test('real model runs on a valid image and returns the documented JSON contract', async () => {
  const out = await detectRoadDamage(greyPng);
  assert.equal(out.success, true);
  assert.ok(Array.isArray(out.detections));
  assert.equal(out.detected, out.detections.length > 0);
  assert.deepEqual(out.image, { width: 256, height: 256 });
  assert.match(out.model.framework, /ultralytics .* \/ torch /);
  assert.equal(typeof out.inference_ms, 'number');
  // A flat grey image contains no road damage: the model must not invent any.
  assert.equal(out.detections.length, 0);
  assert.equal(out.detected, false);
});

test('aiService.analyzeRoadImage: no detections -> empty issues, unknown primary, no invented values', async () => {
  const r = await analyzeRoadImage(greyPng);
  assert.deepEqual(r.detectedIssues, []);
  assert.equal(r.primaryIssue, 'unknown');
  assert.equal(r.overallConfidence, 0);
  // severity is the documented TEMPORARY placeholder, not a prediction
  assert.equal(r.severityScore, 0);
  assert.equal(r.severityLevel, 'low');
});

test('aiService.generateRoadExplanation: no detections -> static message, no LLM/hallucinated damage', async () => {
  const r = await analyzeRoadImage(greyPng);
  const { explanation, safetyPrecautions } = await generateRoadExplanation(r, 'big hole here');
  assert.match(explanation, /did not detect/i);
  assert.match(explanation, /big hole here/);
  assert.ok(safetyPrecautions.length > 0);
  assert.ok(!/pothole/i.test(safetyPrecautions.join(' ')));
});

test('aiService source contains no random number generation', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'aiService.js'), 'utf8');
  assert.ok(!/Math\.random/.test(src));
});

// ── Positive detection (needs a real pothole photo supplied by the developer) ──
test('real model detects damage and aiService maps it to the report schema', { skip: !POTHOLE_IMAGE && 'set ROAD_DAMAGE_TEST_POTHOLE_IMAGE to run' }, async () => {
  const raw = await detectRoadDamage(POTHOLE_IMAGE);
  assert.equal(raw.detected, true);
  for (const d of raw.detections) {
    assert.ok(['pothole', 'crack'].includes(d.class));
    assert.ok(d.confidence > 0 && d.confidence <= 1);
    assert.ok(d.bbox.width > 0 && d.bbox.height > 0);
  }

  const r = await analyzeRoadImage(POTHOLE_IMAGE);
  assert.ok(r.detectedIssues.length >= 1);
  assert.equal(r.primaryIssue, r.detectedIssues[0].type);
  assert.equal(r.overallConfidence, r.detectedIssues[0].confidence); // == real model confidence
  assert.equal(r.overallConfidence, raw.detections[0].confidence);
  const b = r.detectedIssues[0].boundingBox;
  for (const k of ['x', 'y', 'width', 'height']) assert.ok(b[k] >= 0 && b[k] <= 1);
  assert.equal(r.severityLevel, 'medium'); // TEMPORARY placeholder, see aiService.js
});

// ── URL download path (Cloudinary-style) ───────────────────
test('downloads an image from an http URL, runs the model, and cleans up the temp file', async () => {
  const before = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('pv-') && f.endsWith('.img'));
  const png = makeGreyPng();
  const server = http.createServer((req, res) => {
    if (req.url === '/ok.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(png); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const out = await detectRoadDamage(`${base}/ok.png`);
    assert.equal(out.success, true);
    assert.deepEqual(out.image, { width: 256, height: 256 });
    await rejectsWith(detectRoadDamage(`${base}/missing.png`), 'IMAGE_FETCH_FAILED', 502);
  } finally { server.close(); }
  await new Promise((r) => setTimeout(r, 200));
  const after = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('pv-') && f.endsWith('.img'));
  assert.deepEqual(after.sort(), before.sort(), 'temp files were left behind');
});

// ── Error handling ─────────────────────────────────────────
test('missing image -> INVALID_IMAGE 400', async () => {
  await rejectsWith(detectRoadDamage(undefined), 'INVALID_IMAGE', 400);
  await rejectsWith(detectRoadDamage(path.join(tmp, 'nope.jpg')), 'INVALID_IMAGE', 400);
});

test('corrupt / non-image file -> INVALID_IMAGE 422', async () => {
  await rejectsWith(detectRoadDamage(garbage), 'INVALID_IMAGE', 422);
});

test('unsupported format (GIF) -> INVALID_IMAGE 422', async () => {
  const gif = path.join(tmp, 'x.gif');
  fs.writeFileSync(gif, Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  await rejectsWith(detectRoadDamage(gif), 'INVALID_IMAGE', 422);
});

test('model weights missing -> MODEL_UNAVAILABLE 503', async () => {
  await withEnv({ ROAD_DAMAGE_MODEL_PATH: path.join(tmp, 'no-such-model.pt') }, () =>
    rejectsWith(detectRoadDamage(greyPng), 'MODEL_UNAVAILABLE', 503));
});

test('python interpreter not found -> MODEL_UNAVAILABLE 503', async () => {
  await withEnv({ ROAD_DAMAGE_PYTHON: path.join(tmp, 'no-such-python') }, () =>
    rejectsWith(detectRoadDamage(greyPng), 'MODEL_UNAVAILABLE', 503));
});

test('python process crashes without JSON -> INFERENCE_FAILED 500', { skip: process.platform === 'win32' }, async () => {
  const crash = path.join(tmp, 'crash.sh');

  fs.writeFileSync(
    crash,
    '#!/bin/sh\necho "Traceback: boom" >&2\nexit 1\n',
    { mode: 0o755 }
  );

  await withEnv(
    { ROAD_DAMAGE_PYTHON: crash },
    () => rejectsWith(
      detectRoadDamage(greyPng),
      'INFERENCE_FAILED',
      500
    )
  );
});

test('inference timeout -> INFERENCE_TIMEOUT 504 (process is killed)', async () => {
  await withEnv({ ROAD_DAMAGE_TIMEOUT_MS: '50' }, () =>
    rejectsWith(detectRoadDamage(greyPng), 'INFERENCE_TIMEOUT', 504));
});
