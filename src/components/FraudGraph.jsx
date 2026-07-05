import { useEffect, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { GRAPH_DATA, NODE_STYLE } from '../data/intel'

// Guided investigation: each step lights up one layer of the network and
// explains, in plain language, why an investigator could never assemble this
// picture from twelve FIRs sitting in seven different police stations.

const STEPS = [
  {
    label: 'Cluster the victim reports',
    title: 'Twelve “unrelated” FIRs',
    types: ['victim'],
    caption:
      'Twelve victims across seven states reported the same “customs parcel” script to twelve different police stations. Filed as separate FIRs, these cases would never meet on any investigator’s desk.',
  },
  {
    label: 'Trace the call infrastructure',
    title: 'One call infrastructure',
    types: ['victim', 'voip'],
    caption:
      'The spoofed numbers the victims answered resolve to just 2 VoIP blocks and 2 SIM boxes. Twelve incidents sharing four pieces of infrastructure is not coincidence — it is one coordinated operation.',
  },
  {
    label: 'Follow the money',
    title: 'The money trail converges',
    types: ['victim', 'voip', 'mule', 'device'],
    caption:
      'Victim payments fan into 6 mule accounts and 2 off-ramps. Bank device fingerprints show those accounts were opened from just 2 devices — hard evidence tying the money trail to the people running the calls.',
  },
  {
    label: 'Expose the command chain',
    title: 'Campaign OPX-2231 confirmed',
    types: ['victim', 'voip', 'mule', 'device', 'operator', 'kingpin'],
    caption:
      'Call infrastructure and money trail converge on three operator cells commanded from a cross-border compound. Detected 31 hours after the first report — while the campaign is still recruiting victims.',
  },
]

const DIM_NODE = '#2b3a5c'
const DIM_LINK = 'rgba(124,141,176,0.10)'

export default function FraudGraph() {
  const stageRef = useRef(null)
  const fgRef = useRef(null)
  const [dims, setDims] = useState({ w: 800, h: 520 })
  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState(0) // 0 = idle, 1..4 = STEPS
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

  const active = step > 0 ? STEPS[step - 1].types : null
  const final = step === STEPS.length

  const typeOf = (end) => (typeof end === 'object' ? end.type : GRAPH_DATA.nodes.find((n) => n.id === end)?.type)
  const nodeActive = (n) => !active || active.includes(n.type)
  const linkActive = (l) => !active || (active.includes(typeOf(l.source)) && active.includes(typeOf(l.target)))

  const advance = () => {
    if (busy || final) return
    setBusy(true)
    setTimeout(() => {
      setStep((s) => s + 1)
      setBusy(false)
    }, 900)
  }

  const reset = () => { setStep(0); setSelected(null) }

  const exportEvidence = async () => {
    const pkg = {
      campaign_id: 'OPX-2231',
      codename: 'Operation Parcel Trap',
      generated: new Date().toISOString(),
      generated_by: 'PRAHARI Graph Intelligence v2.0',
      confidence: 0.94,
      victims: 12,
      estimated_loss_inr: 42000000,
      mule_accounts: 6,
      off_ramps: ['crypto wallet 0x4e…c2', 'shell firm SwiftPay Traders'],
      jurisdictions: ['Jharkhand', 'Haryana', 'Rajasthan', 'Gujarat', 'MP', 'Assam', 'Bihar'],
      graph: { nodes: GRAPH_DATA.nodes.map(({ id, label, type }) => ({ id, label, type })), links: GRAPH_DATA.links.map((l) => ({ source: l.source.id || l.source, target: l.target.id || l.target })) },
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
        <b>The question this module answers:</b> are twelve fraud complaints twelve small cases — or one
        industrial operation? Walk the investigation: each step fuses another data source (FIRs, telco
        records, bank device fingerprints) until the network has nowhere to hide. This is synthetic
        demonstration data modelled on published I4C case patterns.
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
            nodeColor={(n) => (nodeActive(n) ? (final && n.type !== 'victim' ? '#f8536b' : NODE_STYLE[n.type].color) : DIM_NODE)}
            linkColor={(l) => (linkActive(l) ? (final ? 'rgba(248,83,107,0.45)' : 'rgba(34,211,238,0.35)') : DIM_LINK)}
            linkWidth={(l) => (linkActive(l) ? 1.6 : 0.6)}
            linkDirectionalParticles={(l) => (final && linkActive(l) ? 2 : 0)}
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
          {step > 0 && (
            <div className="graph-caption">
              <b>{STEPS[step - 1].title}</b>
              <p>{STEPS[step - 1].caption}</p>
            </div>
          )}
        </div>

        <div className="card intel-panel">
          <div className="card-title">Investigation Walkthrough</div>

          <div className="step-list">
            {STEPS.map((s, i) => (
              <div key={s.label} className={`step-item ${step > i ? 'done' : ''} ${step === i + 1 ? 'now' : ''}`}>
                <span className="step-num">{step > i ? '✓' : i + 1}</span>
                {s.label}
              </div>
            ))}
          </div>

          {!final && (
            <button className="btn danger" onClick={advance} disabled={busy}>
              {busy ? 'Correlating…' : step === 0 ? '▶ Begin Investigation' : `Next: ${STEPS[step].label}`}
            </button>
          )}
          {busy && <div className="analyzing"><div className="spinner" />Fusing {step === 0 ? 'victim reports' : step === 1 ? 'telco CDR metadata' : step === 2 ? 'bank device fingerprints' : 'command-chain linkages'}…</div>}

          {final && (
            <>
              <div className="detect-banner">
                <h3>⚠ CAMPAIGN OPX-2231 CONFIRMED</h3>
                <p>"Operation Parcel Trap" — one coordinated fraud ring behind 12 victim reports across 7 states. Confidence 94%.</p>
              </div>
              <div>
                <div className="kv"><span className="k">Estimated loss routed</span><span className="v">₹4.2 Cr</span></div>
                <div className="kv"><span className="k">Detection lead time</span><span className="v">T+31 h after first report</span></div>
                <div className="kv"><span className="k">Command origin</span><span className="v">Cross-border compound (Myawaddy)</span></div>
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
              <button className="btn ghost" onClick={reset}>↻ Restart walkthrough</button>
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
