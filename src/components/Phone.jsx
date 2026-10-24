import { useEffect, useRef, useState } from 'react'
import { business } from '../data/business.js'

function useTimer(startedAt, running) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])
  if (!startedAt) return '00:00'
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" /></svg>
  )
}
function PhoneIcon({ down }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" style={down ? { transform: 'rotate(135deg)' } : undefined}>
      <path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1l-2.2 2.2Z" />
    </svg>
  )
}

export default function Phone({ status, messages, speech, startedAt, handsFree, voiceOn, onToggleHandsFree, onToggleVoice, onStart, onEnd, onSend }) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)
  const timer = useTimer(startedAt, status === 'active')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, speech.interim])

  function submit(e) {
    e.preventDefault()
    if (!draft.trim()) return
    speech.stopSpeaking()
    onSend(draft.trim())
    setDraft('')
  }

  const state = speech.speaking ? 'Speaking' : speech.listening ? 'Listening…' : status === 'active' ? 'On call' : ''

  return (
    <div className="phone" aria-label="Phone call simulator">
      <div className="phone-notch" aria-hidden="true" />
      <div className="phone-screen">
        {(status === 'idle' || status === 'ended') && (
          <div className="dialer">
            <p className="eyebrow">{status === 'ended' ? 'Call ended' : 'Incoming line'}</p>
            <div className="avatar big"><span>Q</span></div>
            <h2>{business.name}</h2>
            <p className="muted">{business.phone}</p>
            {status === 'ended' && messages.length > 0 && (
              <p className="ended-note">{messages.filter((m) => m.from === 'caller').length} caller turns · {timer}</p>
            )}
            <button className="call-btn" onClick={onStart} aria-label="Call Qitchen">
              <PhoneIcon />
            </button>
            <p className="muted small">Tap to call — Restaurant Phone Line will answer</p>
            <p className="dialer-hint">Try: “A table for 4 next Friday at 7, one of us is allergic to shellfish.”</p>
            {!speech.canListen && (
              <p className="warn">Voice input needs Chrome, Edge or Safari. You can still type your side of the call.</p>
            )}
          </div>
        )}

        {status === 'ringing' && (
          <div className="dialer">
            <p className="eyebrow">Calling…</p>
            <div className="avatar big ringing"><span>Q</span></div>
            <h2>{business.name}</h2>
            <p className="muted">Connecting to Restaurant Phone Line</p>
          </div>
        )}

        {status === 'active' && (
          <div className="incall">
            <div className="incall-head">
              <div className="avatar"><span>Q</span></div>
              <div>
                <p className="incall-name">{business.name} · Restaurant Phone Line</p>
                <p className="incall-meta">
                  <span className={`dot ${speech.speaking ? 'speaking' : speech.listening ? 'listening' : ''}`} /> {state} · {timer}
                </p>
              </div>
            </div>

            <div className="transcript" ref={scrollRef} aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} className={`bubble ${m.from}`}>{m.text}</div>
              ))}
              {speech.interim && <div className="bubble caller interim">{speech.interim}…</div>}
            </div>

            {speech.error && <p className="warn inline">{speech.error}</p>}

            <form className="composer" onSubmit={submit}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={speech.listening ? 'Listening… or type here' : 'Type what the caller says'}
                aria-label="Caller message"
              />
              <button type="submit" className="send-btn" disabled={!draft.trim()}>Send</button>
            </form>

            <div className="controls">
              <button className={`round ${voiceOn ? 'on' : ''}`} onClick={onToggleVoice} title="Assistant voice">
                <span>{voiceOn ? 'Voice' : 'Muted'}</span>
              </button>
              <button
                className={`round mic ${speech.listening ? 'live' : ''}`}
                onClick={() => (speech.listening ? speech.stopListening() : (speech.stopSpeaking(), speech.startListening()))}
                disabled={!speech.canListen}
                aria-label={speech.listening ? 'Stop listening' : 'Talk'}
                title={speech.canListen ? 'Push to talk' : 'Voice input not supported in this browser'}
              >
                <MicIcon />
              </button>
              <button className={`round ${handsFree ? 'on' : ''}`} onClick={onToggleHandsFree} title="Auto-listen after each reply">
                <span>{handsFree ? 'Auto' : 'Manual'}</span>
              </button>
            </div>

            <button className="hangup" onClick={onEnd} aria-label="End call"><PhoneIcon down /></button>
          </div>
        )}
      </div>
    </div>
  )
}
