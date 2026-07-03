import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { HOTSPOTS, FEED_EVENTS } from '../data/intel'

const STATS = [
  { num: 1776, prefix: '₹', suffix: ' Cr', label: 'Lost to digital arrest scams (Jan–Sep 2024, MHA)', delta: '+42% YoY', dir: 'up' },
  { num: 92334, label: 'Digital arrest complaints registered', delta: '+38% YoY', dir: 'up' },
  { num: 2.4, suffix: ' L', decimals: 1, label: 'FICN pieces in circulation (est.)', delta: '₹500 = 85% of value', dir: 'up' },
  { num: 11, suffix: ' min', label: 'Median alert-to-intervention time (PRAHARI)', delta: '-83% vs manual triage', dir: 'down' },
]

function CountUp({ num, prefix = '', suffix = '', decimals = 0 }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1400)
      setV(num * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [num])
  return <>{prefix}{v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>
}

function ts(offsetMin) {
  const d = new Date(Date.now() - offsetMin * 60000)
  return d.toTimeString().slice(0, 8) + ' IST'
}

export default function Dashboard({ goTo }) {
  const mapRef = useRef(null)
  const [feed, setFeed] = useState(FEED_EVENTS.slice(0, 4))

  useEffect(() => {
    const map = L.map('threat-map', {
      center: [22.6, 80.5],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 12,
    }).addTo(map)

    HOTSPOTS.forEach((h) => {
      const icon = L.divIcon({
        className: '',
        html: `<div class="pulse-marker ${h.sev === 'med' ? 'med' : ''}"><div class="ring"></div><div class="core"></div></div>`,
        iconSize: [12, 12],
      })
      L.marker([h.lat, h.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<b>${h.name}</b><br/>${h.type}<br/>${h.cases.toLocaleString('en-IN')} active reports (90d)`
        )
    })
    mapRef.current = map
    return () => map.remove()
  }, [])

  useEffect(() => {
    let i = 4
    const id = setInterval(() => {
      setFeed((f) => [FEED_EVENTS[i % FEED_EVENTS.length], ...f].slice(0, 7))
      i++
    }, 3500)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <div className="grid-stats">
        {STATS.map((s) => (
          <div className="card" key={s.label}>
            <div className="stat-value"><CountUp {...s} /></div>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-delta ${s.dir}`}>{s.dir === 'up' ? '▲' : '▼'} {s.delta}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-title">National Threat Map — Fraud &amp; FICN Hotspots (Live)</div>
          <div id="threat-map" />
        </div>
        <div className="card">
          <div className="card-title">Live Intelligence Feed</div>
          <div className="feed">
            {feed.map((e, i) => (
              <div className={`feed-item ${e.sev}`} key={`${e.text}-${i}`}>
                <div className="t">{ts(i * 3)}</div>
                {e.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="module-links five">
        <div className="card module-link hero" onClick={() => goTo('intercept')}>
          <div className="icon">📡</div>
          <h3>Live Intercept</h3>
          <p>Watch the fusion pipeline catch a digital-arrest call in real time — voice, video and script agents converging before the transfer.</p>
        </div>
        <div className="card module-link" onClick={() => goTo('shield')}>
          <div className="icon">🛡️</div>
          <h3>Scam Shield</h3>
          <p>Transcript forensics against digital-arrest playbooks with explainable, phrase-level verdicts.</p>
        </div>
        <div className="card module-link" onClick={() => goTo('scanner')}>
          <div className="icon">🔍</div>
          <h3>FICN Scanner</h3>
          <p>Computer-vision counterfeit detection — 7 RBI security features on any camera.</p>
        </div>
        <div className="card module-link" onClick={() => goTo('graph')}>
          <div className="icon">🕸️</div>
          <h3>Network Intel</h3>
          <p>Graph AI turning scattered FIRs into court-ready campaign intelligence.</p>
        </div>
        <div className="card module-link" onClick={() => goTo('citizen')}>
          <div className="icon">💬</div>
          <h3>Citizen Shield</h3>
          <p>Conversational fraud triage on WhatsApp &amp; IVR — English + हिन्दी live.</p>
        </div>
      </div>
    </div>
  )
}
