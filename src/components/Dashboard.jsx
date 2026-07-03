import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { HOTSPOTS, FEED_EVENTS } from '../data/intel'

const STATS = [
  { value: '₹1,935 Cr', label: 'Lost to digital arrest scams (2024, I4C)', delta: '+42% YoY', dir: 'up' },
  { value: '92,334', label: 'Digital arrest complaints registered', delta: '+38% YoY', dir: 'up' },
  { value: '2.4 L', label: 'FICN pieces in circulation (est.)', delta: '₹500 = 85% of value', dir: 'up' },
  { value: '11 min', label: 'Median alert-to-intervention time (PRAHARI)', delta: '-83% vs manual triage', dir: 'down' },
]

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
            <div className="stat-value">{s.value}</div>
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

      <div className="module-links">
        <div className="card module-link" onClick={() => goTo('shield')}>
          <div className="icon">🛡️</div>
          <h3>Scam Shield</h3>
          <p>Real-time NLP classification of live call transcripts against digital-arrest scam playbooks. Flags victims before the transfer happens.</p>
        </div>
        <div className="card module-link" onClick={() => goTo('scanner')}>
          <div className="icon">🔍</div>
          <h3>FICN Scanner</h3>
          <p>Computer-vision counterfeit currency detection — security thread, microlettering, watermark and serial-pattern verification on any camera.</p>
        </div>
        <div className="card module-link" onClick={() => goTo('graph')}>
          <div className="icon">🕸️</div>
          <h3>Network Intel</h3>
          <p>Graph AI that fuses victim reports, VoIP signatures and mule-account linkages into court-ready intelligence packages.</p>
        </div>
      </div>
    </div>
  )
}
