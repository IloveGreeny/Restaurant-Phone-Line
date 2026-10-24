import { formatDate } from '../assistant/parsers.js'
import { describeDietary } from '../assistant/allergy.js'

export default function CallLog({ log, onClear }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Staff view</p>
          <h3>Bookings from calls</h3>
        </div>
        {log.length > 0 && <button className="ghost-btn" onClick={onClear}>Clear</button>}
      </div>
      {log.length === 0 ? (
        <p className="muted small">No calls yet. Bookings made by Restaurant Phone Line appear here.</p>
      ) : (
        <ul className="log">
          {log.map((e) => (
            <li key={e.id}>
              <div>
                <p className="log-title">{e.booking.name ?? 'Unknown caller'} · {e.booking.guests ?? '?'} guests</p>
                <p className="muted small">
                  {e.booking.date ? formatDate(e.booking.date) : 'No date'} {e.booking.time ? `· ${e.booking.time}` : ''} {e.booking.seating ? `· ${e.booking.seating}` : ''}
                </p>
                {e.booking.dietary && !e.booking.dietary.none && <p className="log-allergy">⚠ {describeDietary(e.booking.dietary)}</p>}
              </div>
              <span className={`pill ${e.status.startsWith('Confirmed') ? 'ok' : (e.status.startsWith('Callback') || e.status.startsWith('Waiting')) ? 'warn-pill' : ''}`}>{e.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
