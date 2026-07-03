import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import LiveIntercept from './components/LiveIntercept'
import ScamShield from './components/ScamShield'
import NoteScanner from './components/NoteScanner'
import FraudGraph from './components/FraudGraph'
import CitizenShield from './components/CitizenShield'

const VIEWS = {
  dash: { title: 'National Command Centre', icon: '🗺️', nav: 'Command Centre' },
  intercept: { title: 'Live Intercept — Real-Time Scam Call Fusion', icon: '📡', nav: 'Live Intercept' },
  shield: { title: 'Scam Shield — Transcript Forensics', icon: '🛡️', nav: 'Scam Shield' },
  scanner: { title: 'FICN Scanner — Counterfeit Currency Detection', icon: '🔍', nav: 'FICN Scanner' },
  graph: { title: 'Network Intel — Fraud Ring Graph AI', icon: '🕸️', nav: 'Network Intel' },
  citizen: { title: 'Citizen Shield — Multi-Channel Conversational AI', icon: '💬', nav: 'Citizen Shield' },
}

export default function App() {
  const [view, setView] = useState('dash')
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">प्र</div>
          <div>
            <div className="brand-name">PRAHARI</div>
            <div className="brand-sub">Digital Public Safety AI</div>
          </div>
        </div>
        <nav className="nav">
          {Object.entries(VIEWS).map(([k, v]) => (
            <button key={k} className={`nav-item ${view === k ? 'active' : ''}`} onClick={() => setView(k)}>
              <span className="icon">{v.icon}</span> {v.nav}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div><span className="status-dot" />ALL SYSTEMS NOMINAL</div>
          <div>NODE: IN-WEST-01</div>
          <div>BUILD 1.0.0 · ET AI HACK 2.0</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{VIEWS[view].title}</div>
          <div className="topbar-right">
            <span className="live-badge">LIVE</span>
            <span>{clock.toLocaleTimeString('en-IN', { hour12: false })} IST</span>
          </div>
        </header>
        <div className="content">
          {view === 'dash' && <Dashboard goTo={setView} />}
          {view === 'intercept' && <LiveIntercept />}
          {view === 'shield' && <ScamShield />}
          {view === 'scanner' && <NoteScanner />}
          {view === 'graph' && <FraudGraph />}
          {view === 'citizen' && <CitizenShield />}
        </div>
      </div>
    </div>
  )
}
