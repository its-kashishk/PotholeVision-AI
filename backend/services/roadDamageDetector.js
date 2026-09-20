/**
 * Road-damage detector bridge (Node -> Python -> YOLOv8 model).
 *
 * detectRoadDamage(imageUrlOrPath) downloads the image to a temp file, runs
 * `ml/inference.py` in a child process and returns the model's parsed JSON.
 *
 * There is NO fallback prediction path: if anything fails this throws a
 * DetectionError carrying an HTTP status and machine-readable code.
 *
 * Config (all optional, see ml/README.md):
 *   ROAD_DAMAGE_PYTHON       python executable (default: ml/.venv if present, else python3/python)
 *   ROAD_DAMAGE_MODEL_PATH   weights path (default: ml/model/YOLOv8_Small_RDD.pt)
 *   ROAD_DAMAGE_CONF         confidence threshold (default 0.25)
 *   ROAD_DAMAGE_TIMEOUT_MS   per-inference timeout (default 60000)
 *   ROAD_DAMAGE_MAX_PARALLEL max simultaneous Python processes (default 2)
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');

const ML_DIR = path.resolve(__dirname, '..', '..', 'ml');
const INFERENCE_SCRIPT = path.join(ML_DIR, 'inference.py');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // same as the upload limit in config/cloudinary.js
const DOWNLOAD_TIMEOUT_MS = 20000;

class DetectionError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'DetectionError';
    this.code = code;
    this.status = status;
  }
}

// Python-side error code -> HTTP status
const STATUS_FOR_CODE = {
  INVALID_IMAGE: 422,
  MODEL_UNAVAILABLE: 503,
  INFERENCE_FAILED: 500
};

const resolvePython = () => {
  if (process.env.ROAD_DAMAGE_PYTHON) return process.env.ROAD_DAMAGE_PYTHON;
  const venvPython = process.platform === 'win32'
    ? path.join(ML_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(ML_DIR, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) return venvPython;
  return process.platform === 'win32' ? 'python' : 'python3';
};

// Tiny concurrency limiter: each inference process loads PyTorch (hundreds of MB of RAM).
let active = 0;
const waiting = [];
const acquire = () => new Promise((resolve) => {
  const max = parseInt(process.env.ROAD_DAMAGE_MAX_PARALLEL, 10) || 2;
  if (active < max) { active += 1; resolve(); } else { waiting.push(resolve); }
});
const release = () => {
  const next = waiting.shift();
  if (next) next(); else active -= 1;
};

const fetchToTempFile = async (url) => {
  let res;
  try {
    res = await fetch(url, { timeout: DOWNLOAD_TIMEOUT_MS, size: MAX_IMAGE_BYTES });
  } catch (err) {
    throw new DetectionError('IMAGE_FETCH_FAILED', `Could not retrieve the uploaded image for analysis: ${err.message}`, 502);
  }
  if (!res.ok) {
    throw new DetectionError('IMAGE_FETCH_FAILED', `Could not retrieve the uploaded image for analysis (HTTP ${res.status})`, 502);
  }
  let buf;
  try {
    buf = await res.buffer();
  } catch (err) {
    const tooBig = err.type === 'max-size';
    throw new DetectionError(
      tooBig ? 'INVALID_IMAGE' : 'IMAGE_FETCH_FAILED',
      tooBig ? 'Image exceeds the 10MB limit' : `Could not download the image: ${err.message}`,
      tooBig ? 422 : 502
    );
  }
  // Extension is irrelevant: the Python side identifies the format from the bytes.
  const file = path.join(os.tmpdir(), `pv-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.img`);
  await fs.promises.writeFile(file, buf);
  return file;
};

const runPython = (imagePath) => new Promise((resolve, reject) => {
  const timeoutMs = parseInt(process.env.ROAD_DAMAGE_TIMEOUT_MS, 10) || 60000;
  const args = [INFERENCE_SCRIPT, imagePath];

  let child;
  try {
    child = spawn(resolvePython(), args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch (err) {
    return reject(new DetectionError('MODEL_UNAVAILABLE', `Could not start Python: ${err.message}`, 503));
  }

  let stdout = '';
  let stderr = '';
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);

  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });

  child.on('error', (err) => {
    clearTimeout(timer);
    const missing = err.code === 'ENOENT';
    reject(new DetectionError(
      'MODEL_UNAVAILABLE',
      missing
        ? `Python interpreter not found ('${resolvePython()}'). See ml/README.md to set up the detector or set ROAD_DAMAGE_PYTHON.`
        : `Could not start the detector process: ${err.message}`,
      503
    ));
  });

  child.on('close', (code) => {
    clearTimeout(timer);
    if (timedOut) {
      return reject(new DetectionError('INFERENCE_TIMEOUT', `Road-damage analysis timed out after ${timeoutMs / 1000}s`, 504));
    }

    // Libraries can print stray lines; the contract is: last JSON line on stdout is the result.
    const jsonLine = stdout.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{')).pop();
    let parsed = null;
    if (jsonLine) {
      try { parsed = JSON.parse(jsonLine); } catch (_) { /* handled below */ }
    }

    if (!parsed) {
      return reject(new DetectionError(
        'INFERENCE_FAILED',
        `Detector produced no valid result (exit code ${code}). ${stderr.trim().split('\n').pop() || ''}`.trim(),
        500
      ));
    }
    if (!parsed.success) {
      const { code: errCode = 'INFERENCE_FAILED', message = 'Inference failed' } = parsed.error || {};
      return reject(new DetectionError(errCode, message, STATUS_FOR_CODE[errCode] || 500));
    }
    if (code !== 0 || !Array.isArray(parsed.detections)) {
      return reject(new DetectionError('INFERENCE_FAILED', 'Detector returned a malformed result', 500));
    }
    resolve(parsed);
  });
});

/**
 * @param {string} imageSource  http(s) URL (e.g. Cloudinary) or an existing local file path
 * @returns {Promise<object>} parsed output of ml/inference.py (detections, detected, image, model, ...)
 * @throws {DetectionError}
 */
const detectRoadDamage = async (imageSource) => {
  if (!imageSource || typeof imageSource !== 'string') {
    throw new DetectionError('INVALID_IMAGE', 'No image provided for analysis', 400);
  }

  const isUrl = /^https?:\/\//i.test(imageSource);
  let tempFile = null;
  let imagePath = imageSource;

  if (isUrl) {
    tempFile = await fetchToTempFile(imageSource);
    imagePath = tempFile;
  } else if (!fs.existsSync(imageSource)) {
    throw new DetectionError('INVALID_IMAGE', 'Image file not found', 400);
  }

  await acquire();
  try {
    return await runPython(imagePath);
  } finally {
    release();
    if (tempFile) fs.promises.unlink(tempFile).catch(() => {});
  }
};

module.exports = { detectRoadDamage, DetectionError };