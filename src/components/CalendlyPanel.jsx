import { useEffect, useRef, useState } from 'react'
import { buildCalendlyUrl, bookingNote, isValidCalendlyUrl, loadCalendlyScript } from '../calendly/calendly.js'
import { formatDate } from '../assistant/parsers.js'

export default function CalendlyPanel({ booking, calendlyUrl, onOpenSettings, onScheduled }) {
  const ref = useRef(null)
  const [state, setState] = useState('loading')
  const valid = isValidCalendlyUrl(calendlyUrl)
  const url = valid ? buildCalendlyUrl(calendlyUrl, booking) : null

  useEffect(() => {
    if (!url) return
    let cancelled = false
    setState('loading')
    loadCalendlyScript()
      .then((Calendly) => {
        if (cancelled || !ref.current) return
        ref.current.innerHTML = ''
        Calendly.initInlineWidget({
          url,
          parentElement: ref.current,
          prefill: {
            name: booking.name ?? '',
            email: booking.email ?? '',
            customAnswers: { a1: bookingNote(booking) },
          },
        })
        setState('ready')
      })
      .catch(() => !cancelled && setState('error'))
    return () => { cancelled = true }
  }, [url, booking])

  useEffect(() => {
    function onMessage(e) {
      if (!String(e.origin).includes('calendly.com')) return
      if (e.data?.event === 'calendly.event_scheduled') {
        setState('scheduled')
        onScheduled?.(e.data.payload)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onScheduled])

  return (
    <div className="card calendly-card" id="calendly-step">
      <div className="card-head">
        <div>
          <p className="eyebrow">Calendly · last step</p>
          <h3>{state === 'scheduled' ? 'Booked! Confirmation email sent by Calendly' : `Finish the booking: ${booking.time}, ${formatDate(booking.date)}`}</h3>
        </div>
        {url && <a className="ghost-btn" href={url} target="_blank" rel="noreferrer">Open in Calendly ↗</a>}
      </div>

      {!valid && (
        <div className="setup">
          <p><strong>Connect your Calendly to finish bookings.</strong> The caller's details are ready to send.</p>
          <ol>
            <li>In Calendly, create an event type such as “Qitchen Table Reservation” (15–30 min).</li>
            <li>Add one custom question, “Booking notes”, so the party size, seating and allergies are saved.</li>
            <li>Copy the event link and paste it in Calendar settings.</li>
          </ol>
          <button className="btn" onClick={onOpenSettings}>Add Calendly link</button>
          <p className="note-preview"><span>Note that will be sent:</span> {bookingNote(booking)}</p>
        </div>
      )}

      {valid && (
        <>
          <ol className="steps">
            <li className="done"><span>✓</span><p>Details filled in{booking.email ? ` (${booking.email})` : ''}</p></li>
            <li className={state === 'scheduled' ? 'done' : 'current'}><span>{state === 'scheduled' ? '✓' : '2'}</span><p>Pick <strong>{formatDate(booking.date)}</strong> → <strong>{booking.time}</strong> in the calendar below</p></li>
            <li className={state === 'scheduled' ? 'done' : ''}><span>{state === 'scheduled' ? '✓' : '3'}</span><p>Click <strong>Schedule Event</strong>. Calendly then emails the confirmation</p></li>
          </ol>
          {state !== 'scheduled' && (
            <p className="fineprint">
              Calendly shows times in your own time zone and only the hours set in your Calendly availability. If {booking.time} isn't listed, pick the nearest time or update the event's availability in Calendly.
            </p>
          )}
          {state === 'error' && <p className="warn inline">Calendly couldn't load here. Use “Open in Calendly” instead.</p>}
          <div ref={ref} className="calendly-embed" />
        </>
      )}
    </div>
  )
}
