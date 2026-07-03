import { useEffect, useRef, useState } from 'react'
import { analyzeTranscript } from '../lib/scamEngine'

const SCENARIOS = [
  {
    label: '“CBI officer” video call',
    text: 'Someone video-called saying he is a CBI officer from the crime branch, an FIR and arrest warrant are registered against my Aadhaar for a parcel with narcotics. He said I am under digital arrest, I must not disconnect, do not tell anyone, and immediately transfer Rs 2 lakh to a government safe account for verification of funds.',
  },
  {
    label: 'Courier customs-fee SMS',
    text: 'SMS received: Your FedEx package is held at customs. Pay Rs 4,999 clearance fee via this UPI link within 2 hours or legal action will be taken and the case registered against you.',
  },
  {
    label: 'Bank loan service call',
    text: 'My bank branch called about the home loan application I submitted, said the valuation visit is on Thursday and clearly told me they will never ask for my OTP or password. Is this safe?',
  },
]

const STR = {
  en: {
    header: 'PRAHARI Citizen Shield',
    online: 'online · AI fraud triage',
    hello: 'Namaste! 🙏 I am your fraud-protection assistant. Forward me any suspicious call summary, SMS or payment request and I will assess it instantly. Try a sample below, or type your own.',
    high: (score) => `🚨 *HIGH RISK — ${score}/100*\n\nThis matches the **DIGITAL ARREST scam playbook**. Remember: no police, CBI or customs officer will EVER arrest you over a video call or ask you to transfer money for "verification".`,
    med: (score) => `⚠️ *SUSPICIOUS — ${score}/100*\n\nThis message carries known fraud markers. Do not click links or pay. Verify independently through official channels before acting.`,
    low: (score) => `✅ *LOW RISK — ${score}/100*\n\nNo significant scam markers found. This looks like a routine service interaction — note that genuine banks never ask for OTPs or passwords.`,
    why: 'Signals I detected:',
    act: 'Do this now:',
    highActs: ['Disconnect the call — do NOT transfer anything', 'Call the 1930 national cyber helpline', 'I can pre-fill your report on cybercrime.gov.in'],
    medActs: ['Do not click any link or pay', 'Verify via the official app or branch', 'Forward to 1930 if money was requested'],
    lowActs: ['No action needed — stay alert for OTP requests'],
    report: '📝 Report drafted — case reference PCS-2026-4417. An officer from your district cyber cell will contact you. Aapka data surakshit hai. 🔒',
    reportBtn: 'File report on 1930',
    typing: 'PRAHARI is typing…',
    placeholder: 'Type or paste a suspicious message…',
  },
  hi: {
    header: 'प्रहरी नागरिक कवच',
    online: 'ऑनलाइन · AI धोखाधड़ी जाँच',
    hello: 'नमस्ते! 🙏 मैं आपका धोखाधड़ी-सुरक्षा सहायक हूँ। कोई भी संदिग्ध कॉल, SMS या भुगतान अनुरोध मुझे भेजें — मैं तुरंत जाँच करूँगा। नीचे कोई नमूना आज़माएँ।',
    high: (score) => `🚨 *उच्च जोखिम — ${score}/100*\n\nयह **डिजिटल अरेस्ट घोटाले** का पैटर्न है। याद रखें: कोई भी पुलिस, CBI या कस्टम अधिकारी वीडियो कॉल पर गिरफ़्तारी नहीं करता और न ही "सत्यापन" के लिए पैसे मांगता है।`,
    med: (score) => `⚠️ *संदिग्ध — ${score}/100*\n\nइस संदेश में धोखाधड़ी के ज्ञात संकेत हैं। किसी लिंक पर क्लिक न करें, भुगतान न करें। पहले आधिकारिक माध्यम से पुष्टि करें।`,
    low: (score) => `✅ *कम जोखिम — ${score}/100*\n\nकोई गंभीर घोटाला संकेत नहीं मिला। यह सामान्य सेवा कॉल लगती है — ध्यान रखें, असली बैंक कभी OTP नहीं मांगते।`,
    why: 'मुझे ये संकेत मिले:',
    act: 'अभी यह करें:',
    highActs: ['कॉल काट दें — कोई पैसा ट्रांसफर न करें', '1930 राष्ट्रीय साइबर हेल्पलाइन पर कॉल करें', 'मैं cybercrime.gov.in पर आपकी रिपोर्ट तैयार कर सकता हूँ'],
    medActs: ['किसी लिंक पर क्लिक न करें, भुगतान न करें', 'आधिकारिक ऐप या शाखा से पुष्टि करें', 'पैसे मांगे गए हों तो 1930 पर सूचित करें'],
    lowActs: ['कोई कार्रवाई ज़रूरी नहीं — OTP मांगने पर सतर्क रहें'],
    report: '📝 रिपोर्ट तैयार — केस संदर्भ PCS-2026-4417। आपके ज़िले की साइबर सेल से अधिकारी संपर्क करेंगे। आपका डेटा सुरक्षित है। 🔒',
    reportBtn: '1930 पर रिपोर्ट करें',
    typing: 'प्रहरी लिख रहा है…',
    placeholder: 'संदिग्ध संदेश यहाँ लिखें…',
  },
}

const CAT_HI = {
  'Authority Impersonation': 'सरकारी अधिकारी बनने का ढोंग',
  'Victim Isolation Tactics': 'पीड़ित को अलग-थलग करना',
  'Urgency & Fear Induction': 'डर और जल्दबाज़ी पैदा करना',
  'Financial Extraction': 'पैसे ऐंठने की कोशिश',
  'Identity Harvesting': 'पहचान/OTP चुराने की कोशिश',
}

function bold(text) {
  // minimal *bold* / **bold** renderer
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={i}>{p.slice(2, -2)}</b>
    if (/^\*[^*]+\*$/.test(p)) return <b key={i}>{p.slice(1, -1)}</b>
    return <span key={i}>{p}</span>
  })
}

export default function CitizenShield() {
  const [lang, setLang] = useState('en')
  const [msgs, setMsgs] = useState([{ from: 'bot', text: STR.en.hello }])
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const [reported, setReported] = useState(false)
  const scrollRef = useRef(null)
  const t = STR[lang]

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs, typing])

  const assess = (text) => {
    if (!text.trim() || typing) return
    setMsgs((m) => [...m, { from: 'user', text }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      const a = analyzeTranscript(text)
      const tpl = a.verdict === 'critical' ? t.high : a.verdict === 'suspicious' ? t.med : t.low
      const acts = a.verdict === 'critical' ? t.highActs : a.verdict === 'suspicious' ? t.medActs : t.lowActs
      const signals = a.categories.filter((c) => c.hits > 0).sort((x, y) => y.score - x.score).slice(0, 3)
        .map((c) => `${lang === 'hi' ? (CAT_HI[c.label] || c.label) : c.label} (${c.hits})`)
      setTyping(false)
      setMsgs((m) => [...m, {
        from: 'bot', text: tpl(a.riskScore), verdict: a.verdict, signals, acts,
        offerReport: a.verdict !== 'low',
      }])
    }, 1300)
  }

  const fileReport = () => {
    if (reported) return
    setReported(true)
    setTyping(true)
    setTimeout(() => { setTyping(false); setMsgs((m) => [...m, { from: 'bot', text: t.report }]) }, 1100)
  }

  return (
    <div>
      <p className="section-desc">
        The same fusion engine, packaged for the last mile: a conversational shield on WhatsApp, IVR and SMS.
        Citizens forward anything suspicious and get an explainable verdict plus guided reporting to the 1930
        helpline — in their own language. <b>English and हिन्दी shown here; 12-language roadmap.</b>
      </p>

      <div className="wa-wrap">
        <div className="wa-phone">
          <div className="wa-header">
            <div className="wa-avatar">🛡</div>
            <div>
              <div className="wa-name">{t.header}</div>
              <div className="wa-status">{t.online}</div>
            </div>
            <div className="wa-lang">
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
              <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिं</button>
            </div>
          </div>

          <div className="wa-chat" ref={scrollRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`wa-bubble ${m.from}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{bold(m.text)}</div>
                {m.signals?.length > 0 && (
                  <div className="wa-signals">
                    <div className="wa-mini-title">{t.why}</div>
                    {m.signals.map((s) => <div key={s} className="wa-signal">• {s}</div>)}
                    <div className="wa-mini-title" style={{ marginTop: 6 }}>{t.act}</div>
                    {m.acts.map((a) => <div key={a} className="wa-signal">→ {a}</div>)}
                  </div>
                )}
                {m.offerReport && (
                  <button className="wa-report" onClick={fileReport} disabled={reported}>
                    {reported ? '✓' : '📝'} {t.reportBtn}
                  </button>
                )}
              </div>
            ))}
            {typing && <div className="wa-bubble bot typing"><span /><span /><span /></div>}
          </div>

          <div className="wa-chips">
            {SCENARIOS.map((s) => (
              <button key={s.label} onClick={() => assess(s.text)}>{s.label}</button>
            ))}
          </div>
          <div className="wa-input">
            <input value={input} placeholder={t.placeholder} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && assess(input)} />
            <button className="wa-send" onClick={() => assess(input)}>➤</button>
          </div>
        </div>

        <div className="card wa-side">
          <div className="card-title">Why this matters</div>
          <div className="kv"><span className="k">Channel reach</span><span className="v">WhatsApp · IVR · SMS</span></div>
          <div className="kv"><span className="k">Verdict latency</span><span className="v">&lt; 2 s</span></div>
          <div className="kv"><span className="k">Languages</span><span className="v">EN + हिन्दी live · 12 planned</span></div>
          <div className="kv"><span className="k">False-positive guard</span><span className="v">weighted multi-signal fusion</span></div>
          <div className="kv"><span className="k">Reporting</span><span className="v">guided 1930 / NCRB filing</span></div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7, marginTop: 12 }}>
            Every citizen interaction also feeds the national graph: a scam message triaged in a village becomes
            a signal that protects the whole country — the flywheel between Citizen Shield and Network Intel.
          </p>
        </div>
      </div>
    </div>
  )
}
