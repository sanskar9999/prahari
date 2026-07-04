# -*- coding: utf-8 -*-
"""Build the FICN training set for the in-browser MobileNet+kNN classifier.

Inputs:
  - ET Hack 2\\prahari_ficn.zip      pre-rectified 640x280 Kaggle corpus + meta.json
                                     (produced by the Kaggle notebook cell)
  - ET Hack 2\\My Real Notes\\{100,200,500}\\*.jpg   user's own genuine notes (raw photos,
                                     rectified here with the same pipeline)

Outputs (prahari-v2/public/ficn/):
  genuine/*.jpg fake/*.jpg holdout/*.jpg manifest.json holdout.json

Hold-outs (never added to the k-NN): 2 kaggle fakes, 1 kaggle genuine, 2 user photos.
"""
import glob
import io
import json
import os
import random
import zipfile

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "ficn"))
ZIP = os.path.join(ROOT, "prahari_ficn.zip")
W, H = 640, 280

random.seed(7)


def order_corners(pts):
    pts = pts.reshape(4, 2).astype(np.float32)
    s, d = pts.sum(1), np.diff(pts, 1).ravel()
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]], np.float32)


def rectify(img):
    """OTSU brightness segmentation -> largest blob -> min-area rect -> warp.
    Works on notes photographed against darker/textured backgrounds."""
    h0, w0 = img.shape[:2]
    scale = min(1.0, 900.0 / max(h0, w0))
    small = cv2.resize(img, None, fx=scale, fy=scale) if scale < 1 else img.copy()
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (7, 7), 0)
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < 0.10 * small.shape[0] * small.shape[1]:
        return None
    box = cv2.boxPoints(cv2.minAreaRect(c))
    quad = order_corners(box) / (scale if scale < 1 else 1.0)
    tl, tr, br, bl = quad
    if (np.linalg.norm(bl - tl) + np.linalg.norm(br - tr)) / 2 > (np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2:
        quad = np.array([tr, br, bl, tl], np.float32)
    M = cv2.getPerspectiveTransform(quad, np.array([[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]], np.float32))
    return cv2.warpPerspective(img, M, (W, H))


def quality_ok(img):
    """Drop flat-colour patches and dead crops from the training corpus."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(gray.std()) > 14.0


def center_fallback(img):
    h0, w0 = img.shape[:2]
    if h0 > w0:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        h0, w0 = w0, h0
    ch = int(min(h0, w0 * H / W))
    cw = int(ch * W / H)
    y0, x0 = (h0 - ch) // 2, (w0 - cw) // 2
    return cv2.resize(img[y0:y0 + ch, x0:x0 + cw], (W, H))


def main():
    for sub in ("genuine", "fake", "holdout"):
        d = os.path.join(OUT, sub)
        os.makedirs(d, exist_ok=True)
        for f in glob.glob(os.path.join(d, "*")):
            os.remove(f)

    entries = []  # {img(np), label, denom, source}

    # --- kaggle zip (pre-rectified) ---
    with zipfile.ZipFile(ZIP) as z:
        meta = json.loads(z.read("meta.json"))
        for m in meta:
            img = cv2.imdecode(np.frombuffer(z.read(m["file"]), np.uint8), cv2.IMREAD_COLOR)
            if img is None or not quality_ok(img):
                continue
            entries.append({"img": img, "label": m["label"], "denom": m["denom"], "source": "kaggle"})

    # --- user photos (rectified locally) ---
    stats = {"warped": 0, "fallback": 0}
    for denom in ("100", "200", "500"):
        for p in glob.glob(os.path.join(ROOT, "My Real Notes", denom, "*.jpg")):
            img = cv2.imread(p)
            if img is None:
                continue
            rect = rectify(img)
            if rect is None:
                rect = center_fallback(img)
                stats["fallback"] += 1
            else:
                stats["warped"] += 1
            entries.append({"img": rect, "label": "genuine", "denom": denom, "source": "user"})

    kf = [e for e in entries if e["source"] == "kaggle" and e["label"] == "fake"]
    kg = [e for e in entries if e["source"] == "kaggle" and e["label"] == "genuine"]
    ug = [e for e in entries if e["source"] == "user"]
    print(f"kaggle fake={len(kf)} kaggle genuine={len(kg)} user genuine={len(ug)} · user rectify {stats}")

    random.shuffle(kf); random.shuffle(kg); random.shuffle(ug)
    holdouts = kf[:2] + kg[:1] + ug[:2]
    training = kf[2:] + kg[1:] + ug[2:]

    manifest, holdout_json = [], []
    counters = {}
    for group, target, sink in ((training, None, manifest), (holdouts, "holdout", holdout_json)):
        for e in group:
            sub = target or e["label"]
            key = (sub, e["label"], e["denom"])
            counters[key] = counters.get(key, 0) + 1
            name = f"{e['label']}_{e['denom']}_{e['source']}_{counters[key]:02d}.jpg"
            cv2.imwrite(os.path.join(OUT, sub, name), e["img"], [cv2.IMWRITE_JPEG_QUALITY, 82])
            sink.append({"file": f"{sub}/{name}", "label": e["label"], "denom": e["denom"], "source": e["source"]})

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f)
    with open(os.path.join(OUT, "holdout.json"), "w", encoding="utf-8") as f:
        json.dump(holdout_json, f)
    from collections import Counter
    print("manifest:", Counter(m["label"] for m in manifest), f"({len(manifest)} imgs)")
    print("holdout:", [(h["label"], h["denom"], h["source"]) for h in holdout_json])


if __name__ == "__main__":
    main()
