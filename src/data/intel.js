// Demonstration intelligence dataset (synthetic, modelled on I4C/NCRB published patterns)

export const HOTSPOTS = [
  { name: 'Delhi NCR', lat: 28.61, lng: 77.21, cases: 4820, sev: 'high', type: 'Digital arrest cluster' },
  { name: 'Mumbai', lat: 19.08, lng: 72.88, cases: 3915, sev: 'high', type: 'Digital arrest cluster' },
  { name: 'Bengaluru', lat: 12.97, lng: 77.59, cases: 3410, sev: 'high', type: 'Digital arrest cluster' },
  { name: 'Hyderabad', lat: 17.39, lng: 78.49, cases: 2280, sev: 'med', type: 'Investment fraud cluster' },
  { name: 'Kolkata', lat: 22.57, lng: 88.36, cases: 1930, sev: 'med', type: 'FICN circulation corridor' },
  { name: 'Jamtara, JH', lat: 23.96, lng: 86.80, cases: 1685, sev: 'high', type: 'Scam call origin zone' },
  { name: 'Nuh (Mewat), HR', lat: 28.10, lng: 77.00, cases: 1490, sev: 'high', type: 'Scam call origin zone' },
  { name: 'Bharatpur, RJ', lat: 27.22, lng: 77.49, cases: 1105, sev: 'med', type: 'Mule account cluster' },
  { name: 'Malda, WB', lat: 25.01, lng: 88.14, cases: 860, sev: 'med', type: 'FICN entry corridor' },
  { name: 'Ahmedabad', lat: 23.02, lng: 72.57, cases: 1240, sev: 'med', type: 'Digital arrest cluster' },
]

export const FEED_EVENTS = [
  { sev: 'critical', text: 'Scam Shield: active digital-arrest session flagged in Pune — victim alerted before transfer. Risk 94/100.' },
  { sev: 'warn', text: 'FICN Scanner: counterfeit ₹500 flagged at bank counter, Malda WB. Security thread anomaly.' },
  { sev: 'info', text: 'Network Intel: 3 new mule accounts linked to campaign OPX-2231 via device fingerprint match.' },
  { sev: 'critical', text: 'Spoofed +92 VoIP block impersonating "Mumbai Police Cyber Cell" — 212 calls in last hour.' },
  { sev: 'info', text: 'Citizen Shield (WhatsApp): 1,408 risk assessments served today across 12 languages.' },
  { sev: 'warn', text: 'Serial-pattern match: seized note series 8KD… correlates with Malda corridor batch #F-118.' },
  { sev: 'critical', text: 'Deepfake video signature detected in reported "CBI hearing" call — MHA alert auto-generated.' },
  { sev: 'info', text: 'Graph AI: cross-jurisdiction linkage packaged for Jharkhand + Haryana cyber cells.' },
]

export const GRAPH_DATA = {
  nodes: [
    { id: 'K1', label: 'Kingpin — "Rana" (Cross-border compound, Myawaddy)', type: 'kingpin' },
    { id: 'OP1', label: 'Operator cell A (Jamtara)', type: 'operator' },
    { id: 'OP2', label: 'Operator cell B (Nuh)', type: 'operator' },
    { id: 'OP3', label: 'Operator cell C (offshore)', type: 'operator' },
    { id: 'V1', label: '+92-3XX VoIP block (spoofs Mumbai Police)', type: 'voip' },
    { id: 'V2', label: '+1-4XX VoIP block (spoofs CBI HQ)', type: 'voip' },
    { id: 'V3', label: 'SIM box — Gurugram', type: 'voip' },
    { id: 'V4', label: 'SIM box — Kolkata', type: 'voip' },
    { id: 'D1', label: 'Device FP a91f…22 (12 accounts)', type: 'device' },
    { id: 'D2', label: 'Device FP c07b…9e (7 accounts)', type: 'device' },
    { id: 'M1', label: 'Mule acct •••4412 (Bharatpur)', type: 'mule' },
    { id: 'M2', label: 'Mule acct •••8830 (Bharatpur)', type: 'mule' },
    { id: 'M3', label: 'Mule acct •••1275 (Surat)', type: 'mule' },
    { id: 'M4', label: 'Mule acct •••6641 (Indore)', type: 'mule' },
    { id: 'M5', label: 'Mule acct •••3097 (Guwahati)', type: 'mule' },
    { id: 'M6', label: 'Mule acct •••7758 (Patna)', type: 'mule' },
    { id: 'M7', label: 'Crypto off-ramp wallet 0x4e…c2', type: 'mule' },
    { id: 'M8', label: 'Shell firm — "SwiftPay Traders"', type: 'mule' },
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `T${i + 1}`,
      label: `Victim report #${2210 + i * 7}`,
      type: 'victim',
    })),
  ],
  links: [
    ['K1', 'OP1'], ['K1', 'OP2'], ['K1', 'OP3'],
    ['OP1', 'V1'], ['OP1', 'V3'], ['OP2', 'V2'], ['OP2', 'V4'], ['OP3', 'V2'],
    ['OP1', 'D1'], ['OP2', 'D2'],
    ['D1', 'M1'], ['D1', 'M2'], ['D1', 'M3'], ['D2', 'M4'], ['D2', 'M5'], ['D2', 'M6'],
    ['M1', 'M7'], ['M2', 'M7'], ['M3', 'M8'], ['M4', 'M8'], ['M5', 'M7'], ['M6', 'M8'],
    ['V1', 'T1'], ['V1', 'T2'], ['V1', 'T3'], ['V1', 'T4'],
    ['V2', 'T5'], ['V2', 'T6'], ['V2', 'T7'],
    ['V3', 'T8'], ['V3', 'T9'], ['V4', 'T10'], ['V4', 'T11'], ['V4', 'T12'],
    ['T1', 'M1'], ['T2', 'M1'], ['T3', 'M2'], ['T4', 'M3'], ['T5', 'M4'],
    ['T6', 'M4'], ['T7', 'M5'], ['T8', 'M2'], ['T9', 'M6'], ['T10', 'M6'],
    ['T11', 'M3'], ['T12', 'M5'],
  ].map(([source, target]) => ({ source, target })),
}

export const NODE_STYLE = {
  kingpin: { color: '#f8536b', size: 11, label: 'Kingpin / compound' },
  operator: { color: '#fb923c', size: 8, label: 'Operator cell' },
  voip: { color: '#c084fc', size: 6, label: 'Spoofed VoIP / SIM box' },
  device: { color: '#fbbf24', size: 6, label: 'Shared device fingerprint' },
  mule: { color: '#22d3ee', size: 6, label: 'Mule account / off-ramp' },
  victim: { color: '#64748b', size: 4, label: 'Victim report' },
}
