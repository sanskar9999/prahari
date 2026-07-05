// Live microphone speech-to-text.
// Primary engine: Vosk (WASM, Indian-English model served from /models) — runs
// fully offline in the browser, so it works on GitHub Pages, Brave, Edge and
// flaky networks. Fallback: Chrome's Web Speech API (needs Google servers).

import { createModel } from 'vosk-browser'

let modelPromise = null

function loadVoskModel(onStatus) {
  if (!modelPromise) {
    onStatus?.('Downloading offline speech model (~37 MB, first time only)…')
    // vosk's worker runs from a blob URL, so relative paths won't resolve — pass absolute
    const url = new URL(`${import.meta.env.BASE_URL}models/vosk-en-in.tar.gz`, window.location.href).href
    console.debug('[micStt] createModel', url)
    modelPromise = Promise.race([
      createModel(url, 2).then((m) => { console.debug('[micStt] model ready'); return m }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('offline model load timed out')), 90000)),
    ])
    modelPromise.catch((e) => { console.warn('[micStt] model load failed', e); modelPromise = null })
  }
  return modelPromise
}

/**
 * Start live STT. Returns { stop, engine } — call stop() to end the session.
 * onText(fullText, isPartial) fires as words are recognised.
 */
export async function startMic({ onText, onStatus, onError }) {
  // --- Vosk path ---
  try {
    const model = await loadVoskModel(onStatus)
    onStatus?.('Requesting microphone…')
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const recognizer = new model.KaldiRecognizer(ctx.sampleRate)
    recognizer.setWords(false)

    let finalText = ''
    recognizer.on('result', (m) => {
      const t = m.result?.text?.trim()
      if (t) {
        finalText = `${finalText} ${t}`.trim()
        onText(finalText, false)
      }
    })
    recognizer.on('partialresult', (m) => {
      const p = m.result?.partial?.trim()
      if (p) onText(`${finalText} ${p}`.trim(), true)
    })

    const source = ctx.createMediaStreamSource(stream)
    const node = ctx.createScriptProcessor(4096, 1, 1)
    node.onaudioprocess = (e) => {
      try { recognizer.acceptWaveform(e.inputBuffer) } catch { /* ignore frame errors */ }
    }
    source.connect(node)
    node.connect(ctx.destination)
    onStatus?.(null)

    return {
      engine: 'vosk (offline, en-IN)',
      stop: () => {
        try { node.disconnect(); source.disconnect() } catch { /* already gone */ }
        stream.getTracks().forEach((t) => t.stop())
        ctx.close().catch(() => {})
        try { recognizer.remove() } catch { /* ok */ }
      },
    }
  } catch (voskErr) {
    console.warn('[micStt] vosk failed, trying Web Speech API', voskErr)
    if (String(voskErr?.name) === 'NotAllowedError') {
      onError?.('Microphone permission denied.')
      return null
    }
  }

  // --- Web Speech fallback (Chrome online) ---
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) {
    onError?.('No speech engine available — the offline model failed to load and this browser has no built-in recognition.')
    return null
  }
  const rec = new SR()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = 'en-IN'
  let finalText = ''
  rec.onresult = (ev) => {
    let interim = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i]
      if (r.isFinal) finalText += r[0].transcript + ' '
      else interim += r[0].transcript
    }
    onText(`${finalText} ${interim}`.trim(), true)
  }
  rec.onerror = (ev) => onError?.(ev.error === 'not-allowed' ? 'Microphone permission denied.' : `Speech recognition error: ${ev.error}`)
  let active = true
  rec.onend = () => { if (active) { try { rec.start() } catch { /* stopped */ } } }
  rec.start()
  onStatus?.(null)
  return { engine: 'Web Speech API (online)', stop: () => { active = false; rec.stop() } }
}
