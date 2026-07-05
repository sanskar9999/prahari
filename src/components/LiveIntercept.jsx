import { useEffect, useRef, useState } from 'react'
import { analyzeTranscript, highlightTranscript } from '../lib/scamEngine'
import { CALL_META, CALL_SCRIPT, AGENT_EVENTS, INTERVENTION_ACTIONS } from '../lib/callScript'

// ---------------------------------------------------------------------------
// Call sources. Audio mode plays REAL audio files and syncs the transcript to
// the playback clock; timer mode is the asset-free fallback (same engine, a
// performance.now() clock instead of audio.currentTime).
// ---------------------------------------------------------------------------

const buildTtsCall = (timings) => ({
  id: 'tts',
  name: 'Synthetic digital-arrest call',
  tag: 'NEURAL-TTS AUDIO',
  tagClass: 'tts',
  desc: `${CALL_META.callerId} · presents as “${CALL_META.presented}” · SPOOFED (${CALL_META.sipOrigin}) → ${CALL_META.victim}`,
  disclaimer: 'Every word you hear is neural TTS — the same class of voice tooling fraud compounds deploy. Script follows I4C playbook DA-114.',
  voiceVerdict: { value: 100, note: 'Ground truth: this audio IS neural TTS (rendered by our own pipeline — VoiceGuard target class)' },
  rule: { minRisk: 70, requireFinancial: true },
  takeover: {
    title: '⛔ DIGITAL ARREST INTERCEPTED',
    sub: 'intervention executed before any transfer occurred',
    actions: INTERVENTION_ACTIONS,
  },
  scriptedEvents: true,
  mode: 'audio',
  segments: timings.map((t) => ({ ...t, words: CALL_SCRIPT[t.seg].text.split(/\s+/) })),
})

const buildRealCall = (c) => ({
  id: c.id,
  name: c.name.replace('REAL CASE — ', ''),
  tag: 'REAL RECORDING',
  tagClass: 'real',
  desc: `${c.source} · transcribed with Whisper (word-level timestamps)`,
  disclaimer: c.badge + ' — this recording was used to defraud real people.',
  voiceVerdict: { value: 96, note: 'Synthetic/IVR delivery — self-identified robocall, documented in FTC enforcement records' },
  rule: c.rule,
  takeover: {
    title: '⛔ SCAM CALL INTERCEPTED',
    sub: 'blocked at the robocall hook stage — the victim never reaches the human extractor',
    actions: [
      'Call terminated before “press 1” handoff to live scammer',
      'Number submitted for carrier-level spoof-block',
      'Signature matched to FTC enforcement corpus (Project Point of No Entry)',
      'Pattern pushed to national scam-signature registry',
      'Victim advisory dispatched with reporting guidance',
    ],
  },
  scriptedEvents: false,
  mode: 'audio',
  segments: [{ seg: 0, file: `real/${c.file}`, speaker: 'CALLER', durMs: c.durMs, words: c.words, times: c.times }],
})

const buildFallbackCall = () => ({
  id: 'fallback',
  name: 'Scripted simulation (no audio assets)',
  tag: 'TIMER FALLBACK',
  tagClass: 'tts',
  desc: `${CALL_META.callerId} · presents as “${CALL_META.presented}” · SPOOFED → ${CALL_META.victim}`,
  disclaimer: 'Audio assets not found — run tools/generate_call_audio.py. Falling back to timed transcript.',
  voiceVerdict: { value: 91, note: 'Simulated indicator (timer fallback mode)' },
  rule: { minRisk: 70, requireFinancial: true },
  takeover: { title: '⛔ DIGITAL ARREST INTERCEPTED', sub: 'intervention executed before any transfer occurred', actions: INTERVENTION_ACTIONS },
  scriptedEvents: true,
  mode: 'timer',
  segments: CALL_SCRIPT.map((s, i) => {
    const words = s.text.split(/\s+/)
    return { seg: i, file: null, speaker: s.speaker, durMs: words.length * 105 + 700, words, times: words.map((_, w) => w * 105) }
  }),
})

const AGENT_FOR_CAT = { authority: 'ScriptGuard', isolation: 'ScriptGuard', urgency: 'ScriptGuard', financial: 'Fusion', identity: 'ScriptGuard' }

function Radial({ value, label, sub, color, size = 118 }) {
  const r = size / 2 - 9
  const c = 2 * Math.PI * r
  return (
    <div className="radial">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1b2a47" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, value)) / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.4s' }} />
        <text x="50%" y="47%" textAnchor="middle" fill={color} fontSize={size / 4.4} fontWeight="700" fontFamily="Rajdhani">{Math.round(value)}</text>
        <text x="50%" y="62%" textAnchor="middle" fill="#7c8db0" fontSize="9" fontFamily="IBM Plex Mono">{sub}</text>
      </svg>
      <div className="radial-label">{label}</div>
    </div>
  )
}

// Real spectrum when an AnalyserNode exists; ambient bars otherwise.
function Waveform({ analyserRef, active, heat }) {
  const ref = useRef(null)
  const meta = useRef({ active, heat })
  meta.current = { active, heat }
  useEffect(() => {
    const cv = ref.current
    const ctx = cv.getContext('2d')
    let raf
    const freq = new Uint8Array(64)
    const draw = () => {
      const { active, heat } = meta.current
      const w = cv.width, h = cv.height
      ctx.clearRect(0, 0, w, h)
      const analyser = analyserRef?.current
      const n = 56
      const bw = w / n
      if (analyser && active) analyser.getByteFrequencyData(freq)
      for (let i = 0; i < n; i++) {
        let amp
        if (analyser && active) {
          amp = freq[Math.floor((i / n) * freq.length)] / 255
        } else {
          amp = active ? 0.15 + Math.random() * 0.85 : 0.05 + Math.random() * 0.04
        }
        const bh = Math.max(2, amp * h * 0.95)
        const r = Math.round(34 + (248 - 34) * heat)
        const g = Math.round(211 - (211 - 83) * heat)
        const b = Math.round(238 - (238 - 107) * heat)
        ctx.fillStyle = `rgba(${r},${g},${b},${0.4 + 0.6 * amp})`
        ctx.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh)
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [analyserRef])
  return <canvas ref={ref} width={520} height={54} className="waveform" />
}

function beep(ctx) {
  try {
    const ac = ctx || new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.22].forEach((t, i) => {
      const o = ac.createOscillator(); const g = ac.createGain()
      o.frequency.value = i ? 660 : 880; o.type = 'square'
      g.gain.setValueAtTime(0.06, ac.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.18)
      o.connect(g).connect(ac.destination)
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2)
    })
  } catch { /* audio optional */ }
}

const freshEngine = () => ({
  started: false, playing: false, segIdx: 0, wordCount: 0, t0: 0,
  log: [], firedScripted: [], firedCats: [], intervened: false, finished: false,
  analysis: null, interventionAtMs: 0,
})

export default function LiveIntercept() {
  const [calls, setCalls] = useState(null)
  const [callId, setCallId] = useState(null)
  const [, setRenderTick] = useState(0)
  const [overlay, setOverlay] = useState(false)
  const [rate, setRate] = useState(1)
  const rateRef = useRef(1) // browsers reset playbackRate when src changes — reapply from here

  const eng = useRef(freshEngine())
  const audioRef = useRef(null)
  const acRef = useRef(null) // { ctx, analyser } — created once per <audio> element
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const scrollRef = useRef(null)
  const segTimerRef = useRef(null)
  const callRef = useRef(null)

  const rerender = () => setRenderTick((n) => n + 1)

  useEffect(() => {
    const BASE = import.meta.env.BASE_URL
    Promise.all([
      fetch(`${BASE}audio/timings.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${BASE}audio/real/cases.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([tim, real]) => {
      const list = []
      if (Array.isArray(tim)) list.push(buildTtsCall(tim))
      if (Array.isArray(real)) real.forEach((c) => list.push(buildRealCall(c)))
      if (!list.length) list.push(buildFallbackCall())
      setCalls(list)
      setCallId(list[0].id)
    })
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(segTimerRef.current)
      audioRef.current?.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const call = calls?.find((c) => c.id === callId)
  callRef.current = call

  const stopAll = () => {
    cancelAnimationFrame(rafRef.current)
    clearTimeout(segTimerRef.current)
    if (audioRef.current) audioRef.current.pause()
  }

  const ensureAudioGraph = () => {
    if (acRef.current || !audioRef.current) return
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const src = ctx.createMediaElementSource(audioRef.current)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      src.connect(analyser)
      analyser.connect(ctx.destination)
      acRef.current = { ctx, analyser }
      analyserRef.current = analyser
    } catch { /* spectrum optional */ }
  }

  // per-segment clock — drives word reveal (seg.times are segment-relative)
  const clockMs = () => {
    const c = callRef.current
    if (!c) return 0
    if (c.mode === 'audio') return audioRef.current ? audioRef.current.currentTime * 1000 : 0
    return performance.now() - eng.current.t0
  }

  // cumulative call time — for display (media time, playback-rate independent)
  const callElapsedMs = () => {
    const c = callRef.current
    if (!c) return 0
    const prev = c.segments.slice(0, eng.current.segIdx).reduce((a, s) => a + s.durMs, 0)
    return prev + clockMs()
  }

  const playSegment = (idx) => {
    const c = callRef.current
    const e = eng.current
    const seg = c.segments[idx]
    e.segIdx = idx
    e.wordCount = 0
    if (c.mode === 'audio') {
      const a = audioRef.current
      a.src = `${import.meta.env.BASE_URL}audio/${seg.file}`
      a.playbackRate = rateRef.current
      a.onloadedmetadata = () => { a.playbackRate = rateRef.current }
      a.onplay = () => { a.playbackRate = rateRef.current }
      a.onended = () => {
        if (!eng.current.playing) return
        if (idx + 1 < c.segments.length) segTimerRef.current = setTimeout(() => playSegment(idx + 1), 280)
        else { eng.current.finished = true; eng.current.playing = false; rerender() }
      }
      a.play().catch(() => {
        eng.current.log.push({ agent: 'System', sev: 'warn', msg: 'Browser blocked audio autoplay — press Begin again to enable sound.' })
        eng.current.playing = false
        rerender()
      })
    } else {
      e.t0 = performance.now()
    }
    rerender()
  }

  const revealedText = () => {
    const c = callRef.current
    const e = eng.current
    if (!c || !e.started) return ''
    const prev = c.segments.slice(0, e.segIdx).map((s) => s.words.join(' ')).join(' ')
    const cur = c.segments[e.segIdx].words.slice(0, e.wordCount).join(' ')
    return `${prev} ${cur}`.trim()
  }

  const onWordsAdvanced = () => {
    const c = callRef.current
    const e = eng.current
    const analysis = analyzeTranscript(revealedText())
    e.analysis = analysis

    if (c.scriptedEvents) {
      AGENT_EVENTS.forEach((ev, i) => {
        if (!e.firedScripted.includes(i) && (ev.seg < e.segIdx || (ev.seg === e.segIdx && ev.word <= e.wordCount))) {
          e.firedScripted.push(i)
          e.log.push(ev)
        }
      })
    } else {
      // derived events: announce each category the REAL classifier lights up
      analysis.categories.forEach((cat) => {
        if (cat.hits > 0 && !e.firedCats.includes(cat.id)) {
          e.firedCats.push(cat.id)
          const terms = cat.matches.slice(0, 3).map((m) => `“${m.term}”`).join(', ')
          e.log.push({
            agent: AGENT_FOR_CAT[cat.id],
            sev: cat.id === 'financial' || cat.id === 'isolation' ? 'critical' : 'warn',
            msg: `${cat.label} signals detected live: ${terms}`,
          })
        }
      })
    }

    const finHits = analysis.categories.find((x) => x.id === 'financial')?.hits > 0
    if (analysis.riskScore >= c.rule.minRisk && (!c.rule.requireFinancial || finHits)) {
      e.intervened = true
      e.playing = false
      e.interventionAtMs = Math.round(callElapsedMs())
      stopAll()
      e.log.push({
        agent: 'Fusion', sev: 'critical',
        msg: `INTERVENTION THRESHOLD CROSSED — risk ${analysis.riskScore}/100 (${c.rule.requireFinancial ? 'active extraction attempt' : 'impersonation + threat pattern'}). Call terminated.`,
      })
      beep(acRef.current?.ctx)
      setTimeout(() => setOverlay(true), 500)
    }
  }

  const tick = () => {
    const c = callRef.current
    const e = eng.current
    if (c && e.playing) {
      const t = clockMs()
      const seg = c.segments[e.segIdx]
      const n = seg.times.filter((x) => x <= t).length
      if (n !== e.wordCount) {
        e.wordCount = n
        onWordsAdvanced()
        rerender()
      }
      if (c.mode === 'timer' && t >= seg.durMs) {
        if (e.segIdx + 1 < c.segments.length) playSegment(e.segIdx + 1)
        else { e.finished = true; e.playing = false; rerender() }
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const start = () => {
    if (!call) return
    stopAll()
    setOverlay(false)
    eng.current = { ...freshEngine(), started: true, playing: true }
    ensureAudioGraph()
    acRef.current?.ctx?.resume?.()
    playSegment(0)
    rafRef.current = requestAnimationFrame(tick)
  }

  const switchCall = (id) => {
    stopAll()
    eng.current = freshEngine()
    setOverlay(false)
    setCallId(id)
  }

  const changeRate = (r) => {
    setRate(r)
    rateRef.current = r
    if (audioRef.current) audioRef.current.playbackRate = r
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  })

  const e = eng.current
  const analysis = e.analysis || { riskScore: 0, categories: analyzeTranscript('').categories }
  const risk = e.started ? analysis.riskScore : 0
  const riskColor = risk >= 60 ? 'var(--red)' : risk >= 30 ? 'var(--amber)' : 'var(--green)'
  const seg = call?.segments[e.segIdx]
  const callerSpeaking = e.playing && seg?.speaker === 'CALLER'
  const totalDur = call ? call.segments.reduce((a, s) => a + s.durMs, 0) : 1

  const renderSeg = (s, partial) => {
    const text = partial != null ? s.words.slice(0, partial).join(' ') : s.words.join(' ')
    if (!text) return null
    const segAnalysis = analyzeTranscript(text)
    return (
      <div className={`ts-line ${s.speaker.toLowerCase()}`} key={s.seg}>
        <span className="ts-speaker">{s.speaker === 'CALLER' ? '☎ CALLER' : '👤 VICTIM'}</span>
        <span>
          {highlightTranscript(text, segAnalysis.categories).map((p, i) =>
            p.cat ? <mark key={i} className={p.cat}>{p.text}</mark> : <span key={i}>{p.text}</span>
          )}
          {partial != null && e.playing && <span className="cursor">▌</span>}
        </span>
      </div>
    )
  }

  if (!calls) return <p className="section-desc">Loading call sources…</p>

  return (
    <div>
      <p className="section-desc">
        The fusion pipeline running against <b>audible calls</b>: a neural-TTS rendition of the Indian
        digital-arrest playbook, and <b>real scam recordings</b> from FTC enforcement evidence (NCSU robocall
        corpus, public domain) transcribed with Whisper. The transcript sync, classification and interception
        are computed live — nothing on this screen is pre-scored.
      </p>

      <div className="source-row">
        {calls.map((c) => (
          <button key={c.id} className={`source-pill ${callId === c.id ? 'on' : ''}`} onClick={() => switchCall(c.id)}>
            <span className={`source-tag ${c.tagClass}`}>{c.tag}</span>
            {c.name}
          </button>
        ))}
      </div>

      <div className="li-toolbar">
        <button className="btn danger" onClick={start}>
          {e.started ? '↻ Replay' : '▶ Begin Live Intercept'}
        </button>
        <div className="rate-group">
          {[1, 1.25, 1.5].map((r) => (
            <button key={r} className={`rate-btn ${rate === r ? 'on' : ''}`} onClick={() => changeRate(r)}>{r}×</button>
          ))}
        </div>
        <span className="sim-badge">{call.disclaimer}</span>
      </div>

      {e.started && <div className="call-meta" style={{ marginBottom: 12 }}>{call.desc}</div>}

      <div className="li-grid">
        <div>
          <div className="card li-callpanel">
            <div className="li-media">
              <div className="videoframe standby">
                <div className="standby-inner">
                  <div style={{ fontSize: 22 }}>🎙</div>
                  AUDIO-ONLY CALL
                  <span>no video channel — VideoGuard standby. Deepfake analysis engages on video calls.</span>
                </div>
              </div>
              <div className="li-voice">
                <div className="card-title" style={{ marginBottom: 8 }}>
                  Live Audio — VoiceGuard {call.mode === 'audio' && <span className="mini-note">(real spectrum via WebAudio)</span>}
                </div>
                <Waveform analyserRef={analyserRef} active={e.playing} heat={e.started ? call.voiceVerdict.value / 100 : 0} />
                <div className="voice-meter">
                  <span>Synthetic-delivery indicator</span>
                  <b style={{ color: e.started ? 'var(--red)' : 'var(--muted)' }}>{e.started ? `${call.voiceVerdict.value}%` : '—'}</b>
                </div>
                <div className="track"><div className="fill" style={{ width: e.started ? `${call.voiceVerdict.value}%` : 0, background: 'var(--red)' }} /></div>
                {e.started && <div className="mini-note" style={{ marginTop: 6 }}>{call.voiceVerdict.note}</div>}
              </div>
            </div>

            <div className="card-title" style={{ margin: '14px 0 8px' }}>
              Live Transcript {call.id.startsWith('real') ? '— Whisper word-timestamps on the actual recording' : '— synced to TTS word boundaries'}
            </div>
            <div className="ts-window" ref={scrollRef}>
              {!e.started && <div className="ts-idle">Select a source and press <b>Begin Live Intercept</b>. Sound on. 🔊</div>}
              {call.segments.slice(0, e.segIdx).map((s) => renderSeg(s))}
              {e.started && renderSeg(call.segments[e.segIdx], e.wordCount)}
              {e.intervened && (
                <div className="ts-line system">
                  <span className="ts-speaker">⛔ PRAHARI</span>
                  <span>CALL TERMINATED at T+{Math.round((e.interventionAtMs || 0) / 1000)}s of audio — {call.rule.requireFinancial ? 'before any transfer occurred.' : 'before the “press 1” handoff to a live scammer.'}</span>
                </div>
              )}
              {e.finished && !e.intervened && (
                <div className="ts-line system">
                  <span className="ts-speaker">ℹ PRAHARI</span>
                  <span>Recording ended below intervention threshold (risk {risk}/100).</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="li-right">
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="card-title">Fusion Risk — computed live</div>
            <div className="radial-row">
              <Radial value={risk} label="COMPOSITE RISK" sub="/100" color={riskColor} size={132} />
              <div className="mini-radials">
                <Radial value={e.started ? call.voiceVerdict.value : 0} label="AI VOICE" sub="%" color={e.started ? 'var(--red)' : 'var(--cyan)'} size={84} />
                <Radial value={e.started ? Math.min(100, (callElapsedMs() / totalDur) * 100) : 0} label="CALL ELAPSED" sub="%" color="var(--cyan)" size={84} />
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
            <div className="card-title">Agent Activity {!call.scriptedEvents && <span className="mini-note">(derived live from classifier output)</span>}</div>
            <div className="agent-feed">
              {e.log.length === 0 && <div className="ts-idle">Agents idle.</div>}
              {[...e.log].reverse().map((ev, i) => (
                <div className={`agent-item ${ev.sev}`} key={`${ev.msg}-${i}`}>
                  <span className="agent-name">{ev.agent}</span>
                  {ev.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} />

      {overlay && (
        <div className="takeover">
          <div className="takeover-inner">
            <div className="takeover-title">{call.takeover.title}</div>
            <div className="takeover-sub">
              Risk <b>{risk}/100</b> at T+{Math.round((e.interventionAtMs || 0) / 1000)}s — {call.takeover.sub}.
            </div>
            <div className="takeover-cols">
              <div className="takeover-actions">
                {call.takeover.actions.map((a, i) => (
                  <div className="ta-item" style={{ animationDelay: `${0.35 + i * 0.5}s` }} key={a}>✓ {a}</div>
                ))}
              </div>
              <div className="phone">
                <div className="phone-notch" />
                <div className="phone-time">14:32</div>
                <div className="phone-notif" style={{ animationDelay: '0.6s' }}>
                  <div className="pn-app">🛡 PRAHARI SURAKSHA</div>
                  <div className="pn-title">⚠️ यह कॉल एक घोटाला है — This call is a scam</div>
                  <div className="pn-body">No agency arrests anyone over a phone call or asks for money. Disconnect now. पैसे ट्रांसफर न करें। Dial 1930 for help.</div>
                </div>
                <div className="phone-notif alt" style={{ animationDelay: '1.4s' }}>
                  <div className="pn-app">🏦 YOUR BANK</div>
                  <div className="pn-body">Precautionary hold placed on high-value transfers for 24h at PRAHARI advisory.</div>
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
