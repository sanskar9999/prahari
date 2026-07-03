import { useEffect, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { GRAPH_DATA, NODE_STYLE } from '../data/intel'

export default function FraudGraph() {
  const stageRef = useRef(null)
  const fgRef = useRef(null)
  const [dims, setDims] = useState({ w: 800, h: 520 })
  const [selected, setSelected] = useState(null)
  const [detected, setDetected] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const measure = () => {
      if (stageRef.current) {
        const r = stageRef.current.getBoundingClientRect()
        setDims({ w: r.width, h: r.height })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const runDetection = () => {
    setBusy(true)
    setTimeout(() => { setDetected(true); setBusy(false) }, 1600)
  }

  const exportEvidence = async () => {
    const pkg = {
      campaign_id: 'OPX-2231',
      codename: 'Operation Parcel Trap',
      generated: new Date().toISOString(),
      generated_by: 'PRAHARI Graph Intelligence v1.0',
      confidence: 0.94,
      victims: 12,
      estimated_loss_inr: 42000000,
      mule_accounts: 6,
      off_ramps: ['crypto wallet 0x4e…c2', 'shell firm SwiftPay Traders'],
      jurisdictions: ['Jharkhand', 'Haryana', 'Rajasthan', 'Gujarat', 'MP', 'Assam', 'Bihar'],
      graph: GRAPH_DATA,
      chain_of_custody: { collected_via: 'consented victim reports + telco metadata (lawful intercept ref LI-2026-0483)' },
    }
    const body = JSON.stringify(pkg, null, 2)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
    const blob = new Blob([JSON.stringify({ sha256_integrity_seal: hash, evidence: pkg }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'PRAHARI_evidence_OPX-2231.json'
    a.click()
  }

  return (
    <div>
      <p className="section-desc">
        Graph AI fuses victim complaints, spoofed-number signatures, device fingerprints and mule-account
        linkages into a single network. Community detection surfaces the coordinated campaign behind what
        looks like unrelated cases across seven states — <b>before mass victimisation completes</b>.
      </p>

      <div className="graph-grid">
        <div className="graph-stage" ref={stageRef}>
          <ForceGraph2D
            ref={fgRef}
            width={dims.w}
            height={dims.h}
            graphData={GRAPH_DATA}
            backgroundColor="#0c1220"
            nodeLabel={(n) => n.label}
            nodeVal={(n) => NODE_STYLE[n.type].size}
            nodeColor={(n) => (detected && n.type !== 'victim' ? '#f8536b' : NODE_STYLE[n.type].color)}
            linkColor={() => (detected ? 'rgba(248,83,107,0.45)' : 'rgba(124,141,176,0.25)')}
            linkWidth={detected ? 1.6 : 0.8}
            linkDirectionalParticles={detected ? 2 : 0}
            linkDirectionalParticleColor={() => '#f8536b'}
            linkDirectionalParticleSpeed={0.006}
            onNodeClick={(n) => setSelected(n)}
            cooldownTicks={120}
          />
          <div className="graph-legend">
            {Object.entries(NODE_STYLE).map(([k, v]) => (
              <div key={k}><span className="legend-dot" style={{ background: v.color }} />{v.label}</div>
            ))}
          </div>
        </div>

        <div className="card intel-panel">
          <div className="card-title">Campaign Intelligence</div>

          {!detected && (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
                38 entities ingested from victim reports (I4C portal), telco CDR metadata and bank
                account-opening device fingerprints. Run community detection to correlate.
              </p>
              <button className="btn danger" onClick={runDetection} disabled={busy}>
                {busy ? 'Correlating 38 entities…' : '🕸️ Run Campaign Detection'}
              </button>
              {busy && <div className="analyzing"><div className="spinner" />Louvain clustering + temporal correlation…</div>}
            </>
          )}

          {detected && (
            <>
              <div className="detect-banner">
                <h3>⚠ CAMPAIGN OPX-2231 CONFIRMED</h3>
                <p>"Operation Parcel Trap" — single coordinated fraud ring behind 12 victim reports across 7 states. Confidence 94%.</p>
              </div>
              <div>
                <div className="kv"><span className="k">Estimated loss routed</span><span className="v">₹4.2 Cr</span></div>
                <div className="kv"><span className="k">Detection lead time</span><span className="v">T+31 h after first report</span></div>
                <div className="kv"><span className="k">Command origin</span><span className="v">Cross-border compound (Myawaddy)</span></div>
                <div className="kv"><span className="k">Call infrastructure</span><span className="v">2 VoIP blocks · 2 SIM boxes</span></div>
                <div className="kv"><span className="k">Money mule accounts</span><span className="v">6 accounts · 2 off-ramps</span></div>
                <div className="kv"><span className="k">Linking evidence</span><span className="v">Shared device FPs a91f…22, c07b…9e</span></div>
                <div className="kv"><span className="k">Jurisdictions</span><span className="v">JH · HR · RJ · GJ · MP · AS · BR</span></div>
              </div>
              <button className="btn" onClick={exportEvidence}>⬇ Export Court-Ready Evidence Package (SHA-256 sealed)</button>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                ✓ Freeze requests drafted for 6 mule accounts<br />
                ✓ Inter-state alert issued to 7 cyber cells<br />
                ✓ VoIP block submitted to DoT for takedown
              </div>
            </>
          )}

          {selected && (
            <div>
              <div className="card-title" style={{ marginTop: 4 }}>Entity Detail</div>
              <div className="kv"><span className="k">Entity</span><span className="v">{selected.label}</span></div>
              <div className="kv"><span className="k">Class</span><span className="v">{NODE_STYLE[selected.type].label}</span></div>
              <div className="kv"><span className="k">Degree</span><span className="v">{GRAPH_DATA.links.filter((l) => (l.source.id || l.source) === selected.id || (l.target.id || l.target) === selected.id).length} linkages</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
