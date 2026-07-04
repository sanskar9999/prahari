# -*- coding: utf-8 -*-
"""Transcribe the selected REAL robocall recordings (NCSU/FTC robocall-audio-dataset,
public domain) with faster-whisper word timestamps, and emit the Live Intercept
real-case manifest.

Output:
  public/audio/real/case{N}.wav   (copied source audio)
  public/audio/real/cases.json    [{id, name, badge, source, file, durMs,
                                    words: [str], times: [ms], rule: {minRisk, requireFinancial}}]
"""
import json
import os
import shutil

from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "audio", "real"))
SRC = r"C:\Users\91800\Desktop\ET Hack 2\robocall_data"
os.makedirs(OUT, exist_ok=True)

CASES = [
    {
        "id": "real-ssa",
        "src": "1100784_left.wav",
        "file": "case1.wav",
        "name": "REAL CASE — “Social Security suspended” robocall",
        "badge": "REAL RECORDING · FTC evidence · public domain (NCSU robocall-audio-dataset)",
        "source": "FTC Project Point of No Entry — cease & desist: Every1 Telecom",
        # Robocalls are the HOOK stage (press 1 -> human extractor). Intercept on
        # impersonation + threat, before the victim ever reaches a scammer.
        "rule": {"minRisk": 38, "requireFinancial": False},
    },
    {
        "id": "real-warrant",
        "src": "431150_normalized.wav",
        "file": "case2.wav",
        "name": "REAL CASE — “court warrant / legal enforcement” robocall",
        "badge": "REAL RECORDING · FTC evidence · public domain (NCSU robocall-audio-dataset)",
        "source": "FTC Project Point of No Entry — warning letter: RSCom Ltd",
        "rule": {"minRisk": 38, "requireFinancial": False},
    },
]

print("Loading faster-whisper (base, int8, CPU)…")
model = WhisperModel("base", device="cpu", compute_type="int8")

manifest = []
for c in CASES:
    src_path = os.path.join(SRC, c["src"])
    dst_path = os.path.join(OUT, c["file"])
    shutil.copyfile(src_path, dst_path)
    print(f"Transcribing {c['src']}…")
    segments, info = model.transcribe(src_path, word_timestamps=True, language="en")
    words, times = [], []
    end_ms = 0
    for seg in segments:
        for w in seg.words or []:
            words.append(w.word.strip())
            times.append(round(w.start * 1000))
            end_ms = max(end_ms, round(w.end * 1000))
    print(f"  {len(words)} words, {end_ms/1000:.1f}s")
    manifest.append({
        "id": c["id"], "name": c["name"], "badge": c["badge"], "source": c["source"],
        "file": c["file"], "durMs": end_ms + 400, "words": words, "times": times,
        "rule": c["rule"],
    })

with open(os.path.join(OUT, "cases.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f)
print("Wrote cases.json")
