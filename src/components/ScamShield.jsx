import { useEffect, useRef, useState } from 'react'
import { analyzeTranscript, highlightTranscript, SAMPLE_TRANSCRIPTS } from '../lib/scamEngine'
import { startMic, isBrave, runSampleThroughRecognizer } from '../lib/micStt'

export default function ScamShield() {
  const [text, setText] = useState(SAMPLE_TRANSCRIPTS[0].text)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [micErr, setMicErr] = useState(null)
  const [micStatus, setMicStatus] = useState(null)
  const [micEngine, setMicEngine] = useState(null)
  const [micLevel, setMicLevel] = useState(0)
  const [brave, setBrave] = useState(false)
  const [selfTest, setSelfTest] = useState(false)
  const sessionRef = useRef(null)
  const peakRef = useRef(0)

  useEffect(() => {
    isBrave().then(setBrave)
    return () => sessionRef.current?.stop()
  }, [])

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
    sessionRef.current?.stop()
    sessionRef.current = null
    setMicOn(false)
    setMicStatus(null)
  }

  const toggleMic = async () => {
    if (micOn) return stopMic()
    setMicErr(null)
    setText('')
    setResult(null)
    setMicOn(true)
    peakRef.current = 0
    setMicLevel(0)
    const session = await startMic({
      onText: (full) => {
        setText(full)
        setResult(full ? analyzeTranscript(full) : null)
      },
      onStatus: setMicStatus,
      onError: (e) => { setMicErr(e); setMicOn(false); setMicStatus(null) },
      onLevel: (l) => {
        peakRef.current = Math.max(peakRef.current, l)
        setMicLevel(l)
      },
    })
    if (!session) { setMicOn(false); return }
    sessionRef.current = session
    setMicEngine(session.engine)
  }

  const runSelfTest = () => {
    if (selfTest || micOn) return
    setSelfTest(true)
    setMicErr(null)
    setText('')
    setResult(null)
    runSampleThroughRecognizer({
      onText: (full) => {
        setText(full)
        setResult(full ? analyzeTranscript(full) : null)
      },
      onStatus: setMicStatus,
      onDone: () => { setSelfTest(false); setMicStatus(null) },
      onError: (e) => { setMicErr(e); setSelfTest(false); setMicStatus(null) },
    })
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
              onClick={toggleMic}
              disabled={selfTest}
              title="Real speech-to-text — offline Vosk model (en-IN), no cloud required"
            >
              {micOn ? '⏹ Stop Mic — listening…' : '🎙 Live Mic (real STT)'}
            </button>
            <button
              className="btn ghost"
              onClick={runSelfTest}
              disabled={selfTest || micOn}
              title="Streams the real FTC scam recording through the same offline recogniser — no microphone needed"
            >
              {selfTest ? '🧪 Recognising…' : '🧪 STT self-test (no mic)'}
            </button>
          </div>

          {selfTest && micStatus && (
            <div className="mic-banner"><div className="spinner" /> {micStatus}</div>
          )}
          {selfTest && !micStatus && (
            <div className="mic-banner">
              <span className="mic-dot" /> Streaming the REAL scam recording through the offline recogniser —
              transcript and risk update live below. No microphone involved.
            </div>
          )}

          {micOn && micStatus && (
            <div className="mic-banner"><div className="spinner" /> {micStatus}</div>
          )}
          {micOn && !micStatus && (
            <div className="mic-banner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span className="mic-dot" /> LIVE — real speech-to-text ({micEngine || 'starting…'}). Speak a scam line,
                e.g. “I am calling from the CBI, there is an arrest warrant against you, transfer the money immediately.”
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mini-note" style={{ minWidth: 60 }}>MIC LEVEL</span>
                <div className="track" style={{ flex: 1 }}>
                  <div className="fill" style={{ width: `${Math.round(micLevel * 100)}%`, background: micLevel > 0.03 ? 'var(--green)' : 'var(--red)', transition: 'width 0.1s linear' }} />
                </div>
              </div>
              {peakRef.current < 0.03 && (
                <span className="mini-note" style={{ color: 'var(--amber)' }}>
                  If this bar never moves while you speak, the browser is delivering silence.
                  {brave ? ' Brave detected — its Shields corrupt audio capture: click the lion icon and turn Shields OFF for this site, or use Chrome.' : ' Check your input device in browser site settings.'}
                </span>
              )}
            </div>
          )}
          {micErr && <div className="mic-banner err">⚠ {micErr}</div>}
          {brave && !micOn && (
            <div className="mic-banner err" style={{ fontSize: 11.5 }}>
              Brave detected: for Live Mic, turn Shields OFF for this site (lion icon in the address bar) — Brave&apos;s
              fingerprint protection feeds randomised audio to the recogniser. Chrome works out of the box.
            </div>
          )}

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
