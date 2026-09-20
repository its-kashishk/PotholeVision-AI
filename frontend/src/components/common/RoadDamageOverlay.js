import React, { useMemo } from 'react';

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value)));

const normalizeDetection = (issue) => {
  if (!issue || (issue.type !== 'pothole' && issue.type !== 'crack')) return null;

  const confidence = Number(issue.confidence);
  const box = issue.boundingBox;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (!box) return null;

  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width);
  const height = Number(box.height);

  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;

  return {
    ...issue,
    confidence,
    boundingBox: {
      x: clamp01(x),
      y: clamp01(y),
      width: Math.min(width, 1),
      height: Math.min(height, 1)
    }
  };
};

const labelFor = (type) => type === 'pothole' ? 'Pothole' : 'Crack';

export default function RoadDamageOverlay({ imageUrl, detections = [], alt = 'Road hazard' }) {
  const validDetections = useMemo(
    () => detections.map(normalizeDetection).filter(Boolean),
    [detections]
  );

  return (
    <div className="road-damage-visualization">
      <div className="road-damage-image-wrap">
        <img src={imageUrl} alt={alt} className="road-damage-image" />

        <div className="road-damage-box-layer" aria-hidden="true">
          {validDetections.map((issue, index) => {
            const { x, y, width, height } = issue.boundingBox;
            const confidence = Math.round(issue.confidence * 100);
            const label = `${labelFor(issue.type)} · ${confidence}%`;

            return (
              <div
                key={`${issue.type}-${index}-${x}-${y}`}
                className={`road-damage-box road-damage-box-${issue.type}`}
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  width: `${width * 100}%`,
                  height: `${height * 100}%`
                }}
              >
                <span className="road-damage-box-label">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DetectionSummary({ detections = [] }) {
  const validDetections = detections.map(normalizeDetection).filter(Boolean);
  const potholes = validDetections.filter((d) => d.type === 'pothole').length;
  const cracks = validDetections.filter((d) => d.type === 'crack').length;
  const highestConfidence = validDetections.length
    ? Math.max(...validDetections.map((d) => d.confidence))
    : 0;

  return (
    <div className="detection-summary">
      <div>
        <div className="detection-summary-title">AI Detection</div>
        <div className="detection-summary-count">
          {validDetections.length === 0
            ? 'No road damage detected'
            : `${validDetections.length} issue${validDetections.length === 1 ? '' : 's'} detected`}
        </div>
      </div>

      {validDetections.length > 0 && (
        <div className="detection-summary-stats">
          <span><strong>{potholes}</strong> Pothole{potholes === 1 ? '' : 's'}</span>
          <span><strong>{cracks}</strong> Crack{cracks === 1 ? '' : 's'}</span>
          <span><strong>{Math.round(highestConfidence * 100)}%</strong> Highest confidence</span>
        </div>
      )}
    </div>
  );
}
