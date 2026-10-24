import { allSlots, lunchSlots, dinnerSlots, seatingOptions } from '../data/business.js'
import { fixSpelling } from './spelling.js'

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  'forty-five': 45, 'forty five': 45, a: 1, an: 1,
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const ORDINALS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16,
  seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, 'twenty first': 21, 'twenty second': 22,
  'twenty third': 23, 'twenty fourth': 24, 'twenty fifth': 25, 'twenty sixth': 26, 'twenty seventh': 27,
  'twenty eighth': 28, 'twenty ninth': 29, thirtieth: 30, 'thirty first': 31,
}

export function normalize(text, { fix = true } = {}) {
  let t = String(text).toLowerCase().replace(/[’']/g, "'")
  t = t.replace(/\b([ap])\s*[.,]?\s*m\b\.?/g, '$1m')
  t = t.replace(/(\d)\s*p\b(?!\.?m)/g, '$1pm')
  t = t.replace(/(\d)\.(\d{2})\b/g, '$1:$2')
  t = t.replace(/[^a-z0-9:@.' -]/g, ' ').replace(/(^|\s)[.']+|[.']+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim()
  if (fix) t = fixSpelling(t)
  return ` ${t} `
}

function wordToNumber(word) {
  if (word == null) return null
  if (/^\d+$/.test(word)) return Number(word)
  return NUMBER_WORDS[word] ?? null
}

export function parseYesNo(text) {
  const t = normalize(text)
  if (/\b(no|nope|nah|not really|don't|do not|wrong|change|wait)\b/.test(t)) return 'no'
  if (/\b(yes|yeah|yep|yup|sure|correct|right|perfect|great|ok|okay|confirm|book it|sounds good|please do|go ahead|absolutely|exactly)\b/.test(t)) return 'yes'
  return null
}

export function parseGuests(text, { bare = false } = {}) {
  const t = normalize(text)
  if (/\b(just me|only me|myself|by myself|alone|table for one)\b/.test(t)) return 1
  if (/\b(a couple of us|the two of us|me and my (wife|husband|partner|friend|girlfriend|boyfriend))\b/.test(t)) return 2
  const num = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
  const patterns = [
    new RegExp(`\\b(?:table|party|reservation|booking|group) (?:for|of) ${num}\\b`),
    new RegExp(`\\b${num} (?:people|persons|person|guests|guest|of us|adults|pax)\\b`),
    new RegExp(`\\bfor ${num}(?! ?(?:am|pm|o'clock|:))\\b(?! (?:pm|am|thirty|fifteen))`),
    new RegExp(`\\bwe are ${num}\\b|\\bwe're ${num}\\b|\\bthere(?: will be|'ll be| are) ${num}\\b`),
  ]
  for (const p of patterns) {
    const m = t.match(p)
    if (m) return wordToNumber(m[1])
  }
  if (bare) {
    const m = t.match(new RegExp(`^ ?${num} ?$|\\b${num}\\b`))
    if (m) return wordToNumber(m[1] ?? m[2])
  }
  return null
}

export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(iso) {
  return fromISODate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

export function parseDate(text, today = new Date()) {
  const t = normalize(text)
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (/\bday after tomorrow\b/.test(t)) return toISODate(addDays(base, 2))
  if (/\b(tomorrow|tmrw|tomorow)\b/.test(t)) return toISODate(addDays(base, 1))
  if (/\b(today|tonight|this evening)\b/.test(t)) return toISODate(base)

  for (let i = 0; i < 7; i++) {
    const re = new RegExp(`\\b(next |this |on |coming )?${WEEKDAYS[i]}s?\\b`)
    const m = t.match(re)
    if (m) {
      let diff = (i - base.getDay() + 7) % 7
      if (diff === 0) diff = 7
      if (m[1] === 'next ' && diff < 7 && /\bnext week\b/.test(t)) diff += 7
      return toISODate(addDays(base, diff))
    }
  }

  const inDays = t.match(/\bin (\d+|one|two|three|four|five|six|a) (day|days|week|weeks)\b/)
  if (inDays) {
    const n = wordToNumber(inDays[1]) ?? 1
    return toISODate(addDays(base, inDays[2].startsWith('week') ? n * 7 : n))
  }

  const monthRe = MONTHS.map((m) => `${m}|${m.slice(0, 3)}`).join('|')
  const ordRe = Object.keys(ORDINALS).sort((a, b) => b.length - a.length).join('|')
  const dayRe = `(\\d{1,2})(?:st|nd|rd|th)?|(${ordRe})`
  let month = null
  let day = null
  let m = t.match(new RegExp(`\\b(${monthRe})\\.? (?:the )?(?:${dayRe})\\b`))
  if (m) {
    month = monthIndex(m[1]); day = m[2] ? Number(m[2]) : ORDINALS[m[3]]
  } else {
    m = t.match(new RegExp(`\\b(?:the )?(?:${dayRe}) (?:of )?(${monthRe})\\b`))
    if (m) { day = m[1] ? Number(m[1]) : ORDINALS[m[2]]; month = monthIndex(m[3]) }
  }
  if (month == null) {
    const slash = t.match(/\b(\d{1,2})\/(\d{1,2})\b/)
    if (slash) { month = Number(slash[1]) - 1; day = Number(slash[2]) }
  }
  if (month == null) {
    const only = t.match(new RegExp(`\\bthe (?:${dayRe})\\b`))
    if (only) {
      day = only[1] ? Number(only[1]) : ORDINALS[only[2]]
      month = base.getMonth()
      if (day < base.getDate()) month += 1
    }
  }
  if (month != null && day >= 1 && day <= 31) {
    let year = base.getFullYear()
    let d = new Date(year, month, day)
    if (d < base) d = new Date(year + 1, month, day)
    return toISODate(d)
  }
  return null
}

function monthIndex(word) {
  return MONTHS.findIndex((m) => m.startsWith(word.slice(0, 3)))
}

export function parseTime(text, { bare = false } = {}) {
  const t = normalize(text)
  if (/\bnoon\b|\bmidday\b/.test(t)) return { minutes: 12 * 60 }
  const hourWords = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
  const minuteWords = '(?::(\\d{2})| (thirty|fifteen|forty five|forty-five|\\d{2}))?'

  const half = t.match(new RegExp(`\\bhalf past ${hourWords}\\b`))
  if (half) return { minutes: toMinutes(wordToNumber(half[1]), 30, null) }

  const h24 = t.match(/\b(1[3-9]|2[0-3]):([0-5]\d)\b/)
  if (h24) return { minutes: Number(h24[1]) * 60 + Number(h24[2]) }

  const patterns = [
    new RegExp(`\\b${hourWords}${minuteWords} ?(am|pm|a\\.m\\.|p\\.m\\.|o'clock|in the evening|in the afternoon)\\b`),
    new RegExp(`\\b(?:at|around|about|by) ${hourWords}${minuteWords}\\b`),
  ]
  if (bare) patterns.push(new RegExp(`\\b${hourWords}${minuteWords}\\b`))

  for (const p of patterns) {
    const m = t.match(p)
    if (m) {
      const hour = wordToNumber(m[1])
      const min = m[2] ? Number(m[2]) : m[3] ? wordToNumber(m[3]) ?? Number(m[3]) : 0
      const suffix = m[4] ?? null
      if (hour != null && hour <= 23 && min < 60) return { minutes: toMinutes(hour, min, suffix) }
    }
  }
  if (/\blunch\b/.test(t)) return { meal: 'lunch' }
  if (/\b(dinner|evening|tonight)\b/.test(t)) return { meal: 'dinner' }
  return null
}

function toMinutes(hour, min, suffix) {
  let h = hour
  if (suffix && suffix.startsWith('a')) { if (h === 12) h = 0 }
  else if (suffix && (suffix.startsWith('p') || suffix.includes('evening') || suffix.includes('afternoon'))) { if (h < 12) h += 12 }
  else if (h >= 1 && h <= 11) h += 12
  return h * 60 + min
}

export function slotToMinutes(slot) {
  const [time, ap] = slot.split(' ')
  let [h, m] = time.split(':').map(Number)
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return h * 60 + m
}

export function minutesToLabel(minutes) {
  let h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${String(m).padStart(2, '0')} ${ap}`
}

export function matchSlot(minutes) {
  const exact = allSlots.find((s) => slotToMinutes(s) === minutes)
  if (exact) return { slot: exact }
  const sorted = [...allSlots].sort((a, b) => Math.abs(slotToMinutes(a) - minutes) - Math.abs(slotToMinutes(b) - minutes))
  return { slot: null, suggestions: sorted.slice(0, 2).sort((a, b) => slotToMinutes(a) - slotToMinutes(b)) }
}

export function slotsForMeal(meal) {
  return meal === 'lunch' ? lunchSlots : dinnerSlots
}

export function parseSeating(text) {
  const t = normalize(text)
  if (/\b(counter|bar|chef|sushi bar)\b/.test(t)) return 'Sushi Counter'
  if (/\b(booth|private)\b/.test(t)) return 'Private Booth'
  if (/\b(outdoor|outside|terrace|patio)\b/.test(t)) return 'Outdoor Terrace'
  if (/\b(main|dining room|inside|indoor|regular|normal|regular table|normal table)\b/.test(t)) return 'Main Dining Room'
  if (/\b(no preference|anywhere|doesn't matter|does not matter|don't mind|whatever|any|anything|either)\b/.test(t)) return 'Main Dining Room'
  if (/\b(don't|dont|do not|doesn't|doesnt|no|not|any|without)\b.*\b(preference|preferences|matter|mind|care|bother)\b/.test(t)) return 'Main Dining Room'
  if (/\b(you choose|your choice|up to you|surprise me|either is fine|either one|whichever|wherever|idk|dunno|not sure|don't know|dont know|no idea)\b/.test(t)) return 'Main Dining Room'
  if (/\b(no|nope|none|nah|not really|no thanks|not particularly|i'm good|im good|fine)\b/.test(t)) return 'Main Dining Room'
  return null
}
export { seatingOptions }

const NOT_NAMES = new Set(['yes', 'no', 'hi', 'hello', 'hey', 'okay', 'ok', 'sure', 'um', 'uh', 'well', 'it', 'the', 'a', 'calling', 'looking', 'trying', 'wondering', 'here', 'just', 'not', 'allergic', 'vegetarian', 'vegan', 'good', 'fine', 'great', 'sorry', 'hungry', 'interested', 'free', 'gluten', 'lactose', 'celiac', 'going', 'coming', 'thinking', 'book', 'booking', 'or', 'maybe', 'instead', 'of', 'actually', 'wait', 'go', 'make', 'change', 'time', 'date', 'at', 'pm', 'am', 'then', 'perhaps', 'rather', 'u', 'you', 'thank', 'thanks', 'please', 'name', 'my', 'is', 'me', 'i', 'and', 'for', 'nope', 'none', 'nothing', 'skip', 'idk', 'dunno', 'whatever'])

function titleCase(s) {
  return s.split(' ').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

export function parseName(text, { bare = false } = {}) {
  const t = normalize(text, { fix: false })
  const m = t.match(/\b(?:my name is|my name's|name is|this is|i am|i'm|it's|it is|under(?: the name)?|call me) ([a-z][a-z'-]+(?: [a-z][a-z'-]+)?)/)
  if (m) {
    const words = m[1].split(' ').filter((w) => !NOT_NAMES.has(w) && !/^(and|for|at|on|with|calling|to|i)$/.test(w))
    if (words.length && !NOT_NAMES.has(m[1].split(' ')[0])) return titleCase(words.slice(0, 2).join(' '))
  }
  if (bare) {
    const words = t.trim().split(' ').filter((w) => /^[a-z][a-z'-]+$/.test(w) && !NOT_NAMES.has(w))
    if (words.length >= 1 && words.length <= 3) return titleCase(words.slice(0, 2).join(' '))
  }
  return null
}

export function parseEmail(text) {
  let t = String(text).toLowerCase().trim()
  const direct = t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)
  if (direct) return direct[0]
  t = t
    .replace(/\s+at\s+/g, '@')
    .replace(/\s*(dot|period|point)\s*/g, '.')
    .replace(/\s*(underscore)\s*/g, '_')
    .replace(/\s*(dash|hyphen)\s*/g, '-')
    .replace(/\s+/g, '')
  const spoken = t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)
  return spoken ? spoken[0] : null
}
