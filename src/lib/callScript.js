// Scripted synthetic call for the Live Intercept simulation.
// Every entity and utterance is demonstration data modelled on I4C-documented
// digital-arrest playbooks (corpus template DA-114, "customs parcel").

export const CALL_META = {
  callerId: '+91 22 6117 40XX',
  presented: 'MUMBAI POLICE CYBER CELL',
  sipOrigin: 'AS58601 · offshore VoIP gateway',
  victim: 'Subscriber ****7305 (age 64, Pune)',
}

export const CALL_SCRIPT = [
  { speaker: 'CALLER', text: 'Good afternoon. I am Inspector Vikram Rathore, Mumbai Police Cyber Cell. An FIR number 0862 stroke 2026 has been registered against your Aadhaar number.' },
  { speaker: 'VICTIM', text: 'What? I… I do not understand. What FIR? I have not done anything.' },
  { speaker: 'CALLER', text: 'A parcel intercepted at Mumbai customs contains narcotics booked in your name. This is now a money laundering case under investigation by the Enforcement Directorate and the Supreme Court has issued a non-bailable arrest warrant.' },
  { speaker: 'CALLER', text: 'You are under digital arrest. Keep your camera on at all times. Do not disconnect this call and do not tell anyone about this investigation — it is strictly confidential. You are under surveillance.' },
  { speaker: 'VICTIM', text: 'Please sir, I am a retired school teacher. Please, there must be some mistake…' },
  { speaker: 'CALLER', text: 'If you cooperate fully you will not be arrested tonight. Your funds must undergo verification. Transfer your savings by RTGS to the government safe account I am sending you. The amount is fully refundable after verification.' },
  { speaker: 'CALLER', text: 'You have 30 minutes. Share your bank account number and begin the transfer immediately. This is your last warning.' },
]

// Agent events fire when the stream reaches [segment, word] positions.
export const AGENT_EVENTS = [
  { seg: 0, word: 2, agent: 'NumberTrace', sev: 'warn', msg: 'Caller ID presents as landline +91 22 — SIP trace resolves to AS58601, offshore VoIP gateway. Spoof signature 96%.' },
  { seg: 0, word: 14, agent: 'VoiceGuard', sev: 'info', msg: 'Analysing prosody & spectral envelope… synthetic voice probability 34%.' },
  { seg: 0, word: 22, agent: 'ScriptGuard', sev: 'warn', msg: 'Opening matches I4C playbook template DA-114 ("customs parcel") — 21 active campaigns use this script.' },
  { seg: 2, word: 6, agent: 'VoiceGuard', sev: 'critical', msg: 'Neural-TTS artefacts detected in sibilants and breath gaps. Synthetic voice probability 78%.' },
  { seg: 2, word: 20, agent: 'VideoGuard', sev: 'warn', msg: 'Virtual "police station" background detected — texture entropy inconsistent with parallax.' },
  { seg: 3, word: 8, agent: 'VideoGuard', sev: 'critical', msg: 'Facial landmark jitter + boundary blending artefacts — face-swap probability 87%.' },
  { seg: 3, word: 16, agent: 'Fusion', sev: 'critical', msg: 'Isolation + surveillance language confirmed. Victim containment phase active. Escalating priority.' },
  { seg: 5, word: 8, agent: 'Fusion', sev: 'critical', msg: 'FINANCIAL EXTRACTION PHASE — "safe account" transfer demanded. Pre-transfer intervention window OPEN.' },
]

// [segment index at which value applies] → gauge values
export const VOICE_RAMP = [34, 34, 61, 78, 82, 91, 94]
export const DEEPFAKE_RAMP = [0, 12, 44, 87, 87, 91, 93]

export const INTERVENTION_ACTIONS = [
  'Victim device push-alert dispatched (Hindi + English)',
  'Telecom provider signalled — call flagged & spoof-block requested',
  'Transaction hold advisory issued to victim’s bank (pre-transfer)',
  'I4C / MHA incident package auto-generated — case #DA-2026-08831',
  'Campaign graph updated — infrastructure linked to OPX-2231',
]
