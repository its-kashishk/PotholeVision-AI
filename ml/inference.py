#!/usr/bin/env python3
"""
PotholeVision AI - road damage inference.

Runs a real YOLOv8s road-damage detector (see ml/README.md for the model card)
on ONE image and prints ONE JSON document to stdout.

    python ml/inference.py path/to/image.jpg [--conf 0.25] [--model path.pt]

Guarantees
  * Every detection comes from model inference. Nothing is ever invented:
    if the model finds nothing, `detections` is [] and `detected` is false.
  * Failures print {"success": false, "error": {"code", "message"}} and exit
    non-zero. There is no fallback/"demo" prediction path.

Exit codes: 0 ok | 2 bad/missing/unreadable image | 3 model unavailable | 4 inference failed
"""
import argparse
import contextlib
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL = os.path.join(HERE, "model", "YOLOv8_Small_RDD.pt")
DEFAULT_CONF = 0.25
IMGSZ = 640
MAX_DET = 20
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}  # matches the upload allow-list in backend/config/cloudinary.js

# Model class label -> category used by the app's Report schema.
# The model only knows road-surface damage of these 4 kinds. It does NOT detect
# waterlogging or "broken surface", so those app categories are never produced.
APP_CLASS = {
    "Longitudinal Crack": "crack",
    "Transverse Crack": "crack",
    "Alligator Crack": "crack",
    "Potholes": "pothole",
}

EXIT = {"INVALID_IMAGE": 2, "MODEL_UNAVAILABLE": 3, "INFERENCE_FAILED": 4}


class InferenceError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def load_image(path):
    """Open + validate an image. Returns an upright RGB PIL image."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    if not path or not os.path.isfile(path):
        raise InferenceError("INVALID_IMAGE", f"Image file not found: {path}")
    if os.path.getsize(path) == 0:
        raise InferenceError("INVALID_IMAGE", "Image file is empty")

    try:
        with Image.open(path) as probe:
            fmt = probe.format
            probe.verify()  # detects truncated/corrupt data without full decode
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise InferenceError("INVALID_IMAGE", f"Unreadable or corrupt image: {exc}")

    if fmt not in ALLOWED_FORMATS:
        raise InferenceError(
            "INVALID_IMAGE",
            f"Unsupported image format '{fmt}'. Allowed: {', '.join(sorted(ALLOWED_FORMATS))}",
        )

    try:
        img = Image.open(path)
        img.load()  # full decode; catches errors verify() can miss
        img = ImageOps.exif_transpose(img)  # phone photos: apply EXIF rotation
        return img.convert("RGB")
    except (OSError, SyntaxError, ValueError) as exc:
        raise InferenceError("INVALID_IMAGE", f"Unreadable or corrupt image: {exc}")


def load_model(model_path):
    if not os.path.isfile(model_path):
        raise InferenceError(
            "MODEL_UNAVAILABLE",
            f"Model weights not found at {model_path}. Run: python ml/download_model.py",
        )
    try:
        # Ultralytics/torch print banners to stdout; keep stdout clean for JSON.
        with contextlib.redirect_stdout(sys.stderr):
            os.environ.setdefault("YOLO_AUTOINSTALL", "False")
            from ultralytics import YOLO
            from ultralytics.utils import SETTINGS

            SETTINGS["sync"] = False  # in-process only: no anonymous analytics
            return YOLO(model_path, task="detect")
    except ImportError as exc:
        raise InferenceError(
            "MODEL_UNAVAILABLE",
            f"Python dependencies missing ({exc}). Run: pip install -r ml/requirements.txt",
        )
    except Exception as exc:
        raise InferenceError("MODEL_UNAVAILABLE", f"Could not load model: {exc}")


def detect(image_path, model_path=DEFAULT_MODEL, conf=DEFAULT_CONF):
    img = load_image(image_path)  # validate first: cheap, and avoids loading torch for bad input
    width, height = img.size

    model = load_model(model_path)

    try:
        t0 = time.perf_counter()

        device = 0 if _cuda() else "cpu"

        with contextlib.redirect_stdout(sys.stderr):
            results = model.predict(
                img,
                imgsz=IMGSZ,
                conf=conf,
                max_det=MAX_DET,
                device=device,
                verbose=False,
            )

        elapsed_ms = round((time.perf_counter() - t0) * 1000)
        result = results[0]

    except Exception as exc:
        raise InferenceError(
            "INFERENCE_FAILED",
            f"Model inference failed: {exc}"
        )
    detections = []

    boxes = result.boxes
    if boxes is not None:
        for box in boxes:
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
            x1, y1 = max(0.0, x1), max(0.0, y1)
            x2, y2 = min(float(width), x2), min(float(height), y2)
            label = model.names[int(box.cls)]
            detections.append(
                {
                    "class": APP_CLASS.get(label, "unknown"),
                    "model_class": label,
                    "class_id": int(box.cls),
                    "confidence": round(float(box.conf), 4),
                    # pixels, top-left origin, relative to the (EXIF-corrected) image
                    "bbox": {
                        "x": round(x1, 1),
                        "y": round(y1, 1),
                        "width": round(x2 - x1, 1),
                        "height": round(y2 - y1, 1),
                    },
                    # 0-1 fractions of image size: the convention the app already stores
                    "bbox_normalized": {
                        "x": round(x1 / width, 4),
                        "y": round(y1 / height, 4),
                        "width": round((x2 - x1) / width, 4),
                        "height": round((y2 - y1) / height, 4),
                    },
                }
            )
    detections.sort(key=lambda d: d["confidence"], reverse=True)

    import torch
    import ultralytics

    return {
        "success": True,
        "detected": len(detections) > 0,
        "detections": detections,
        "image": {"width": width, "height": height},
        "model": {
            "name": "YOLOv8s road-damage (oracl4/RoadDamageDetection, RDD2022 Japan+India)",
            "weights": os.path.basename(model_path),
            "framework": f"ultralytics {ultralytics.__version__} / torch {torch.__version__}",
            "conf_threshold": conf,
            "imgsz": IMGSZ,
        },
        "inference_ms": elapsed_ms,
    }


def _cuda():
    try:
        import torch

        return torch.cuda.is_available()
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(description="Run road-damage detection on one image.")
    parser.add_argument("image", help="path to a JPEG/PNG/WEBP image")
    parser.add_argument("--model", default=os.environ.get("ROAD_DAMAGE_MODEL_PATH") or DEFAULT_MODEL)
    parser.add_argument(
        "--conf",
        type=float,
        default=float(os.environ.get("ROAD_DAMAGE_CONF") or DEFAULT_CONF),
        help=f"confidence threshold (default {DEFAULT_CONF})",
    )
    args = parser.parse_args()

    try:
        out = detect(args.image, args.model, args.conf)
        code = 0
    except InferenceError as err:
        out = {"success": False, "error": {"code": err.code, "message": err.message}}
        code = EXIT.get(err.code, 4)
    except ImportError as err:
        out = {
            "success": False,
            "error": {
                "code": "MODEL_UNAVAILABLE",
                "message": f"Python dependencies missing ({err}). Run: pip install -r ml/requirements.txt",
            },
        }
        code = EXIT["MODEL_UNAVAILABLE"]
    except Exception as err:  # never let a traceback replace the JSON contract
        out = {"success": False, "error": {"code": "INFERENCE_FAILED", "message": f"Unexpected error: {err}"}}
        code = 4

    print(json.dumps(out))
    return code


if __name__ == "__main__":
    sys.exit(main())