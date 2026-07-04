import { useEffect, useRef, useState } from 'react'
import { analyzeTranscript, highlightTranscript, SAMPLE_TRANSCRIPTS } from '../lib/scamEngine'

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function ScamShield() {
  const [text, setText] = useState(SAMPLE_TRANSCRIPTS[0].text)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [micErr, setMicErr] = useState(null)
  const recRef = useRef(null)

  useEffect(() => () => recRef.current?.stop(), [])

  const run = () => {
    setBusy(true)
    setResult(null)
    // staged latency so the analysis pass is visible
    setTimeout(() => {
      setResult(analyzeTranscript(text))
      setBusy(false)
    }, 1400)
  }

  const stopMic = () => {
    if (recRef.current) {
      recRef.current.onend = null
      recRef.current.stop()
      recRef.current = null
    }
    setMicOn(false)
  }

  const startMic = () => {
    if (micOn) return stopMic()
    setMicErr(null)
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
      const full = `${finalText} ${interim}`.trim()
      setText(full)
      setResult(full ? analyzeTranscript(full) : null)
    }
    rec.onerror = (ev) => {
      setMicErr(ev.error === 'not-allowed' ? 'Microphone permission denied.' : `Speech recognition error: ${ev.error}`)
      stopMic()
    }
    // Chrome ends recognition after silence — restart while the mic toggle is on
    rec.onend = () => { try { rec.start() } catch { setMicOn(false) } }
    rec.start()
    recRef.current = rec
    setText('')
    setResult(null)
    setMicOn(true)
  }

  const gaugeColor =
    !result ? 'var(--muted)' : result.verdict === 'critical' ? 'var(--red)' : result.verdict === 'suspicious' ? 'var(--amber)' : 'var(--green)'

  return (
    <div>
      <p className="section-desc">
        Paste a transcript — or press <b>Live Mic</b> and speak: the browser&apos;s speech-recognition engine
        transcribes you in real time and the classifier scores every word as it lands. Both paths run the same
        five-category signal fusion drawn from I4C-documented digital-arrest playbooks.
      </p>

      <div className="shield-grid">
        <div>
          <div className="sample-row">
            {SAMPLE_TRANSCRIPTS.map((s) => (
              <button key={s.name} className="btn ghost" onClick={() => { stopMic(); setText(s.text); setResult(null) }}>
                {s.name}
              </button>
            ))}
            <button
              className={`btn ${micOn ? 'danger' : 'ghost'}`}
              onClick={startMic}
              disabled={!SR}
              title={SR ? 'Real speech-to-text via the Web Speech API' : 'Speech recognition needs Chrome/Edge'}
            >
              {micOn ? '⏹ Stop Mic — listening…' : '🎙 Live Mic (real STT)'}
            </button>
          </div>

          {micOn && (
            <div className="mic-banner">
              <span className="mic-dot" /> LIVE — real speech-to-text (Web Speech API, en-IN). Speak a scam line,
              e.g. “I am calling from the CBI, there is an arrest warrant against you, transfer the money immediately.”
            </div>
          )}
          {micErr && <div className="mic-banner err">⚠ {micErr}</div>}
          {!SR && <div className="mic-banner err">Live Mic needs Chrome or Edge (Web Speech API unavailable here).</div>}

          <textarea
            className="transcript"
            value={text}
            readOnly={micOn}
            onChange={(e) => { setText(e.target.value); setResult(null) }}
            placeholder={micOn ? 'Listening…' : 'Paste call transcript here…'}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button className="btn danger" onClick={run} disabled={busy || micOn || !text.trim()}>
              {busy ? 'Analyzing…' : '⚡ Analyze Call'}
            </button>
          </div>

          {result && !micOn && (
            <div style={{ marginTop: 16 }}>
              <div className="card-title">Transcript — flagged signals</div>
              <div className="highlighted">
                {highlightTranscript(text, result.categories).map((p, i) =>
                  p.cat ? <mark key={i} className={p.cat}>{p.text}</mark> : <span key={i}>{p.text}</span>
                )}
              </div>
            </div>
          )}
          {result && micOn && (
            <div style={{ marginTop: 16 }}>
              <div className="card-title">Live signals (updating as you speak)</div>
              <div className="highlighted">
                {highlightTranscript(text, result.categories).map((p, i) =>
                  p.cat ? <mark key={i} className={p.cat}>{p.text}</mark> : <span key={i}>{p.text}</span>
                )}
                <span className="cursor">▌</span>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Threat Assessment {micOn && <span className="mini-note">(live)</span>}</div>

          {busy && (
            <div className="analyzing">
              <div className="spinner" />
              Running scam-pattern inference…
            </div>
          )}

          {!busy && !result && (
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
              Load a sample, paste a transcript, or go live with the mic. Verdict, risk score and per-category
              signal breakdown appear here.
            </p>
          )}

          {result && (
            <>
              <div className={`verdict ${result.verdict}`}>
                <h2>{result.verdict === 'critical' ? '🚨 ' : ''}{result.headline}</h2>
                <p>{result.advice}</p>
              </div>

              <div className="gauge-wrap">
                <div className="gauge-num" style={{ color: gaugeColor }}>{result.riskScore}<span style={{ fontSize: 18, color: 'var(--muted)' }}>/100</span></div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Composite fraud risk score<br />(weighted signal fusion)</div>
              </div>

              {result.categories.map((c) => (
                <div className="cat-bar" key={c.id}>
                  <div className="cat-head">
                    <span>{c.label}</span>
                    <span style={{ color: c.color, fontFamily: 'var(--font-mono)' }}>
                      {Math.round((c.score / c.weight) * 100)}% · {c.hits} hits
                    </span>
                  </div>
                  <div className="track">
                    <div className="fill" style={{ width: `${(c.score / c.weight) * 100}%`, background: c.color }} />
                  </div>
                </div>
              ))}

              {result.verdict === 'critical' && (
                <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                  ✓ Victim device push-alert dispatched<br />
                  ✓ Telecom provider notified (spoof-block request)<br />
                  ✓ MHA / I4C incident report auto-generated
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
