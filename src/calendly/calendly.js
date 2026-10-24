import { formatDate } from '../assistant/parsers.js'
import { describeDietary } from '../assistant/allergy.js'

const STORAGE_KEY = 'restaurant-phone-line-calendly-url'
export const DEFAULT_CALENDLY_URL = import.meta.env?.VITE_CALENDLY_URL ?? ''

export function isValidCalendlyUrl(url) {
  try {
    const u = new URL(url)
    return u.hostname.endsWith('calendly.com') && u.pathname.split('/').filter(Boolean).length >= 1 && !url.includes('your-name')
  } catch {
    return false
  }
}

export function loadCalendlyUrl() {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_CALENDLY_URL } catch { return DEFAULT_CALENDLY_URL }
}

export function saveCalendlyUrl(url) {
  try { localStorage.setItem(STORAGE_KEY, url) } catch {}
}

export function bookingNote(b) {
  const parts = [
    `Party of ${b.guests}`,
    `${formatDate(b.date)} at ${b.time}`,
    b.seating,
  ]
  if (b.dietary && !b.dietary.none) parts.push(`ALLERGY/DIET: ${describeDietary(b.dietary)}`)
  parts.push('Booked by phone via Restaurant Phone Line')
  return parts.join(' · ')
}

export function buildCalendlyUrl(base, b) {
  const url = new URL(base)
  if (b.name) url.searchParams.set('name', b.name)
  if (b.email) url.searchParams.set('email', b.email)
  url.searchParams.set('a1', bookingNote(b))
  if (b.date) {
    url.searchParams.set('month', b.date.slice(0, 7))
    url.searchParams.set('date', b.date)
  }
  url.searchParams.set('hide_gdpr_banner', '1')
  return url.toString()
}

let scriptPromise = null
export function loadCalendlyScript() {
  if (window.Calendly) return Promise.resolve(window.Calendly)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://assets.calendly.com/assets/external/widget.js'
      s.async = true
      s.onload = () => resolve(window.Calendly)
      s.onerror = () => { scriptPromise = null; reject(new Error('Could not load Calendly')) }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}
