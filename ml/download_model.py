#!/usr/bin/env python3
"""
Download the pretrained road-damage weights used by PotholeVision AI.

Source : https://github.com/oracl4/RoadDamageDetection  (models/YOLOv8_Small_RDD.pt)
Pinned : commit c0e8b7c35b22f27273ef8625111a7cd63e3c9359
Size   : ~89 MB (not committed to this repository)

The file is a PyTorch pickle, so it is only ever loaded after its SHA-256
matches the value recorded below.

Usage:
    python ml/download_model.py            # download if missing, verify hash
    python ml/download_model.py --force    # re-download
"""
import argparse
import hashlib
import os
import sys
import urllib.request

COMMIT = "c0e8b7c35b22f27273ef8625111a7cd63e3c9359"
URL = (
    "https://github.com/oracl4/RoadDamageDetection/raw/"
    f"{COMMIT}/models/YOLOv8_Small_RDD.pt"
)
SHA256 = "7f2ceb8f6f3dfcc8fffd98cb488281be725150aed0f06cf21c4db72b5cd0a62b"

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, "model", "YOLOv8_Small_RDD.pt")


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(
        description=(__doc__ or "").split("\n\n")[0]
    )
    parser.add_argument("--force", action="store_true", help="re-download even if present")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(DEST), exist_ok=True)

    if os.path.exists(DEST) and not args.force:
        if sha256_of(DEST) == SHA256:
            print(f"OK: weights already present and verified: {DEST}")
            return 0
        print("Existing file has the wrong checksum; re-downloading.", file=sys.stderr)

    tmp = DEST + ".part"
    print(f"Downloading {URL}")
    try:
        with urllib.request.urlopen(URL, timeout=60) as resp, open(tmp, "wb") as out:
            total = int(resp.headers.get("Content-Length") or 0)
            done = 0
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                out.write(chunk)
                done += len(chunk)
                if total:
                    print(f"\r  {done / 1e6:6.1f} / {total / 1e6:.1f} MB", end="", flush=True)
        print()
    except Exception as exc:  # network errors, HTTP errors, disk errors
        if os.path.exists(tmp):
            os.remove(tmp)
        print(f"ERROR: download failed: {exc}", file=sys.stderr)
        return 1

    actual = sha256_of(tmp)
    if actual != SHA256:
        os.remove(tmp)
        print(
            f"ERROR: checksum mismatch.\n  expected {SHA256}\n  actual   {actual}\n"
            "Refusing to keep an unverified pickle file.",
            file=sys.stderr,
        )
        return 1

    os.replace(tmp, DEST)
    print(f"OK: saved and verified {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())