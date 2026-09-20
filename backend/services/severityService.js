/**
 * Transparent, deterministic severity assessment for YOLO road-damage detections.
 *
 * This is NOT a trained severity model and is NOT a YOLO output. It derives an
 * application-level severity score from observable detection evidence.
 */

const COVERAGE_WEIGHT = 40;
const COUNT_WEIGHT = 25;
const TYPE_WEIGHT = 20;
const CONFIDENCE_WEIGHT = 15;
const COVERAGE_SATURATION = 0.30;

const LEVELS = Object.freeze({
  LOW_MAX: 34,
  MEDIUM_MAX: 64
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isValidDetection = (detection) => {
  if (!detection || !['pothole', 'crack'].includes(detection.type)) return false;

  const confidence = Number(detection.confidence);
  const box = detection.boundingBox;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return false;
  if (!box || typeof box !== 'object') return false;

  const { x, y, width, height } = box;
  if (![x, y, width, height].every(Number.isFinite)) return false;
  if (x < 0 || y < 0 || width <= 0 || height <= 0) return false;
  if (x > 1 || y > 1 || width > 1 || height > 1) return false;
  if (x + width > 1 || y + height > 1) return false;

  return true;
};

const getSeverityLevel = (score) => {
  if (score <= LEVELS.LOW_MAX) return 'low';
  if (score <= LEVELS.MEDIUM_MAX) return 'medium';
  return 'high';
};

const buildExplanation = ({ level, damageCount, potholeCount, crackCount, damageCoverage, maxConfidence }) => {
  if (damageCount === 0) {
    return 'Automated analysis did not detect road damage meeting the configured confidence threshold. This does not guarantee that the road is free of damage.';
  }

  const coveragePercent = Math.round(damageCoverage * 100);
  const confidencePercent = Math.round(maxConfidence * 100);
  const types = [
    potholeCount > 0 ? `${potholeCount} pothole${potholeCount === 1 ? '' : 's'}` : null,
    crackCount > 0 ? `${crackCount} crack${crackCount === 1 ? '' : 's'}` : null
  ].filter(Boolean).join(' and ');

  if (level === 'high') {
    return `High severity is assigned because ${damageCount} road-damage detection${damageCount === 1 ? '' : 's'} were found (${types}), with detected regions covering approximately ${coveragePercent}% of the image and a highest detection confidence of ${confidencePercent}%.`;
  }

  if (level === 'medium') {
    return `Medium severity is assigned based on ${damageCount} detected road-damage region${damageCount === 1 ? '' : 's'} (${types}), their image coverage of approximately ${coveragePercent}%, and a highest detection confidence of ${confidencePercent}%.`;
  }

  return `Low severity is assigned because the detected damage evidence is limited (${types}), covering approximately ${coveragePercent}% of the image with a highest detection confidence of ${confidencePercent}%.`;
};

const calculateSeverity = (detections) => {
  const validDetections = Array.isArray(detections)
    ? detections.filter(isValidDetection)
    : [];

  if (validDetections.length === 0) {
    return {
      score: 0,
      level: 'low',
      factors: {
        damageCount: 0,
        potholeCount: 0,
        crackCount: 0,
        maxConfidence: 0,
        damageCoverage: 0
      },
      explanation: buildExplanation({
        level: 'low',
        damageCount: 0,
        potholeCount: 0,
        crackCount: 0,
        damageCoverage: 0,
        maxConfidence: 0
      })
    };
  }

  const damageCount = validDetections.length;
  const potholeCount = validDetections.filter(d => d.type === 'pothole').length;
  const crackCount = validDetections.filter(d => d.type === 'crack').length;
  const maxConfidence = Math.max(...validDetections.map(d => d.confidence));
  const damageCoverage = clamp(
    validDetections.reduce((sum, d) => sum + (d.boundingBox.width * d.boundingBox.height), 0),
    0,
    1
  );

  const coverageScore = Math.min(damageCoverage / COVERAGE_SATURATION, 1) * COVERAGE_WEIGHT;
  const countScore = damageCount === 1 ? 8 : damageCount === 2 ? 16 : COUNT_WEIGHT;
  const typeScore = potholeCount > 0 && crackCount > 0
    ? TYPE_WEIGHT
    : potholeCount > 0
      ? 15
      : 10;
  const confidenceScore = maxConfidence * CONFIDENCE_WEIGHT;

  const rawScore = coverageScore + countScore + typeScore + confidenceScore;
  const score = Math.round(clamp(rawScore, 0, 100));
  const level = getSeverityLevel(score);

  const factors = {
    damageCount,
    potholeCount,
    crackCount,
    maxConfidence: Number(maxConfidence.toFixed(4)),
    damageCoverage: Number(damageCoverage.toFixed(4)),
    coverageScore: Number(coverageScore.toFixed(2)),
    countScore,
    typeScore,
    confidenceScore: Number(confidenceScore.toFixed(2))
  };

  return {
    score,
    level,
    factors,
    explanation: buildExplanation({
      level,
      damageCount,
      potholeCount,
      crackCount,
      damageCoverage,
      maxConfidence
    })
  };
};

module.exports = {
  calculateSeverity,
  isValidDetection,
  getSeverityLevel,
  COVERAGE_WEIGHT,
  COUNT_WEIGHT,
  TYPE_WEIGHT,
  CONFIDENCE_WEIGHT,
  COVERAGE_SATURATION
};
