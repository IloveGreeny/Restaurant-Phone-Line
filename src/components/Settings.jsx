import { useState } from 'react'
import { isValidCalendlyUrl } from '../calendly/calendly.js'

export default function Settings({ url, onSave, onClose }) {
  const [value, setValue] = useState(url)
  const valid = isValidCalendlyUrl(value)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="settings-title">Calendar settings</h3>
        <p className="muted small">Paste the link of your Calendly event type. Bookings from calls open on this event with the caller's details prefilled.</p>
        <label htmlFor="cal-url">Calendly event link</label>
        <input id="cal-url" value={value} onChange={(e) => setValue(e.target.value.trim())} placeholder="https://calendly.com/qitchen/table-reservation" />
        {value && !valid && <p className="warn inline">That doesn't look like a Calendly event link.</p>}
        <div className="modal-actions">
          <button className="ghost-btn" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!valid} onClick={() => onSave(value)}>Save</button>
        </div>
      </div>
    </div>
  )
}
