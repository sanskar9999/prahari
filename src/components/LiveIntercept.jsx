import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeTranscript, highlightTranscript } from '../lib/scamEngine'
import { CALL_META, CALL_SCRIPT, AGENT_EVENTS, VOICE_RAMP, DEEPFAKE_RAMP, INTERVENTION_ACTIONS } from '../lib/callScript'

const WORDS = CALL_SCRIPT.map((s) => s.text.split(/\s+/))
const TICK_MS = 105

const initialSim = () => ({
  running: false, seg: 0, word: 0, tick: 0,
  firedEvents: [], log: [], intervened: false, finished: false,
})

function nextState(prev) {
  if (!prev.running || prev.intervened || prev.finished) return prev
  let { seg, word } = prev
  word += 1
  if (word > WORDS[seg].length) {
    if (seg + 1 >= CALL_SCRIPT.length) {
      return { ...prev, finished: true, running: false, tick: prev.tick + 1 }
    }
    seg += 1
    word = 1
  }
  const fired = [...prev.firedEvents]
  const log = [...prev.log]
  AGENT_EVENTS.forEach((e, i) => {
    if (!fired.includes(i) && (e.seg < seg || (e.seg === seg && e.word <= word))) {
      fired.push(i)
      log.push({ ...e, tick: prev.tick })
    }
  })
  // live risk on everything streamed so far
  const text = CALL_SCRIPT.slice(0, seg).map((s) => s.text).join(' ') + ' ' + WORDS[seg].slice(0, word).join(' ')
  const analysis = analyzeTranscript(text)
  const financialHit = analysis.categories.find((c) => c.id === 'financial')?.hits > 0
  const intervened = analysis.riskScore >= 70 && financialHit
  if (intervened) {
    log.push({ agent: 'Fusion', sev: 'critical', msg: `INTERVENTION THRESHOLD CROSSED — risk ${analysis.riskScore}/100 with active extraction attempt. Executing response protocol.`, tick: prev.tick })
  }
  return { ...prev, seg, word, tick: prev.tick + 1, firedEvents: fired, log, intervened, running: !intervened }
}

function Radial({ value, label, sub, color, size = 118 }) {
  const r = size / 2 - 9
  const c = 2 * Math.PI * r
  return (
    <div className="radial">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1b2a47" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.5s' }} />
        <text x="50%" y="47%" textAnchor="middle" fill={color} fontSize={size / 4.4} fontWeight="700" fontFamily="Rajdhani">{Math.round(value)}</text>
        <text x="50%" y="62%" textAnchor="middle" fill="#7c8db0" fontSize="9" fontFamily="IBM Plex Mono">{sub}</text>
      </svg>
      <div className="radial-label">{label}</div>
    </div>
  )
}

function Waveform({ active, heat }) {
  const ref = useRef(null)
  const stateRef = useRef({ active, heat })
  stateRef.current = { active, heat }
  useEffect(() => {
    const cv = ref.current
    const ctx = cv.getContext('2d')
    let raf
    const draw = () => {
      const { active, heat } = stateRef.current
      const w = cv.width, h = cv.height, n = 56
      ctx.clearRect(0, 0, w, h)
      const bw = w / n
      for (let i = 0; i < n; i++) {
        const amp = active ? (0.15 + Math.random() * 0.85) : 0.06 + Math.random() * 0.05
        const bh = amp * h * 0.9
        const t = i / n
        const r = Math.round(34 + (248 - 34) * heat)
        const g = Math.round(211 - (211 - 83) * heat)
        const b = Math.round(238 - (238 - 107) * heat)
        ctx.fillStyle = `rgba(${r},${g},${b},${0.35 + 0.65 * Math.abs(Math.sin(t * Math.PI))})`
        ctx.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh)
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} width={520} height={54} className="waveform" />
}

function FaceMesh({ df }) {
  const hot = df >= 80
  return (
    <div className={`videoframe ${hot ? 'hot' : ''}`}>
      <svg viewBox="0 0 160 120">
        <rect width="160" height="120" fill="#0a0f1e" />
        {/* fake "police office" backdrop lines */}
        <line x1="0" y1="28" x2="160" y2="26" stroke="#16233f" strokeWidth="1" />
        <rect x="118" y="10" width="34" height="22" fill="none" stroke="#16233f" />
        {/* head */}
        <ellipse cx="80" cy="62" rx="30" ry="38" fill="none" stroke="#22d3ee" strokeWidth="0.8" opacity="0.85" />
        {/* landmark mesh */}
        {[[62,50],[80,46],[98,50],[66,64],[80,62],[94,64],[70,80],[80,84],[90,80],[74,52],[86,52],[80,72]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r="1.4" fill="#22d3ee" opacity="0.9">
            <animate attributeName="cy" values={`${y};${y + (i % 3) - 1};${y}`} dur={`${0.9 + (i % 5) * 0.13}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <polyline points="62,50 80,46 98,50 94,64 90,80 80,84 70,80 66,64 62,50" fill="none" stroke="#22d3ee" strokeWidth="0.5" opacity="0.55" />
        <polyline points="66,64 80,62 94,64 M74,52 80,62 86,52 M70,80 80,72 90,80" fill="none" stroke="#22d3ee" strokeWidth="0.4" opacity="0.4" />
        {/* face-swap artefact markers */}
        {hot && <>
          <rect x="58" y="42" width="18" height="14" fill="none" stroke="#f8536b" strokeWidth="1" />
          <rect x="86" y="70" width="16" height="16" fill="none" stroke="#f8536b" strokeWidth="1" />
          <text x="6" y="112" fontSize="7" fill="#f8536b" fontFamily="monospace">BLEND-BOUNDARY ARTEFACTS</text>
        </>}
        <rect x="0" y="0" width="160" height="120" fill="none" stroke={hot ? '#f8536b' : '#1e2d4a'} strokeWidth="2" />
      </svg>
      <div className="vf-scan" />
      <div className={`vf-tag ${hot ? 'bad' : ''}`}>{hot ? `DEEPFAKE ${df}%` : `FACE ANALYSIS ${df}%`}</div>
    </div>
  )
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.22].forEach((t, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.frequency.value = i ? 660 : 880; o.type = 'square'
      g.gain.setValueAtTime(0.06, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2)
    })
  } catch { /* audio optional */ }
}

export default function LiveIntercept() {
  const [sim, setSim] = useState(initialSim)
  const [overlay, setOverlay] = useState(false)
  const intRef = useRef(null)
  const scrollRef = useRef(null)

  const start = () => {
    clearInterval(intRef.current)
    setSim({ ...initialSim(), running: true })
    setOverlay(false)
    intRef.current = setInterval(() => setSim(nextState), TICK_MS)
  }
  useEffect(() => () => clearInterval(intRef.current), [])

  useEffect(() => {
    if (sim.intervened) {
      clearInterval(intRef.current)
      beep()
      const t = setTimeout(() => setOverlay(true), 450)
      return () => clearTimeout(t)
    }
  }, [sim.intervened])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [sim.tick])

  const streamedText = useMemo(() => {
    if (sim.tick === 0) return ''
    return CALL_SCRIPT.slice(0, sim.seg).map((s) => s.text).join(' ') + ' ' + WORDS[sim.seg].slice(0, sim.word).join(' ')
  }, [sim.seg, sim.word, sim.tick])

  const analysis = useMemo(() => analyzeTranscript(streamedText), [streamedText])
  const risk = sim.tick === 0 ? 0 : analysis.riskScore
  const voice = sim.tick === 0 ? 0 : VOICE_RAMP[sim.seg]
  const df = sim.tick === 0 ? 0 : DEEPFAKE_RAMP[sim.seg]
  const riskColor = risk >= 70 ? 'var(--red)' : risk >= 35 ? 'var(--amber)' : 'var(--green)'
  const started = sim.tick > 0
  const callerSpeaking = sim.running && CALL_SCRIPT[sim.seg].speaker === 'CALLER'

  const renderSeg = (segIdx, partialWords) => {
    const s = CALL_SCRIPT[segIdx]
    const text = partialWords ? WORDS[segIdx].slice(0, partialWords).join(' ') : s.text
    const segAnalysis = analyzeTranscript(text)
    return (
      <div className={`ts-line ${s.speaker.toLowerCase()}`} key={segIdx}>
        <span className="ts-speaker">{s.speaker === 'CALLER' ? '☎ CALLER' : '👤 VICTIM'}</span>
        <span>
          {highlightTranscript(text, segAnalysis.categories).map((p, i) =>
            p.cat ? <mark key={i} className={p.cat}>{p.text}</mark> : <span key={i}>{p.text}</span>
          )}
          {partialWords && sim.running && <span className="cursor">▌</span>}
        </span>
      </div>
    )
  }

  return (
    <div>
      <p className="section-desc">
        A synthetic digital-arrest call replayed against the live pipeline: speech, video and script agents
        stream verdicts into the fusion engine while the transcript is still being spoken. Watch PRAHARI cross the
        intervention threshold and cut the scam off <b>inside the pre-transfer window</b>.
      </p>

      <div className="li-toolbar">
        <button className="btn danger" onClick={start}>{started ? '↻ Replay Simulation' : '▶ Begin Live Intercept Simulation'}</button>
        <span className="sim-badge">SIMULATED CALL — synthetic voices &amp; entities</span>
        {started && (
          <span className="call-meta">
            {CALL_META.callerId} · presents as “{CALL_META.presented}” · <b style={{ color: 'var(--red)' }}>SPOOFED</b> ({CALL_META.sipOrigin}) → {CALL_META.victim}
          </span>
        )}
      </div>

      <div className="li-grid">
        <div>
          <div className="card li-callpanel">
            <div className="li-media">
              <FaceMesh df={df} />
              <div className="li-voice">
                <div className="card-title" style={{ marginBottom: 8 }}>Live Audio — VoiceGuard</div>
                <Waveform active={callerSpeaking} heat={Math.min(1, voice / 100)} />
                <div className="voice-meter">
                  <span>Synthetic voice probability</span>
                  <b style={{ color: voice >= 70 ? 'var(--red)' : voice >= 40 ? 'var(--amber)' : 'var(--green)' }}>{voice}%</b>
                </div>
                <div className="track"><div className="fill" style={{ width: `${voice}%`, background: voice >= 70 ? 'var(--red)' : 'var(--amber)' }} /></div>
              </div>
            </div>

            <div className="card-title" style={{ margin: '14px 0 8px' }}>Live Transcript — ScriptGuard signal overlay</div>
            <div className="ts-window" ref={scrollRef}>
              {!started && <div className="ts-idle">Awaiting call… press <b>Begin Live Intercept Simulation</b>.</div>}
              {Array.from({ length: sim.seg }, (_, i) => renderSeg(i))}
              {started && renderSeg(sim.seg, sim.word)}
              {sim.intervened && (
                <div className="ts-line system">
                  <span className="ts-speaker">⛔ PRAHARI</span>
                  <span>CALL FLAGGED — victim alerted, transfer window closed. Intervention at T+{Math.round(sim.tick * TICK_MS / 1000)}s of call audio.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="li-right">
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="card-title">Fusion Risk</div>
            <div className="radial-row">
              <Radial value={risk} label="COMPOSITE RISK" sub="/100" color={riskColor} size={132} />
              <div className="mini-radials">
                <Radial value={voice} label="AI VOICE" sub="%" color={voice >= 70 ? 'var(--red)' : 'var(--cyan)'} size={84} />
                <Radial value={df} label="DEEPFAKE" sub="%" color={df >= 80 ? 'var(--red)' : 'var(--cyan)'} size={84} />
              </div>
            </div>
            {analysis.categories.map((c) => (
              <div className="cat-bar" key={c.id}>
                <div className="cat-head"><span>{c.label}</span><span style={{ color: c.color }}>{c.hits}</span></div>
                <div className="track"><div className="fill" style={{ width: `${(c.score / c.weight) * 100}%`, background: c.color }} /></div>
              </div>
            ))}
          </div>

          <div className="card" style={{ flex: 1, minHeight: 0 }}>
            <div className="card-title">Agent Activity — multi-source fusion</div>
            <div className="agent-feed">
              {sim.log.length === 0 && <div className="ts-idle">Agents idle.</div>}
              {[...sim.log].reverse().map((e, i) => (
                <div className={`agent-item ${e.sev}`} key={`${e.msg}-${i}`}>
                  <span className="agent-name">{e.agent}</span>
                  {e.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {overlay && (
        <div className="takeover">
          <div className="takeover-inner">
            <div className="takeover-title">⛔ DIGITAL ARREST INTERCEPTED</div>
            <div className="takeover-sub">
              Scam confirmed at <b>risk {risk}/100</b> during active extraction attempt — intervention executed
              <b> before any transfer occurred</b>.
            </div>
            <div className="takeover-cols">
              <div className="takeover-actions">
                {INTERVENTION_ACTIONS.map((a, i) => (
                  <div className="ta-item" style={{ animationDelay: `${0.35 + i * 0.5}s` }} key={a}>✓ {a}</div>
                ))}
              </div>
              <div className="phone">
                <div className="phone-notch" />
                <div className="phone-time">14:32</div>
                <div className="phone-notif" style={{ animationDelay: '0.6s' }}>
                  <div className="pn-app">🛡 PRAHARI SURAKSHA</div>
                  <div className="pn-title">⚠️ यह कॉल एक घोटाला है — This call is a scam</div>
                  <div className="pn-body">No police or CBI officer arrests anyone over video call or asks for money. Disconnect now. पैसे ट्रांसफर न करें। Dial 1930 for help.</div>
                </div>
                <div className="phone-notif alt" style={{ animationDelay: '1.4s' }}>
                  <div className="pn-app">🏦 YOUR BANK</div>
                  <div className="pn-body">Precautionary hold placed on high-value transfers for 24h at PRAHARI advisory. Visit branch to override.</div>
                </div>
              </div>
            </div>
            <button className="btn" onClick={() => setOverlay(false)}>Return to console</button>
          </div>
        </div>
      )}
    </div>
  )
}
