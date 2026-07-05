// Live microphone speech-to-text.
// Primary engine: Vosk (WASM, Indian-English model served from /models) — runs
// fully offline in the browser, so it works on GitHub Pages, Brave, Edge and
// flaky networks. Fallback: Chrome's Web Speech API (needs Google servers).

import { Model } from 'vosk-browser'

let modelPromise = null

function loadVoskModel(onStatus) {
  if (!modelPromise) {
    onStatus?.('Loading offline speech model (~36 MB, first time only)…')
    // vosk's worker runs from a blob URL, so relative paths won't resolve — pass absolute.
    // Use Model directly (not createModel) so worker/model error events reject fast
    // instead of hanging forever.
    const url = new URL(`${import.meta.env.BASE_URL}models/vosk-en-in.tar.gz`, window.location.href).href
    modelPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('offline speech model timed out (slow connection?)')), 120000)
      try {
        const m = new Model(url, 0)
        m.on('load', (msg) => {
          clearTimeout(timeout)
          if (msg.result) { console.debug('[micStt] vosk model ready'); resolve(m) }
          else reject(new Error('speech model failed to initialise'))
        })
        m.on('error', (msg) => { clearTimeout(timeout); reject(new Error(`speech model error: ${msg?.error || 'load failed'}`)) })
        m.worker?.addEventListener?.('error', (e) => { clearTimeout(timeout); reject(new Error(`speech worker error: ${e.message || 'crashed'}`)) })
      } catch (err) { clearTimeout(timeout); reject(err) }
    })
    modelPromise.catch((e) => { console.warn('[micStt] model load failed', e); modelPromise = null })
  }
  return modelPromise
}

/** True in Brave — its fingerprint protection ("farbling") corrupts Web Audio
 *  capture even when mic permission is granted, which silently breaks STT. */
export async function isBrave() {
  try { return !!(navigator.brave && await navigator.brave.isBrave()) } catch { return false }
}

/**
 * Start live STT. Returns { stop, engine } — call stop() to end the session.
 * onText(fullText, isPartial) fires as words are recognised.
 * onLevel(0..1) fires with live mic input level so dead capture is visible.
 */
export async function startMic({ onText, onStatus, onError, onLevel }) {
  // --- Vosk path ---
  try {
    const model = await loadVoskModel(onStatus)
    onStatus?.('Requesting microphone…')
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    // user activation may have expired while the model loaded — resume explicitly
    if (ctx.state === 'suspended') await ctx.resume()
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
      const data = e.inputBuffer.getChannelData(0)
      let sum = 0
      for (let i = 0; i < data.length; i += 16) sum += data[i] * data[i]
      onLevel?.(Math.min(1, Math.sqrt(sum / (data.length / 16)) * 8))
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
