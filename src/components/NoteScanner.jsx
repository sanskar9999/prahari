import { useRef, useState } from 'react'

// Stylised ₹500 specimen (SVG) — demo stand-in for camera capture.
function NoteSVG({ fake }) {
  return (
    <svg viewBox="0 0 660 290" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9aa3ad" />
          <stop offset="0.5" stopColor="#b8bfc7" />
          <stop offset="1" stopColor="#8f99a4" />
        </linearGradient>
      </defs>
      <rect width="660" height="290" rx="8" fill="url(#paper)" />
      <rect x="8" y="8" width="644" height="274" rx="5" fill="none" stroke="#6b7480" strokeWidth="1.5" />

      {/* see-through register + guilloche left */}
      <circle cx="52" cy="70" r="22" fill="none" stroke="#5f6873" strokeWidth="1.2" strokeDasharray="3 2" />
      <text x="52" y="75" textAnchor="middle" fontSize="14" fill="#4a525c" fontFamily="serif">₹</text>

      {/* denomination numeral */}
      <text x="60" y="230" fontSize="58" fontWeight="700" fill="#3f4750" fontFamily="serif">500</text>

      {/* security thread */}
      <rect x={fake ? 300 : 277} y="8" width={fake ? 3 : 6} height="274"
        fill={fake ? '#8a929c' : '#3b434d'} opacity={fake ? 0.45 : 0.9} />
      {!fake && [30, 70, 110, 150, 190, 230].map((y) => (
        <text key={y} x="280" y={y} fontSize="7" fill="#c8d0d8" fontFamily="monospace" transform={`rotate(90 280 ${y})`}>भारत RBI</text>
      ))}

      {/* portrait */}
      <ellipse cx="390" cy="140" rx="52" ry="68" fill="#a7afb8" stroke="#5f6873" strokeWidth={fake ? 0.6 : 1.4} />
      <ellipse cx="390" cy="118" rx="24" ry="27" fill="#949ca6" opacity={fake ? 0.5 : 0.9} />
      <path d="M 358 175 Q 390 195 422 175 L 422 205 L 358 205 Z" fill="#949ca6" opacity={fake ? 0.5 : 0.9} />

      {/* microlettering strip */}
      <text x="330" y="220" fontSize={fake ? 5 : 3.4} fill={fake ? '#7d858f' : '#4a525c'}
        fontFamily="monospace" opacity={fake ? 0.5 : 1} letterSpacing="0.5">
        {'RBI500RBI500RBI500RBI500RBI500RBI500'}
      </text>

      {/* watermark window */}
      <rect x="480" y="60" width="90" height="150" rx="6" fill="#c2c9d1" opacity="0.65" />
      {!fake && <ellipse cx="525" cy="128" rx="30" ry="40" fill="#aeb6bf" opacity="0.8" />}
      {!fake && <text x="525" y="185" textAnchor="middle" fontSize="20" fill="#9ba3ad" fontFamily="serif" opacity="0.9">500</text>}

      {/* header + promise text */}
      <text x="330" y="34" fontSize="13" fill="#3f4750" fontFamily="serif" fontWeight="600">भारतीय रिज़र्व बैंक</text>
      <text x="330" y="50" fontSize="9" fill="#4a525c" fontFamily="serif">RESERVE BANK OF INDIA</text>
      <text x="150" y="120" fontSize="8" fill="#565e68" fontFamily="serif">I PROMISE TO PAY THE BEARER</text>
      <text x="150" y="132" fontSize="8" fill="#565e68" fontFamily="serif">THE SUM OF FIVE HUNDRED RUPEES</text>

      {/* serial numbers */}
      <text x="30" y="272" fontSize="13" fill={fake ? '#4a525c' : '#2f5e2f'} fontFamily="monospace" fontWeight="600">
        {fake ? '8KD 411683' : '8KD 411927'}
      </text>
      <text x="530" y="272" fontSize="15" fill={fake ? '#4a525c' : '#2f5e2f'} fontFamily="monospace" fontWeight="700">
        {fake ? '8KD 411683' : '8KD 411927'}
      </text>

      {/* denomination right */}
      <text x="590" y="60" fontSize="30" fontWeight="700" fill="#3f4750" fontFamily="serif">500</text>
      {/* swachh bharat / year strip */}
      <text x="480" y="240" fontSize="7" fill="#565e68" fontFamily="serif">© RBI · SPECIMEN — DEMO RENDER</text>
    </svg>
  )
}

// ROI overlays: [x%, y%, w%, h%]
const FEATURES = [
  { name: 'Security thread (windowed, colour-shift)', roi: [40, 2, 4, 96], genuine: [true, 99.1], fake: [false, 11.8], note: 'Thread absent / printed line only' },
  { name: 'Mahatma Gandhi watermark + electrotype', roi: [72, 20, 15, 53], genuine: [true, 97.6], fake: [false, 23.4], note: 'No multi-tonal watermark detected' },
  { name: 'Microlettering "RBI 500"', roi: [49, 71, 22, 8], genuine: [true, 96.2], fake: [false, 31.0], note: 'Letters blurred — offset print, not intaglio' },
  { name: 'Portrait intaglio relief', roi: [50, 24, 17, 48], genuine: [true, 95.8], fake: [false, 42.5], note: 'Flat print — no raised-ink signature' },
  { name: 'See-through register (₹ motif)', roi: [4, 16, 10, 22], genuine: [true, 94.9], fake: [true, 88.1], note: '' },
  { name: 'Serial number font & ascending pattern', roi: [78, 88, 18, 9], genuine: [true, 98.4], fake: [false, 8.2], note: 'Serial 8KD 411683 matches seized batch #F-118 (Malda)' },
  { name: 'Latent image & colour-shift ink (₹500)', roi: [86, 12, 11, 12], genuine: [true, 93.7], fake: [false, 37.9], note: 'No angle-dependent colour shift' },
]

export default function NoteScanner() {
  const [variant, setVariant] = useState(null) // 'genuine' | 'fake' | 'upload'
  const [imgSrc, setImgSrc] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | scanning | done
  const [shown, setShown] = useState(0)
  const timers = useRef([])

  const reset = () => { timers.current.forEach(clearTimeout); timers.current = []; setPhase('idle'); setShown(0) }

  const load = (v, src = null) => { reset(); setVariant(v); setImgSrc(src) }

  const onUpload = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    load('upload', URL.createObjectURL(f))
  }

  const scan = () => {
    reset()
    setPhase('scanning')
    FEATURES.forEach((_, i) => {
      timers.current.push(setTimeout(() => setShown(i + 1), 600 + i * 420))
    })
    timers.current.push(setTimeout(() => setPhase('done'), 600 + FEATURES.length * 420 + 500))
  }

  const isFake = variant === 'fake'
  const results = FEATURES.map((f) => {
    const [pass, conf] = isFake ? f.fake : f.genuine
    return { ...f, pass, conf }
  })
  const passCount = results.filter((r) => r.pass).length
  const authenticity = isFake ? 14.6 : 97.3

  return (
    <div>
      <p className="section-desc">
        Computer-vision counterfeit detection deployable on any smartphone camera, bank counting machine or PoS
        terminal. The model verifies seven RBI security features and cross-checks the serial number against the
        national FICN seizure database — instant verdict for tellers and field officers.
      </p>

      <div className="sample-row">
        <button className="btn ghost" onClick={() => load('genuine')}>Load specimen: Genuine ₹500</button>
        <button className="btn ghost" onClick={() => load('fake')}>Load specimen: Suspect ₹500</button>
        <label className="btn ghost" style={{ display: 'inline-flex', alignItems: 'center' }}>
          📷 Upload note photo
          <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
        </label>
        {variant && <button className="btn danger" onClick={scan} disabled={phase === 'scanning'}>
          {phase === 'scanning' ? 'Scanning…' : '⚡ Run Authentication'}
        </button>}
      </div>

      <div className="scanner-grid">
        <div className="note-stage">
          {!variant && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Load a specimen or upload a photo of a note to begin.</p>}
          {variant && (
            <div className="note-holder">
              {variant === 'upload' ? <img src={imgSrc} alt="uploaded note" /> : <NoteSVG fake={isFake} />}
              {phase === 'scanning' && <div className="scan-line" />}
              {phase !== 'idle' && variant !== 'upload' &&
                results.slice(0, shown).map((r) => (
                  <div key={r.name} className={`roi ${r.pass ? 'pass' : 'fail'}`}
                    style={{ left: `${r.roi[0]}%`, top: `${r.roi[1]}%`, width: `${r.roi[2]}%`, height: `${r.roi[3]}%` }}>
                    <span>{r.pass ? '✓' : '✗'} {r.conf.toFixed(1)}%</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Authentication Report</div>

          {phase === 'idle' && <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Run authentication to verify security features.</p>}

          {phase !== 'idle' && variant !== 'upload' && (
            <>
              {phase === 'done' && (
                <div className={`verdict ${isFake ? 'critical' : 'low'}`} style={{ padding: '14px 16px' }}>
                  <h2 style={{ fontSize: 18 }}>{isFake ? '🚨 COUNTERFEIT DETECTED' : '✓ NOTE AUTHENTIC'}</h2>
                  <p>
                    Authenticity score: <b>{authenticity}%</b> · {passCount}/{FEATURES.length} security features verified.
                    {isFake && ' Note quarantined. Seizure report pre-filled for NCRB FICN registry; serial batch linked to Malda corridor.'}
                  </p>
                </div>
              )}
              {results.slice(0, shown).map((r) => (
                <div className="feature-row" key={r.name}>
                  <div style={{ maxWidth: '62%' }}>
                    {r.name}
                    {!r.pass && r.note && <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 2 }}>{r.note}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="conf" style={{ color: r.pass ? 'var(--green)' : 'var(--red)' }}>{r.conf.toFixed(1)}%</span>
                    <span className={`badge ${r.pass ? 'pass' : 'fail'}`}>{r.pass ? 'PASS' : 'FAIL'}</span>
                  </div>
                </div>
              ))}
              {shown < FEATURES.length && phase === 'scanning' && (
                <div className="analyzing"><div className="spinner" />Verifying feature {shown + 1}/{FEATURES.length}…</div>
              )}
            </>
          )}

          {phase !== 'idle' && variant === 'upload' && (
            <div className="analyzing" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              {phase === 'scanning' && <><div className="spinner" /><span>Extracting note geometry &amp; features…</span></>}
              {phase === 'done' && (
                <p style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.7 }}>
                  Uploaded-image pipeline requires the full model weights (not bundled in this demo build).
                  Use the specimen notes for the end-to-end authentication flow.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
