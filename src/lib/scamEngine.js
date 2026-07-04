// Hybrid NLP pattern classifier for digital-arrest / vishing scam transcripts.
// Scores a transcript against five behavioural signal categories derived from
// I4C-documented digital arrest scam playbooks.

export const CATEGORIES = [
  {
    id: 'authority',
    label: 'Authority Impersonation',
    weight: 30,
    color: '#f87171',
    terms: [
      'cbi', 'police', 'rbi', 'trai', 'customs', 'enforcement directorate',
      'narcotics', 'fir', 'arrest warrant', 'supreme court', 'cyber cell',
      'income tax', 'interpol', 'mumbai police', 'delhi police', 'crime branch',
      'ncb', 'officer speaking', 'inspector', 'court order', 'ed officer',
      // US-agency variants (government-impersonation robocalls, FTC corpus)
      'social security', 'irs', 'magistrate', 'grand jury', 'law enforcement',
      'legal enforcement', 'federal criminal', 'warrant', 'officer',
    ],
  },
  {
    id: 'isolation',
    label: 'Victim Isolation Tactics',
    weight: 25,
    color: '#c084fc',
    terms: [
      'do not disconnect', "don't disconnect", 'do not tell anyone',
      "don't tell anyone", 'stay on video', 'keep the camera on', 'keep your camera on',
      'confidential', 'do not contact', 'digital custody', 'digital arrest',
      'under surveillance', 'do not inform', 'stay on the line', 'secret',
    ],
  },
  {
    id: 'urgency',
    label: 'Urgency & Fear Induction',
    weight: 20,
    color: '#fbbf24',
    terms: [
      'immediately', 'within 30 minutes', 'within one hour', 'last warning',
      'will be arrested', 'non-bailable', 'account will be frozen', 'legal action',
      'case registered against you', 'money laundering', 'right now', 'final notice',
      'serious crime', 'jail',
      'suspended', 'suspension', 'legal consequences', 'criminal offense',
      'final attempt', 'fraudulent activities',
    ],
  },
  {
    id: 'financial',
    label: 'Financial Extraction',
    weight: 25,
    color: '#22d3ee',
    terms: [
      'transfer', 'rtgs', 'neft', 'safe account', 'government account',
      'verification of funds', 'security deposit', 'refundable', 'clear your name',
      'settlement amount', 'upi', 'fixed deposit', 'net banking', 'wire the amount',
    ],
  },
  {
    id: 'identity',
    label: 'Identity Harvesting',
    weight: 10,
    color: '#34d399',
    terms: ['aadhaar', 'pan card', 'pan number', 'bank account number', 'otp', 'cvv', 'passport number', 'social security number'],
  },
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function analyzeTranscript(text) {
  const lower = text.toLowerCase()
  const categories = CATEGORIES.map((cat) => {
    const matches = []
    for (const term of cat.terms) {
      const re = new RegExp(`\\b${escapeRe(term)}`, 'g')
      const found = lower.match(re)
      if (found) matches.push({ term, count: found.length })
    }
    const hits = matches.reduce((a, m) => a + m.count, 0)
    // saturating score: 3+ distinct signal hits = full category weight
    const score = cat.weight * Math.min(1, hits / 3)
    return { ...cat, matches, hits, score }
  })

  const maxWeight = CATEGORIES.reduce((a, c) => a + c.weight, 0)
  const raw = categories.reduce((a, c) => a + c.score, 0)
  const riskScore = Math.round((raw / maxWeight) * 100)

  let verdict, headline, advice
  if (riskScore >= 60) {
    verdict = 'critical'
    headline = 'DIGITAL ARREST SCAM DETECTED'
    advice =
      'Do NOT transfer money. No Indian law-enforcement agency conducts arrests over video calls or demands fund transfers. Disconnect and report to 1930 (National Cyber Crime Helpline) immediately.'
  } else if (riskScore >= 30) {
    verdict = 'suspicious'
    headline = 'SUSPICIOUS — ELEVATED FRAUD SIGNALS'
    advice =
      'Multiple social-engineering markers present. Independently verify the caller through official channels before sharing any information or making payments.'
  } else {
    verdict = 'low'
    headline = 'LOW RISK — NO SCAM PATTERN DETECTED'
    advice = 'No significant digital-arrest scam markers found. Remain cautious with unsolicited callers.'
  }

  return { riskScore, verdict, headline, advice, categories }
}

export function highlightTranscript(text, categories) {
  // build one regex of all matched terms, longest first to avoid partial shadowing
  const entries = []
  for (const cat of categories)
    for (const m of cat.matches) entries.push({ term: m.term, cat: cat.id })
  if (!entries.length) return [{ text }]
  entries.sort((a, b) => b.term.length - a.term.length)
  const re = new RegExp(`(${entries.map((e) => escapeRe(e.term)).join('|')})`, 'gi')
  const parts = []
  let last = 0
  let match
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) })
    const hit = entries.find((e) => e.term === match[0].toLowerCase()) ||
      entries.find((e) => match[0].toLowerCase().startsWith(e.term))
    parts.push({ text: match[0], cat: hit ? hit.cat : 'authority' })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

export const SAMPLE_TRANSCRIPTS = [
  {
    name: 'Digital Arrest (live case pattern)',
    text: `CALLER: Hello, this is Inspector Vikram Rathore from Mumbai Police Cyber Cell, CBI division. A FedEx parcel booked against your Aadhaar number has been intercepted at Mumbai customs containing narcotics and fake passports.

CALLER: An FIR has been registered against you. This is a money laundering case under investigation by the Enforcement Directorate. There is a non-bailable arrest warrant issued by the Supreme Court.

CALLER: You are now under digital arrest. Keep your camera on at all times. Do not disconnect this call. Do not tell anyone about this investigation — it is strictly confidential. You are under surveillance.

CALLER: To verify you are not involved, you must transfer your funds to a government account for verification of funds. The amount is fully refundable after the investigation. Transfer via RTGS immediately, within 30 minutes, or you will be arrested tonight.

VICTIM: Please sir, I have done nothing wrong. Which account should I transfer to?

CALLER: Share your bank account number and net banking access now. This is your last warning.`,
  },
  {
    name: 'Courier / KYC phishing call',
    text: `CALLER: Good afternoon, I am calling from the courier company regarding a package delivery issue. Your KYC verification is pending.

CALLER: To release the package, please confirm your PAN number and the OTP we just sent to your phone. This must be done immediately or the package returns to sender.

VICTIM: I wasn't expecting a package. What is this about?

CALLER: Sir, please cooperate. Just share the OTP and we will handle everything. There may be legal action if the package contains restricted items.`,
  },
  {
    name: 'Genuine bank service call',
    text: `CALLER: Good morning, this is a service call from your bank branch regarding the home loan application you submitted on Monday.

CALLER: Your documentation is complete. The site valuation is scheduled for Thursday between 10 AM and 1 PM. Will someone be available at the property?

VICTIM: Yes, my father will be there.

CALLER: Perfect. You will receive a confirmation SMS from our official ID. Please note we will never ask for your OTP or password. Have a good day.`,
  },
]
