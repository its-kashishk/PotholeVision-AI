const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeDetections } = require('../services/aiService');

test('sanitizeDetections keeps valid pothole/crack detections and sorts by confidence', () => {
  const detections = sanitizeDetections([
    { class: 'crack', confidence: 0.62, bbox_normalized: { x: 0.2, y: 0.3, width: 0.2, height: 0.1 } },
    { class: 'pothole', confidence: 0.91, bbox_normalized: { x: 0.1, y: 0.2, width: 0.3, height: 0.25 } }
  ]);

  assert.equal(detections.length, 2);
  assert.equal(detections[0].type, 'pothole');
  assert.equal(detections[0].confidence, 0.91);
  assert.deepEqual(detections[1].boundingBox, { x: 0.2, y: 0.3, width: 0.2, height: 0.1 });
});

test('sanitizeDetections rejects unsupported types and malformed confidence/boxes', () => {
  const detections = sanitizeDetections([
    { class: 'waterlogging', confidence: 0.9, bbox_normalized: { x: 0, y: 0, width: 1, height: 1 } },
    { class: 'pothole', confidence: 1.2, bbox_normalized: { x: 0, y: 0, width: 1, height: 1 } },
    { class: 'crack', confidence: 0.8, bbox_normalized: { x: 0.8, y: 0, width: 0.3, height: 0.2 } },
    { class: 'pothole', confidence: 0.7, bbox_normalized: { x: 0, y: 0, width: 0, height: 0.2 } },
    null
  ]);

  assert.deepEqual(detections, []);
});

test('sanitizeDetections returns an empty array for missing or non-array input', () => {
  assert.deepEqual(sanitizeDetections(undefined), []);
  assert.deepEqual(sanitizeDetections(null), []);
  assert.deepEqual(sanitizeDetections({}), []);
});
