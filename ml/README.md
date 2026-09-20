# Road-damage detection (`ml/`)

Real computer-vision inference for PotholeVision AI.

```
Frontend → Express (routes/reports.js, routes/ai.js)
        → services/aiService.js  analyzeRoadImage()
        → services/roadDamageDetector.js   (downloads image, spawns Python, 60 s timeout)
        → ml/inference.py                  (validates image, runs model, prints ONE JSON)
        → YOLOv8s weights (ml/model/YOLOv8_Small_RDD.pt)
        → detections → Report.aiAnalysis
```

Every detection comes from model inference. There is **no** fallback or demo prediction path:
if the model finds nothing the result is `{"detected": false, "detections": []}`, and if anything
fails the API returns an error.

## Setup

Requirements: Python 3.10+ (tested on 3.12), Node 18+ (tested on 22). CPU is enough; a CUDA GPU is used
automatically if PyTorch can see one.

```bash
# from the repository root
python3 -m venv ml/.venv
source ml/.venv/bin/activate            # Windows: ml\.venv\Scripts\activate
pip install -r ml/requirements.txt      # pulls PyTorch; several hundred MB

python ml/download_model.py             # ~90 MB from a pinned GitHub commit; SHA-256 verified
```

The backend automatically uses `ml/.venv` if it exists. Otherwise set `ROAD_DAMAGE_PYTHON`.

> Disk note: the default PyTorch wheel from PyPI on Linux bundles CUDA libraries (several GB). For a
> smaller CPU-only install use the CPU index from https://pytorch.org/get-started/locally/ **before**
> `pip install -r ml/requirements.txt`.

## Run the model directly

```bash
python ml/inference.py path/to/road.jpg [--conf 0.25]
```

Example output (abridged):

```json
{
  "success": true,
  "detected": true,
  "detections": [
    {
      "class": "pothole",
      "model_class": "Potholes",
      "class_id": 3,
      "confidence": 0.77,
      "bbox": { "x": 651.1, "y": 516.5, "width": 306.1, "height": 153.5 },
      "bbox_normalized": { "x": 0.5426, "y": 0.5764, "width": 0.2551, "height": 0.1713 }
    }
  ],
  "image": { "width": 1200, "height": 896 },
  "model": { "name": "...", "weights": "YOLOv8_Small_RDD.pt", "conf_threshold": 0.25, "imgsz": 640 },
  "inference_ms": 1355
}
```

`bbox` is in pixels (top-left origin) of the EXIF-corrected image; `bbox_normalized` is 0–1 and is what the
app stores. On failure: `{"success": false, "error": {"code", "message"}}` with exit code 2 (bad image),
3 (model/dependencies unavailable) or 4 (inference failed).

## Configuration (environment variables, all optional)

| Variable | Default | Meaning |
|---|---|---|
| `ROAD_DAMAGE_PYTHON` | `ml/.venv` python, else `python3` / `python` | Python executable |
| `ROAD_DAMAGE_MODEL_PATH` | `ml/model/YOLOv8_Small_RDD.pt` | Weights file |
| `ROAD_DAMAGE_CONF` | `0.25` | Confidence threshold (lower = more detections and more false positives) |
| `ROAD_DAMAGE_TIMEOUT_MS` | `60000` | Kill inference after this long |
| `ROAD_DAMAGE_MAX_PARALLEL` | `2` | Max simultaneous Python processes (each loads PyTorch) |

## API behaviour

| Situation | HTTP | `code` |
|---|---|---|
| Damage found | 201 | – |
| Model ran, found nothing | 201 (report kept, empty `detectedIssues`, flagged for manual review) | – |
| No image uploaded | 400 | – |
| Corrupt / unreadable / unsupported (not JPEG, PNG, WEBP) image | 422 | `INVALID_IMAGE` |
| Uploaded image could not be downloaded for analysis | 502 | `IMAGE_FETCH_FAILED` |
| Weights or Python dependencies missing, Python not found | 503 | `MODEL_UNAVAILABLE` |
| Inference exceeded the timeout | 504 | `INFERENCE_TIMEOUT` |
| Python crashed / malformed output | 500 | `INFERENCE_FAILED` |

On any 4xx/5xx from the analysis step nothing is saved and the already-uploaded Cloudinary image is deleted
(best effort). `POST /api/ai/reanalyze/:id` returns the same statuses.

**Field mapping into the existing report schema**

| Report field | Source |
|---|---|
| `detectedIssues[].type` | model class mapped to `pothole` or `crack` (Longitudinal / Transverse / Alligator Crack → `crack`) |
| `detectedIssues[].confidence`, `overallConfidence` | model confidence (`overallConfidence` = top detection) |
| `detectedIssues[].boundingBox` | `bbox_normalized` |
| `primaryIssue` | highest-confidence detection, or `unknown` if none |
| `severityScore`, `severityLevel` | **TEMPORARY placeholder, NOT model output** (50/medium if something was detected, 0/low if not). The model does not predict severity. Real handling is planned for Phase 3. |

## Tests

```bash
cd backend
npm install
npm test        # 22 tests: real model via Node, aiService, route status codes, error paths
```

To also run the positive-detection test, point it at any photo of a pothole (none are committed):

```bash
ROAD_DAMAGE_TEST_POTHOLE_IMAGE=/path/to/pothole.jpg npm test
```

The route tests stub only MongoDB, JWT auth and the Cloudinary upload; the detector, Python and the model
are real. They are **not** a full end-to-end test with a real database, Cloudinary and the React app.

## Model card

| | |
|---|---|
| Model | `YOLOv8_Small_RDD.pt`, YOLOv8s object detector |
| Source | https://github.com/oracl4/RoadDamageDetection (`models/YOLOv8_Small_RDD.pt`), pinned to commit `c0e8b7c35b22f27273ef8625111a7cd63e3c9359` |
| Weights SHA-256 | `7f2ceb8f6f3dfcc8fffd98cb488281be725150aed0f06cf21c4db72b5cd0a62b` |
| Training | Third-party fine-tune (not trained for this project): COCO-pretrained `yolov8s.pt`, 100 epochs, 640 px, per the author's training notebook/checkpoint metadata |
| Training data | Road Damage Dataset 2022 (CRDDC2022), filtered **Japan + India** subsets |
| Classes | Longitudinal Crack, Transverse Crack, Alligator Crack, Potholes |
| Framework | Ultralytics 8.4.157 / PyTorch (tested 2.5.1, CPU) |
| Author-reported validation | mAP@0.5 = 0.547 overall, 0.524 for potholes (from the PR curve in the source repo; **not** measured by this project) |

### Limitations (please read)

- **Accuracy is modest.** The author's own validation is mAP@0.5 ≈ 0.55. No accuracy figure for real
  PotholeVision uploads exists; do not quote one.
- **Informal spot-check (ours, not a benchmark):** on 133 labelled pothole photos from an unrelated public
  dataset (Roboflow "pothole-detection-bfeeg", CC BY 4.0) at threshold 0.25, at least one pothole was
  detected in 87/133 images (65%), and 115 of 394 labelled potholes (29%) were matched at IoU ≥ 0.5;
  about 68% of predicted potholes matched a labelled box. Labelling conventions differ between datasets, so
  read this as "recall is clearly incomplete", not as a measured accuracy.
- **Misses happen, including in obvious photos.** In one test photo with two large potholes only one was
  found at the default threshold (the other scored 0.16).
- **False positives happen.** A road crop with faint hairline cracking produced an "Alligator Crack" at 0.35.
- **Unsupported damage:** waterlogging, broken surface, debris, manholes, road markings, etc. The app schema
  lists `waterlogging` and `broken_surface`, but this model never outputs them.
- **Training distribution:** dashcam / phone-style photos of Japanese and Indian roads. Night, rain, heavy
  shadow, close-ups and unusual angles are likely to perform worse (untested).
- **Speed:** a Node → Python call takes about 3.7 s on a 1-CPU sandbox (≈1.3 s is model inference; the rest is
  starting Python and loading PyTorch and the weights for every request). A persistent worker would remove
  most of that; not done in Phase 1.
- **Security note:** `.pt` files are Python pickles. Only load weights you trust; `download_model.py`
  refuses files whose SHA-256 does not match.
- The `.pt` checkpoint is 89 MB (it appears to include training state); a stripped export would be smaller.

## Licensing information (documentation only, not a legal conclusion)

Facts below were checked on 2026-09-20. **Have someone qualified review this before any public distribution
or commercial use.**

| Component | What is declared / found | Flag |
|---|---|---|
| **Weights repo** `oracl4/RoadDamageDetection` | **No LICENSE file** at the pinned commit (LICENSE, LICENSE.md, LICENSE.txt, COPYING all 404). Its README only says the project follows the Ultralytics and Streamlit licenses and credits the CRDDC2022 dataset. | ⚠ Redistribution / reuse terms for the fine-tuned weights are not explicitly stated. Consider asking the author, or training your own weights. This repo does **not** vendor the weights (they are downloaded). |
| **Ultralytics** (`ultralytics` 8.4.157) | Package metadata: **AGPL-3.0**. Ultralytics also advertises a separate commercial (Enterprise) license. | ⚠ AGPL-3.0 has conditions that may apply to software that uses it, including when offered as a network service. Needs review before public deployment. |
| **Base checkpoint** `yolov8s.pt` (COCO pretrained, from Ultralytics) that the weights were fine-tuned from | Distributed by Ultralytics under their licensing. Not independently verified here. | ⚠ Review together with the Ultralytics item. |
| **RDD2022 dataset** (training data) | Figshare record (DOI 10.6084/m9.figshare.21431547) is by Arya et al.; the authors ask that it be cited. **I could not verify the license text** from the page content available to me. | ⚠ Check the license on the Figshare record. Citation: Arya, D. et al., "RDD2022: A multi-national image dataset for automatic road damage detection", *Geoscience Data Journal*, 2024. |
| **PyTorch** 2.5.1 | Package metadata: BSD-3-Clause | – |
| **Pillow** 12.1.1 / **NumPy** 2.4.4 | Package metadata: MIT-CMU / BSD-3-Clause and others | – |
| Test images used during development (not in this repo) | A Roboflow pothole dataset labelled CC BY 4.0 (validation only). One additional GitHub sample photo of unknown license was used locally for testing and is not redistributed. | – |
| Groq-hosted Llama 3 (explanations/chatbot, not part of `ml/`) | Not reviewed in this phase. | ⚠ Review Llama 3 and Groq terms separately. |

## Files

| File | Purpose |
|---|---|
| `inference.py` | CLI/importable detector; prints one JSON document |
| `download_model.py` | Pinned, checksum-verified weights download |
| `requirements.txt` | Python dependencies (`ultralytics==8.4.157`, pillow, numpy) |
| `model/` | Downloaded weights land here (git-ignored) |
| `../backend/services/roadDamageDetector.js` | Node bridge (download, spawn, timeout, error mapping) |
| `../backend/tests/` | Integration and route tests |
