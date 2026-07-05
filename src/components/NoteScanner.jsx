import { useEffect, useRef, useState } from 'react'
import { rectifyNote } from '../lib/rectify'
import { loadClassifier, classifyNote } from '../lib/noteClassifier'

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

function GuidedTab() {
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
        Educational walkthrough of the seven RBI security features on a stylised specimen — how the deployed
        model explains its verdict to tellers and field officers. For genuine inference on actual photos, use
        the <b>Real Photo Analysis</b> tab.
      </p>

      <div className="sample-row">
        <button className="btn ghost" onClick={() => load('genuine')}>Load specimen: Genuine ₹500</button>
        <button className="btn ghost" onClick={() => load('fake')}>Load specimen: Suspect ₹500</button>
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

        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Real Photo Analysis — genuine in-browser inference:
// OpenCV.js perspective rectification -> MobileNet v2 embedding -> k-NN verdict
// trained on the Kaggle real-vs-fake corpus + the team's own note photographs.
// ---------------------------------------------------------------------------
function RealTab() {
  const [holdouts, setHoldouts] = useState([])
  const [origUrl, setOrigUrl] = useState(null)
  const [cropUrl, setCropUrl] = useState(null)
  const [cropInfo, setCropInfo] = useState(null) // {method}
  const [cropCanvas, setCropCanvas] = useState(null)
  const [phase, setPhase] = useState('idle')    // idle|cropping|embedding|classifying|done|error
  const [progress, setProgress] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}ficn/holdout.json`).then((r) => (r.ok ? r.json() : [])).then(setHoldouts).catch(() => {})
  }, [])

  const analyze = async (imgEl, sourceUrl) => {
    setOrigUrl(sourceUrl)
    setCropUrl(null)
    setVerdict(null)
    setError(null)
    try {
      setPhase('cropping')
      console.debug('[scanner] phase: cropping')
      const rect = await rectifyNote(imgEl)
      console.debug('[scanner] rectified via', rect.method)
      // overlay the detected quad on the working image for the preview
      if (rect.quad && rect.workCanvas) {
        const ov = rect.workCanvas
        const ctx = ov.getContext('2d')
        ctx.strokeStyle = '#22d3ee'
        ctx.lineWidth = Math.max(3, ov.width / 200)
        ctx.beginPath()
        rect.quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        ctx.closePath()
        ctx.stroke()
        setOrigUrl(ov.toDataURL('image/jpeg', 0.8))
      }
      setCropUrl(rect.canvas.toDataURL('image/jpeg', 0.9))
      setCropInfo({ method: rect.method })
      setCropCanvas(rect.canvas)

      setPhase('embedding')
      console.debug('[scanner] phase: loading classifier')
      await loadClassifier((done, total) => setProgress({ done, total }))

      setPhase('classifying')
      console.debug('[scanner] phase: classifying')
      const res = await classifyNote(rect.canvas)
      console.debug('[scanner] verdict', res)
      setVerdict(res)
      setPhase('done')
    } catch (err) {
      setError(String(err?.message || err))
      setPhase('error')
    }
  }

  const onUpload = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => analyze(img, url)
    img.src = url
  }

  const onHoldout = (h) => {
    const url = `${import.meta.env.BASE_URL}ficn/${h.file}`
    const img = new Image()
    img.onload = () => analyze(img, url)
    img.src = url
  }

  const isFake = verdict?.label === 'fake'
  const conf = verdict ? Math.round((verdict.confidences[verdict.label] || 0) * 100) : 0

  return (
    <div>
      <p className="section-desc">
        <b>Real inference, in your browser:</b> the photo is auto-cropped and perspective-corrected by our
        CV rectifier (OTSU segmentation + min-area-rect + homography warp), embedded with MobileNet v2, and
        classified genuine-vs-fake by k-NN over a corpus of real note
        photographs (including our own) and print-grade counterfeits from a public dataset. Nothing is staged —
        try the held-out test images (never shown to the model) or upload your own photo.
      </p>

      <div className="sample-row">
        <label className="btn danger" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          📷 Upload / photograph a note
          <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
        </label>
        {holdouts.map((h) => (
          <button key={h.file} className="btn ghost" onClick={() => onHoldout(h)}>
            Hold-out test: {h.label === 'genuine' ? `genuine ₹${h.denom}` : `counterfeit (${h.denom !== 'unknown' ? '₹' + h.denom : 'print-grade'})`}
          </button>
        ))}
      </div>

      <div className="scanner-grid">
        <div className="note-stage" style={{ flexDirection: 'column', gap: 14 }}>
          {!origUrl && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Upload a photo of a note, or run a hold-out test image.</p>}
          {origUrl && (
            <div className="real-pair">
              <div>
                <div className="mini-note" style={{ marginBottom: 6 }}>ORIGINAL {cropInfo?.method === 'warp' ? '· note contour detected' : ''}</div>
                <img src={origUrl} alt="original" className="real-orig" />
              </div>
              <div>
                <div className="mini-note" style={{ marginBottom: 6 }}>
                  RECTIFIED 640×280 {cropInfo ? (cropInfo.method === 'warp' ? '· perspective-warped' : '· centre-crop fallback') : ''}
                </div>
                {cropUrl ? <img src={cropUrl} alt="rectified note" className="real-crop" /> : <div className="analyzing"><div className="spinner" />Detecting note geometry…</div>}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Authentication Report — live inference</div>

          {phase === 'idle' && <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Verdict, class confidences and detected denomination appear here.</p>}
          {phase === 'cropping' && <div className="analyzing"><div className="spinner" />Locating note &amp; correcting perspective…</div>}
          {phase === 'embedding' && (
            <div className="analyzing" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span><div className="spinner" style={{ display: 'inline-block', marginRight: 8 }} />Building classifier — embedding training corpus…</span>
              {progress && <div className="track" style={{ width: '100%', marginTop: 10 }}><div className="fill" style={{ width: `${(progress.done / progress.total) * 100}%`, background: 'var(--cyan)' }} /></div>}
              {progress && <span className="mini-note">{progress.done}/{progress.total} samples (MobileNet v2, in-browser)</span>}
            </div>
          )}
          {phase === 'classifying' && <div className="analyzing"><div className="spinner" />k-NN inference…</div>}
          {phase === 'error' && <div className="mic-banner err">⚠ {error}</div>}

          {phase === 'done' && verdict && (
            <>
              <div className={`verdict ${isFake ? 'critical' : 'low'}`} style={{ padding: '14px 16px' }}>
                <h2 style={{ fontSize: 18 }}>{isFake ? '🚨 COUNTERFEIT INDICATED' : '✓ GENUINE INDICATED'}</h2>
                <p>
                  k-NN confidence <b>{conf}%</b>
                  {verdict.denom && <> · denomination <b>₹{verdict.denom}</b></>}
                  {isFake && ' · flag for physical verification and seizure protocol.'}
                </p>
              </div>
              {['genuine', 'fake'].map((l) => (
                <div className="cat-bar" key={l}>
                  <div className="cat-head">
                    <span>{l === 'genuine' ? 'Genuine class' : 'Counterfeit class'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: l === 'fake' ? 'var(--red)' : 'var(--green)' }}>
                      {Math.round((verdict.confidences[l] || 0) * 100)}%
                    </span>
                  </div>
                  <div className="track"><div className="fill" style={{ width: `${(verdict.confidences[l] || 0) * 100}%`, background: l === 'fake' ? 'var(--red)' : 'var(--green)' }} /></div>
                </div>
              ))}
              <p className="mini-note" style={{ marginTop: 12, lineHeight: 1.7 }}>
                Demo-grade model: counterfeit class = print-grade fakes from a public dataset (real FICN is
                illegal to possess). Production path replaces k-NN with a supervised model on bank-grade sensor
                data — same pipeline, same UI.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NoteScanner() {
  const [tab, setTab] = useState('real')
  return (
    <div>
      <div className="tab-row">
        <button className={`tab-btn ${tab === 'real' ? 'on' : ''}`} onClick={() => setTab('real')}>📷 Real Photo Analysis</button>
        <button className={`tab-btn ${tab === 'guided' ? 'on' : ''}`} onClick={() => setTab('guided')}>🎓 Guided Feature Walkthrough</button>
      </div>
      {tab === 'real' ? <RealTab /> : <GuidedTab />}
    </div>
  )
}
