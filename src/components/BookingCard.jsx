import { formatDate } from '../assistant/parsers.js'
import { describeDietary } from '../assistant/allergy.js'

const FIELDS = [
  { key: 'guests', label: 'Guests', show: (b) => `${b.guests} ${b.guests === 1 ? 'person' : 'people'}` },
  { key: 'date', label: 'Date', show: (b) => formatDate(b.date) },
  { key: 'time', label: 'Time', show: (b) => b.time },
  { key: 'name', label: 'Name', show: (b) => b.name },
  { key: 'seating', label: 'Seating', show: (b) => b.seating },
  { key: 'dietary', label: 'Allergies / diet', show: (b) => describeDietary(b.dietary) },
  { key: 'email', label: 'Email', show: (b) => b.email ?? (b.emailSkipped ? 'Skipped' : null) },
]

const MODE_LABEL = {
  chat: 'Listening for a request',
  booking: 'Collecting details',
  confirm: 'Waiting for caller to confirm',
  booked: 'Booked — confirmation emailed by Calendly',
}

export default function BookingCard({ booking, mode, awaiting, active, calendlyDone }) {
  const pendingCalendly = mode === 'booked' && !calendlyDone
  const done = FIELDS.filter((f) => booking[f.key] != null || (f.key === 'email' && booking.emailSkipped)).length

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Live booking</p>
          <h3>{pendingCalendly ? 'Details ready — finish in Calendly below' : MODE_LABEL[mode] ?? 'Ready'}</h3>
        </div>
        <span className={`pill ${pendingCalendly ? 'warn-pill' : mode === 'booked' ? 'ok' : active ? 'live' : ''}`}>
          {pendingCalendly ? 'Waiting for Calendly' : mode === 'booked' ? 'Confirmed' : active ? 'Live' : 'Idle'}
        </span>
      </div>
      <div className="progress" aria-hidden="true"><span style={{ width: `${(done / FIELDS.length) * 100}%` }} /></div>
      <dl className="fields">
        {FIELDS.map((f) => {
          const filled = booking[f.key] != null || (f.key === 'email' && booking.emailSkipped)
          const value = filled ? f.show(booking) : null
          const isAllergy = f.key === 'dietary' && booking.dietary && !booking.dietary.none
          return (
            <div key={f.key} className={`field ${filled ? 'filled' : ''} ${awaiting === f.key && active ? 'asking' : ''}`}>
              <dt>{f.label}</dt>
              <dd className={isAllergy ? 'allergy' : ''}>{value ?? (awaiting === f.key && active ? 'Asking…' : '—')}</dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
