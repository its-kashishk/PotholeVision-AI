const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateSeverity,
  getSeverityLevel
} = require('../services/severityService');

const detection = (type = 'pothole', confidence = 0.8, width = 0.1, height = 0.1) => ({
  type,
  confidence,
  boundingBox: { x: 0.1, y: 0.1, width, height }
});

test('empty detections -> score 0 and low', () => {
  const result = calculateSeverity([]);
  assert.equal(result.score, 0);
  assert.equal(result.level, 'low');
  assert.equal(result.factors.damageCount, 0);
});

test('undefined detections are handled safely', () => {
  const result = calculateSeverity(undefined);
  assert.equal(result.score, 0);
  assert.equal(result.level, 'low');
});

test('one small crack produces a valid low severity assessment', () => {
  const result = calculateSeverity([detection('crack', 0.8, 0.05, 0.05)]);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.level, 'low');
  assert.equal(result.factors.crackCount, 1);
});

test('one pothole produces a valid severity assessment', () => {
  const result = calculateSeverity([detection('pothole', 0.9, 0.2, 0.2)]);
  assert.ok(result.score > 0);
  assert.ok(['low', 'medium', 'high'].includes(result.level));
  assert.equal(result.factors.potholeCount, 1);
});

test('multiple potholes score higher than a single comparable pothole', () => {
  const one = calculateSeverity([detection('pothole', 0.8, 0.1, 0.1)]);
  const many = calculateSeverity([
    detection('pothole', 0.8, 0.1, 0.1),
    detection('pothole', 0.8, 0.1, 0.1),
    detection('pothole', 0.8, 0.1, 0.1)
  ]);
  assert.ok(many.score > one.score);
  assert.equal(many.factors.potholeCount, 3);
});

test('pothole + crack receives the mixed-damage type contribution', () => {
  const result = calculateSeverity([
    detection('pothole', 0.8, 0.1, 0.1),
    detection('crack', 0.8, 0.05, 0.05)
  ]);
  assert.equal(result.factors.typeScore, 20);
  assert.equal(result.factors.potholeCount, 1);
  assert.equal(result.factors.crackCount, 1);
});

test('larger bounding-box coverage increases the score', () => {
  const small = calculateSeverity([detection('pothole', 0.8, 0.05, 0.05)]);
  const large = calculateSeverity([detection('pothole', 0.8, 0.25, 0.25)]);
  assert.ok(large.score > small.score);
  assert.ok(large.factors.damageCoverage > small.factors.damageCoverage);
});

test('higher confidence increases the score when other evidence is equal', () => {
  const low = calculateSeverity([detection('pothole', 0.4, 0.1, 0.1)]);
  const high = calculateSeverity([detection('pothole', 0.9, 0.1, 0.1)]);
  assert.ok(high.score > low.score);
});

test('invalid confidence is ignored safely', () => {
  const result = calculateSeverity([
    detection('pothole', 1.2, 0.2, 0.2),
    detection('crack', 0.8, 0.05, 0.05)
  ]);
  assert.equal(result.factors.damageCount, 1);
  assert.equal(result.factors.crackCount, 1);
});

test('invalid bounding box is ignored safely', () => {
  const result = calculateSeverity([
    { type: 'pothole', confidence: 0.9, boundingBox: { x: 0, y: 0, width: 1.2, height: 0.2 } },
    detection('crack', 0.8, 0.05, 0.05)
  ]);
  assert.equal(result.factors.damageCount, 1);
  assert.equal(result.factors.crackCount, 1);
});

test('score is always clamped between 0 and 100', () => {
  const detections = Array.from({ length: 20 }, (_, i) => detection(
    i % 2 === 0 ? 'pothole' : 'crack',
    1,
    0.5,
    0.5
  ));
  const result = calculateSeverity(detections);
  assert.ok(result.score >= 0 && result.score <= 100);
});

test('severity threshold 34 is low', () => {
  assert.equal(getSeverityLevel(34), 'low');
});

test('severity threshold 35 is medium', () => {
  assert.equal(getSeverityLevel(35), 'medium');
});

test('severity threshold 64 is medium', () => {
  assert.equal(getSeverityLevel(64), 'medium');
});

test('severity threshold 65 is high', () => {
  assert.equal(getSeverityLevel(65), 'high');
});

test('same detections always produce the same result', () => {
  const input = [
    detection('pothole', 0.87, 0.28, 0.19),
    detection('crack', 0.72, 0.22, 0.08)
  ];
  assert.deepEqual(calculateSeverity(input), calculateSeverity(input));
});
