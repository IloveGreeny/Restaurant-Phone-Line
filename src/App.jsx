import { useCallback, useEffect, useRef, useState } from 'react'
import { business } from './data/business.js'
import { respond, initialState, greeting } from './assistant/engine.js'
import { useSpeech } from './hooks/useSpeech.js'
import { loadCalendlyUrl, saveCalendlyUrl } from './calendly/calendly.js'
import Phone from './components/Phone.jsx'
import BookingCard from './components/BookingCard.jsx'
import AllergyAdvisor from './components/AllergyAdvisor.jsx'
import CalendlyPanel from './components/CalendlyPanel.jsx'
import CallLog from './components/CallLog.jsx'
import Settings from './components/Settings.jsx'

const LOG_KEY = 'restaurant-phone-line-calls'

function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) ?? [] } catch { return [] }
}
function saveLog(log) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 20))) } catch {}
}

export default function App() {
  const [callStatus, setCallStatus] = useState('idle')
  const [engine, setEngine] = useState(initialState)
  const [messages, setMessages] = useState([])
  const [handsFree, setHandsFree] = useState(true)
  const [voiceOn, setVoiceOn] = useState(true)
  const [booked, setBooked] = useState(null)
  const [callId, setCallId] = useState(null)
  const [log, setLog] = useState(loadLog)
  const [calendlyUrl, setCalendlyUrl] = useState(loadCalendlyUrl)
  const [showSettings, setShowSettings] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [calendlyDone, setCalendlyDone] = useState(false)

  const engineRef = useRef(engine)
  engineRef.current = engine
  const statusRef = useRef(callStatus)
  statusRef.current = callStatus
  const prefsRef = useRef({ handsFree, voiceOn })
  prefsRef.current = { handsFree, voiceOn }

  const handleCallerTextRef = useRef(null)
  const speech = useSpeech({ onFinal: (text) => handleCallerTextRef.current?.(text) })

  const assistantSay = useCallback((text, { ended = false } = {}) => {
    setMessages((m) => [...m, { from: 'assistant', text, at: Date.now() }])
    const after = () => {
      if (ended) { setCallStatus('ended'); return }
      if (prefsRef.current.handsFree && statusRef.current === 'active' && speech.canListen) speech.startListening()
    }
    if (prefsRef.current.voiceOn) speech.speak(text, after)
    else after()
  }, [speech])

  const upsertLog = useCallback((entry) => {
    setLog((prev) => {
      const next = [entry, ...prev.filter((e) => e.id !== entry.id)]
      saveLog(next)
      return next
    })
  }, [])

  const handleCallerText = useCallback((text) => {
    if (statusRef.current !== 'active' || !text.trim()) return
    speech.stopListening()
    setMessages((m) => [...m, { from: 'caller', text, at: Date.now() }])
    const result = respond(engineRef.current, text)
    setEngine(result.state)
    engineRef.current = result.state
    let ended = false
    for (const ev of result.events) {
      if (ev.type === 'booked') {
        setBooked(ev.booking)
        setCalendlyDone(false)
        upsertLog({ id: callId, at: Date.now(), booking: ev.booking, status: 'Waiting for Calendly' })
        const wait = prefsRef.current.voiceOn ? Math.min(result.reply.length * 60, 12000) : 1500
        setTimeout(() => {
          setPhoneOpen(false)
          document.getElementById('calendly-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, wait)
      }
      if (ev.type === 'transfer') upsertLog({ id: `${callId}-cb`, at: Date.now(), booking: result.state.booking, status: 'Callback requested' })
      if (ev.type === 'reset') setBooked(null)
      if (ev.type === 'ended') ended = true
    }
    setTimeout(() => assistantSay(result.reply, { ended }), 350)
  }, [assistantSay, callId, speech, upsertLog])
  handleCallerTextRef.current = handleCallerText

  function startCall() {
    speech.stopSpeaking()
    const fresh = initialState()
    setEngine(fresh)
    engineRef.current = fresh
    setMessages([])
    setBooked(null)
    setCalendlyDone(false)
    setCallId(`call-${Date.now()}`)
    setCallStatus('ringing')
    setTimeout(() => {
      setCallStatus('active')
      statusRef.current = 'active'
      setStartedAt(Date.now())
      assistantSay(greeting())
    }, 1400)
  }

  function endCall() {
    speech.stopListening()
    speech.stopSpeaking()
    setCallStatus('ended')
  }

  const onCalendlyScheduled = useCallback(() => {
    if (!booked) return
    setCalendlyDone(true)
    upsertLog({ id: callId, at: Date.now(), booking: booked, status: 'Confirmed in Calendly' })
    if (statusRef.current === 'active') {
      assistantSay(`Your table is now confirmed in Calendly${booked.email ? `, and the confirmation email is on its way to ${booked.email}` : ''}. Anything else I can help with?`)
    }
  }, [assistantSay, booked, callId, upsertLog])

  const { stopSpeaking } = speech
  useEffect(() => {
    if (!voiceOn) stopSpeaking()
  }, [voiceOn, stopSpeaking])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <div>
            <p className="brand-name">Restaurant Phone Line</p>
            <p className="brand-sub">AI phone host for <strong><span>Q</span>itchen</strong></p>
          </div>
        </div>
        <button className="ghost-btn" onClick={() => setShowSettings(true)}>Calendar settings</button>
      </header>

      <main className="layout">
        <section className="intro">
          <p className="eyebrow">Qitchen phone line</p>
          <h1>Calls answered, tables booked, <span>allergies flagged.</span></h1>
          <p className="muted">Tap the phone button in the corner to call Qitchen. Restaurant Phone Line answers, books your table on Calendly, and tells you which rolls are safe for your allergies.</p>
        </section>

        <section className="side-col">
          <BookingCard booking={engine.booking} mode={engine.mode} awaiting={engine.awaiting} active={callStatus === 'active'} calendlyDone={calendlyDone} />
          {booked && (
            <CalendlyPanel
              booking={booked}
              calendlyUrl={calendlyUrl}
              onOpenSettings={() => setShowSettings(true)}
              onScheduled={onCalendlyScheduled}
            />
          )}
          <AllergyAdvisor dietary={engine.booking.dietary} />
          <CallLog log={log} onClear={() => { setLog([]); saveLog([]) }} />
        </section>
      </main>

      <div className={`phone-popover ${phoneOpen ? 'open' : ''}`} aria-hidden={!phoneOpen}>
        <button className="popover-close" onClick={() => setPhoneOpen(false)} aria-label="Minimize phone">–</button>
        <Phone
            status={callStatus}
            messages={messages}
            speech={speech}
            startedAt={startedAt}
            handsFree={handsFree}
            voiceOn={voiceOn}
            onToggleHandsFree={() => setHandsFree((v) => !v)}
            onToggleVoice={() => setVoiceOn((v) => !v)}
            onStart={startCall}
            onEnd={endCall}
            onSend={handleCallerText}
          />
      </div>

      <button
        className={`launcher ${phoneOpen ? 'hidden' : ''} ${callStatus === 'active' ? 'on-call' : ''}`}
        onClick={() => setPhoneOpen(true)}
        aria-label={callStatus === 'active' ? 'Return to call' : 'Open Qitchen phone line'}
      >
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1l-2.2 2.2Z" />
        </svg>
        {callStatus === 'active' && <span className="launcher-badge">On call</span>}
      </button>

      <footer className="foot">
        {business.name} · {business.address} · {business.phone}
      </footer>

      {showSettings && (
        <Settings
          url={calendlyUrl}
          onSave={(url) => { setCalendlyUrl(url); saveCalendlyUrl(url); setShowSettings(false) }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
