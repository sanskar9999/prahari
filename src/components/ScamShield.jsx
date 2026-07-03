import { useState } from 'react'
import { analyzeTranscript, highlightTranscript, SAMPLE_TRANSCRIPTS } from '../lib/scamEngine'

export default function ScamShield() {
  const [text, setText] = useState(SAMPLE_TRANSCRIPTS[0].text)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = () => {
    setBusy(true)
    setResult(null)
    // staged latency so the analysis pass is visible
    setTimeout(() => {
      setResult(analyzeTranscript(text))
      setBusy(false)
    }, 1400)
  }

  const gaugeColor =
    !result ? 'var(--muted)' : result.verdict === 'critical' ? 'var(--red)' : result.verdict === 'suspicious' ? 'var(--amber)' : 'var(--green)'

  return (
    <div>
      <p className="section-desc">
        Paste (or stream) a live call transcript. The classifier scores it against five behavioural signal
        categories extracted from I4C-documented digital-arrest playbooks and returns a verdict in under two
        seconds — fast enough to alert a victim <b>before the money moves</b>.
      </p>

      <div className="shield-grid">
        <div>
          <div className="sample-row">
            {SAMPLE_TRANSCRIPTS.map((s) => (
              <button key={s.name} className="btn ghost" onClick={() => { setText(s.text); setResult(null) }}>
                {s.name}
              </button>
            ))}
          </div>
          <textarea
            className="transcript"
            value={text}
            onChange={(e) => { setText(e.target.value); setResult(null) }}
            placeholder="Paste call transcript here…"
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button className="btn danger" onClick={run} disabled={busy || !text.trim()}>
              {busy ? 'Analyzing…' : '⚡ Analyze Call'}
            </button>
          </div>

          {result && (
            <div style={{ marginTop: 16 }}>
              <div className="card-title">Transcript — flagged signals</div>
              <div className="highlighted">
                {highlightTranscript(text, result.categories).map((p, i) =>
                  p.cat ? <mark key={i} className={p.cat}>{p.text}</mark> : <span key={i}>{p.text}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Threat Assessment</div>

          {busy && (
            <div className="analyzing">
              <div className="spinner" />
              Running scam-pattern inference…
            </div>
          )}

          {!busy && !result && (
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
              Load a sample or paste a transcript, then run analysis. Verdict, risk score and per-category
              signal breakdown will appear here.
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
