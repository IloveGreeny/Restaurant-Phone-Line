import { useState } from 'react'
import { menu, allergenLabels } from '../data/menu.js'
import { describeDietary } from '../assistant/allergy.js'

const ALL = Object.keys(allergenLabels)

export default function AllergyAdvisor({ dietary }) {
  const [manual, setManual] = useState([])
  const fromCall = dietary && !dietary.none ? dietary.allergens : []
  const active = [...new Set([...fromCall, ...manual])]

  function toggle(tag) {
    setManual((m) => (m.includes(tag) ? m.filter((x) => x !== tag) : [...m, tag]))
  }

  const safeCount = menu.filter((i) => !i.allergens.some((a) => active.includes(a))).length

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Allergy-aware menu advisor</p>
          <h3>{active.length ? `${safeCount} of ${menu.length} rolls are safe` : 'Full menu'}</h3>
        </div>
        {fromCall.length > 0 && <span className="pill warn-pill">From call: {describeDietary(dietary)}</span>}
      </div>

      <div className="chips" role="group" aria-label="Filter by allergen">
        {ALL.map((tag) => (
          <button
            key={tag}
            className={`chip ${active.includes(tag) ? 'on' : ''} ${fromCall.includes(tag) ? 'locked' : ''}`}
            onClick={() => !fromCall.includes(tag) && toggle(tag)}
            aria-pressed={active.includes(tag)}
          >
            No {allergenLabels[tag]}
          </button>
        ))}
      </div>

      <ul className="menu-grid">
        {menu.map((item) => {
          const hits = item.allergens.filter((a) => active.includes(a))
          const safe = hits.length === 0
          return (
            <li key={item.name} className={`menu-item ${active.length ? (safe ? 'safe' : 'unsafe') : ''}`}>
              <img src={`/images/${item.image}`} alt={item.name} loading="lazy" />
              <div>
                <p className="mi-name">{item.name}</p>
                <p className="mi-desc">{item.desc} · ${item.price.toFixed(2)}</p>
                {active.length > 0 && (
                  <p className={`mi-tag ${safe ? 'ok' : 'bad'}`}>{safe ? 'Safe' : `Contains ${hits.join(', ')}`}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="fineprint">Allergen tags are based on menu descriptions and must be confirmed by the kitchen. Severe allergies are always flagged on the booking.</p>
    </div>
  )
}
