# -*- coding: utf-8 -*-
"""Render the Live Intercept CALL_SCRIPT to real neural-TTS audio with word timings.

Voices: Microsoft edge-tts Indian-English neural voices. Output:
  public/audio/seg{N}.mp3
  public/audio/timings.json   [{seg, file, speaker, durMs, times:[ms per word of the ORIGINAL script text]}]

Word-boundary events from TTS may not match the script's whitespace tokenisation 1:1
(numbers expand, hyphens merge), so boundary times are index-mapped onto the original
words — worst case drift is one word, invisible at playback.

NOTE: segments below must mirror CALL_SCRIPT in src/lib/callScript.js.
"""
import asyncio
import json
import os

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "audio"))
os.makedirs(OUT, exist_ok=True)

VOICES = {
    "CALLER": "en-IN-PrabhatNeural",
    "VICTIM": "en-IN-NeerjaNeural",
}

SEGMENTS = [
    ("CALLER", "Good afternoon. I am Inspector Vikram Rathore, Mumbai Police Cyber Cell. An FIR number 0862 stroke 2026 has been registered against your Aadhaar number."),
    ("VICTIM", "What? I… I do not understand. What FIR? I have not done anything."),
    ("CALLER", "A parcel intercepted at Mumbai customs contains narcotics booked in your name. This is now a money laundering case under investigation by the Enforcement Directorate and the Supreme Court has issued a non-bailable arrest warrant."),
    ("CALLER", "You are under digital arrest. Keep your camera on at all times. Do not disconnect this call and do not tell anyone about this investigation — it is strictly confidential. You are under surveillance."),
    ("VICTIM", "Please sir, I am a retired school teacher. Please, there must be some mistake…"),
    ("CALLER", "If you cooperate fully you will not be arrested tonight. Your funds must undergo verification. Transfer your savings by RTGS to the government safe account I am sending you. The amount is fully refundable after verification."),
    ("CALLER", "You have 30 minutes. Share your bank account number and begin the transfer immediately. This is your last warning."),
]


async def render(seg_idx, speaker, text):
    voice = VOICES[speaker]
    rate = "-4%" if speaker == "CALLER" else "+0%"
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    fname = f"seg{seg_idx}.mp3"
    boundaries = []
    audio_bytes = b""
    async for chunk in com.stream():
        if chunk["type"] == "audio":
            audio_bytes += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            boundaries.append(chunk["offset"] / 10_000.0)  # 100ns ticks -> ms
    with open(os.path.join(OUT, fname), "wb") as f:
        f.write(audio_bytes)

    words = text.split()
    n, m = len(words), len(boundaries)
    if m == 0:
        times = [i * 300.0 for i in range(n)]
    else:
        times = [boundaries[min(int(i * m / n), m - 1)] for i in range(n)]
    dur = (boundaries[-1] + 600) if boundaries else n * 300.0
    print(f"  seg{seg_idx} [{speaker}] {n} words / {m} boundaries / ~{dur/1000:.1f}s")
    return {"seg": seg_idx, "file": fname, "speaker": speaker, "durMs": round(dur), "times": [round(t) for t in times]}


async def main():
    print(f"Rendering {len(SEGMENTS)} segments to {OUT}")
    out = []
    for i, (speaker, text) in enumerate(SEGMENTS):
        out.append(await render(i, speaker, text))
    with open(os.path.join(OUT, "timings.json"), "w", encoding="utf-8") as f:
        json.dump(out, f)
    print("Wrote timings.json")


if __name__ == "__main__":
    asyncio.run(main())
