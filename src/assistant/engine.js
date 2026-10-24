import { business, lunchSlots, dinnerSlots, seatingOptions } from '../data/business.js'
import { menu } from '../data/menu.js'
import {
  normalize, parseYesNo, parseGuests, parseDate, parseTime, parseSeating, parseName, parseEmail,
  matchSlot, slotsForMeal, formatDate, fromISODate, minutesToLabel, toISODate,
} from './parsers.js'
import { parseDietary, adviceSentence, describeDietary, listJoin } from './allergy.js'
import { pickValue, isBareNumber, endsWithGuests, endsWithTime, leadingCount, segments, isCorrection } from './corrections.js'

const SLOT_ORDER = ['guests', 'date', 'time', 'name', 'seating', 'dietary', 'email']

export function emptyBooking() {
  return { guests: null, date: null, time: null, name: null, seating: null, dietary: null, email: null, emailSkipped: false }
}

export function initialState() {
  return { mode: 'chat', awaiting: null, booking: emptyBooking(), pendingMeal: null, ended: false, misses: 0 }
}

export function greeting() {
  return `Thank you for calling ${business.name}, this is the ${business.assistantName}, your virtual host. I can book a table, answer questions about our menu and hours, or check which rolls are safe for allergies. How can I help you today?`
}

const QUESTIONS = {
  guests: () => 'How many guests will be joining?',
  date: () => 'Which day would you like to come in?',
  time: (s) => s.pendingMeal
    ? `For ${s.pendingMeal}, we have ${listJoin(slotsForMeal(s.pendingMeal), 'or')}. Which time works best?`
    : "What time would you like? We seat guests every half hour from 12 PM, and the last seating is at 8:30 PM.",
  name: () => 'May I have a name for the reservation?',
  seating: () => `Do you have a seating preference? We have the ${listJoin(seatingOptions.map((s) => s.toLowerCase()), 'or the')}.`,
  dietary: () => 'Does anyone in your party have food allergies or dietary needs? I can tell you which rolls are safe.',
  email: () => "Lastly, what email should we send the confirmation to? You can spell it out, like 'anna at gmail dot com', or say skip.",
}

function nextMissing(booking) {
  return SLOT_ORDER.find((k) => {
    if (k === 'email') return !booking.email && !booking.emailSkipped
    return booking[k] == null
  }) ?? null
}

export function seatingPhrase(seating) {
  return {
    'Sushi Counter': 'at the sushi counter',
    'Private Booth': 'in a private booth',
    'Outdoor Terrace': 'on the outdoor terrace',
  }[seating] ?? 'in the main dining room'
}

export function summary(booking) {
  const parts = [
    `a table for ${booking.guests}`,
    `on ${formatDate(booking.date)} at ${booking.time}`,
    seatingPhrase(booking.seating),
    `under the name ${booking.name}`,
  ]
  let s = parts.join(', ')
  if (booking.dietary && !booking.dietary.none) s += `, with "${describeDietary(booking.dietary)}" flagged for the kitchen`
  return s
}

function validateDate(iso, today) {
  const d = fromISODate(iso)
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (d < base) return "That date has already passed. Which upcoming day would you like?"
  if (business.closedWeekdays.includes(d.getDay())) {
    const next = new Date(d); next.setDate(d.getDate() + 1)
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
    return `We're closed on ${dayName}s, I'm sorry. Would ${next.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} or another day work?`
  }
  const max = new Date(base); max.setDate(base.getDate() + 90)
  if (d > max) return 'We take reservations up to three months ahead. Could you pick a closer date?'
  return null
}

function isPastSlotToday(booking, slot, today) {
  if (!booking.date || booking.date !== toISODate(today)) return false
  const [time, ap] = slot.split(' ')
  let [h, m] = time.split(':').map(Number)
  if (ap === 'PM' && h !== 12) h += 12
  return h * 60 + m <= today.getHours() * 60 + today.getMinutes() + 30
}

function detectIntent(t) {
  if (/\b(bye|goodbye|that's all|that is all|hang up|nothing else|that's it|no thanks|no thank you)\b/.test(t)) return 'goodbye'
  if (/\b(human|real person|manager|someone else|staff member|speak to (a|an|the) )\b/.test(t)) return 'human'
  if (/\b(cancel|start over|restart|reset)\b/.test(t)) return 'restart'
  if (/\b(hours|open|close|closing|opening)\b/.test(t)) return 'hours'
  if (/\b(where|address|located|location|directions|parking|find you)\b/.test(t)) return 'location'
  if (/\b(phone number|contact|your email)\b/.test(t)) return 'contact'
  if (/\b(menu|rolls?|maki|uramaki|price|prices|cost|how much|recommend|popular|special|what do you (have|serve)|dishes)\b/.test(t)) return 'menu'
  if (/\b(safe|allerg|gluten|vegan|vegetarian|shellfish|dairy|sesame|soy)\w*/.test(t) && /\b(can|what|which|is|are|do|does|safe|options|eat)\b/.test(t)) return 'allergyQuestion'
  if (/\b(book|reserve|reservation|table|booking|come in|dinner for|lunch for)\b/.test(t)) return 'book'
  return null
}

function resolveIntent(text, t) {
  const pieces = segments(text).map((p) => ({ ...p, intent: detectIntent(normalize(p.text)) })).filter((p) => p.intent)
  const changedMind = pieces.length > 1 && pieces.slice(1).some((p) => isCorrection(p.marker))
  if (changedMind) {
    const last = pieces[pieces.length - 1].intent
    return { intent: last, alsoBook: false, switchedToBooking: last === 'book' }
  }
  const intent = detectIntent(t)
  const wantsBooking = pieces.some((p) => p.intent === 'book') || /\b(book|reserve|reservation|booking)\b|\btable for\b/.test(t)
  const alsoBook = intent !== 'book' && ['menu', 'hours', 'location', 'contact', 'allergyQuestion'].includes(intent) && wantsBooking
  return { intent, alsoBook, switchedToBooking: false }
}

function menuAnswer(t) {
  const item = menu.find((i) => t.includes(i.name.toLowerCase().replace(' roll', '')) || t.includes(i.name.toLowerCase()))
  if (item) {
    const al = item.allergens.length ? `It contains ${listJoin(item.allergens, 'and')}.` : 'It has none of the common allergens on our list.'
    return `The ${item.name} is ${item.desc.toLowerCase()}, for $${item.price.toFixed(2)}. ${al}`
  }
  return `We serve three kinds of sushi: classic maki from $6.50, like Tekka and Sake Maki; uramaki such as the Rainbow Roll and Salmon Tobiko; and special rolls like the Crispy Volcano and Black Pearl, up to $18. Our guests love the Rainbow Roll.`
}

function extract(state, text, today, focus) {
  const b = { ...state.booking }
  const notes = []
  let pendingMeal = state.pendingMeal

  const undecided = (options, describe) => notes.push(`Would you prefer ${listJoin(options.map(describe), 'or')}?`)

  const range = normalize(text).match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:-|to)\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b(?!\s*(?::|am|pm|o'clock))/)
  const rangeIsGuests = range && (focus === 'guests' || /^\s*(people|guests|persons|of us|adults)\b/.test(normalize(text).slice(normalize(text).indexOf(range[0]) + range[0].length)))
  const guestPick = rangeIsGuests
    ? (() => { const a = parseGuests(range[1], { bare: true }); const z = parseGuests(range[2], { bare: true }); return a === z ? { value: a } : { options: [a, z] } })()
    : pickValue(text, (seg, { later, prev }) => {
        if (later && (endsWithGuests(prev) || focus === 'guests') && leadingCount(seg)) return parseGuests(leadingCount(seg), { bare: true })
        return parseGuests(seg, { bare: focus === 'guests' && !later })
      })
  if (guestPick.options) { b.guests = null; undecided(guestPick.options, (g) => `${g} ${g === 1 ? 'guest' : 'guests'}`) }
  const guests = guestPick.value ?? null
  if (guests != null) {
    if (guests < 1) notes.push('Sorry, how many guests was that?')
    else if (guests > business.maxGuests) notes.push(`For groups larger than ${business.maxGuests}, our manager arranges the booking personally. Please call ${business.phone} during opening hours, or I can book up to ${business.maxGuests} guests now.`)
    else b.guests = guests
  }

  const datePick = pickValue(text, (seg) => parseDate(seg, today))
  if (datePick.options) { b.date = null; undecided(datePick.options, formatDate) }
  const date = datePick.value ?? null
  if (date) {
    const problem = validateDate(date, today)
    if (problem) notes.push(problem)
    else { b.date = date; if (b.time && isPastSlotToday(b, b.time, today)) b.time = null }
  }

  const timePick = pickValue(
    text,
    (seg, { later, prev }) => parseTime(seg, { bare: (focus === 'time' && !later) || (later && isBareNumber(seg) && (focus === 'time' || endsWithTime(prev))) }),
    (t) => String(t.minutes ?? t.meal),
  )
  if (timePick.options) { b.time = null; undecided(timePick.options, (t) => (t.minutes != null ? minutesToLabel(t.minutes) : t.meal)) }
  const time = timePick.value ?? null
  if (time?.meal) { pendingMeal = time.meal; if (b.time && !slotsForMeal(time.meal).includes(b.time)) b.time = null }
  if (time?.minutes != null) {
    const { slot, suggestions } = matchSlot(time.minutes)
    if (slot && isPastSlotToday(b, slot, today)) notes.push(`${slot} has already passed today. Would a later time or another day work?`)
    else if (slot) { b.time = slot; pendingMeal = null }
    else notes.push(`We don't have a seating at ${minutesToLabel(time.minutes)}. The closest times are ${listJoin(suggestions, 'or')}. Which would you prefer?`)
  }

  if (focus === 'seating' || /\b(counter|booth|terrace|outdoor|outside|patio|dining room)\b/.test(normalize(text))) {
    const seatPick = pickValue(text, (seg) => parseSeating(seg))
    if (seatPick.options) { b.seating = null; undecided(seatPick.options, (x) => `the ${x.toLowerCase()}`) }
    if (seatPick.value) b.seating = seatPick.value
  }

  const changedOther = ['guests', 'date', 'time', 'seating'].some((k) => b[k] !== state.booking[k]) || notes.length > 0
  const name = parseName(text, { bare: focus === 'name' && !changedOther })
  if (name && (focus === 'name' || !b.name)) b.name = name

  const nameTurn = focus === 'name' && !/allerg|diet|vegan|vegetarian|intoleran/i.test(text)
  const mentionedName = parseName(text)
  const dietText = mentionedName ? text.replace(new RegExp(`\\b(${mentionedName.split(' ').join('|')})\\b`, 'gi'), ' ') : text
  const allowAll = focus === 'dietary' || state.awaiting === 'dietaryQuestion'
  const dietary = nameTurn ? null : parseDietary(dietText, { allowAll })
  let advice = null
  if (dietary && (!dietary.none || focus === 'dietary')) {
    b.dietary = dietary
    if (!dietary.none) advice = adviceSentence(dietary)
  }

  if (focus === 'email' || /@|\bat\b.*\bdot\b/.test(text)) {
    const email = parseEmail(text)
    if (email) b.email = email
    else if (focus === 'email' && /\b(skip|no|none|don't|rather not|no email)\b/.test(normalize(text))) b.emailSkipped = true
  }

  return { booking: b, notes, pendingMeal, advice }
}

function changedKeys(a, b) {
  return Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
}

function ack(keys, b) {
  const bits = []
  if (keys.includes('guests')) bits.push(`${b.guests} ${b.guests === 1 ? 'guest' : 'guests'}`)
  if (keys.includes('date') && b.date) bits.push(formatDate(b.date))
  if (keys.includes('time') && b.time) bits.push(`at ${b.time}`)
  if (keys.includes('seating') && b.seating) bits.push(`the ${b.seating.toLowerCase()}`)
  let s = bits.length ? `Great, ${bits.join(', ')}.` : ''
  if (keys.includes('name') && b.name) s = `${s} Thank you, ${b.name.split(' ')[0]}.`.trim()
  if (keys.includes('email') && b.email) s = `${s} I have ${b.email}.`.trim()
  return s
}

export function respond(prev, text, today = new Date()) {
  const state = { ...prev, booking: { ...prev.booking } }
  const t = normalize(text)
  const events = []
  const say = (...parts) => parts.filter(Boolean).join(' ')

  if (state.ended) return { state, reply: 'This call has ended. Start a new call to talk again.', events }

  if (state.mode === 'confirm') {
    const yn = parseYesNo(text)
    const { booking, notes, pendingMeal } = extract(state, text, today, null)
    const changed = changedKeys(state.booking, booking)
    if (changed.length) {
      state.booking = booking; state.pendingMeal = pendingMeal
      return finishOrAsk(state, say(ack(changed, booking), ...notes), events)
    }
    if (yn === 'yes') {
      state.mode = 'booked'
      state.awaiting = 'anythingElse'
      events.push({ type: 'booked', booking: state.booking })
      const b = state.booking
      const mail = b.email ? ` Calendly will then email your confirmation to ${b.email}.` : ' Calendly will then email you a confirmation.'
      return { state, events, reply: `Wonderful! Your details are filled in. To finish, pick ${b.time} on ${formatDate(b.date)} in the Calendly window and press Schedule Event.${mail} Is there anything else I can help with?` }
    }
    if (yn === 'no') {
      state.mode = 'chat'; state.awaiting = 'change'
      return { state, events, reply: 'No problem. What would you like to change: the number of guests, the date, the time, the seating, or the name?' }
    }
    return { state, events, reply: `Sorry, I didn't catch that. Should I go ahead and book ${summary(state.booking)}?` }
  }

  if (state.awaiting === 'change') {
    const map = { guests: /\b(guests|people|number|party|size)\b/, date: /\b(date|day)\b/, time: /\b(time|hour|later|earlier)\b/, seating: /\b(seat|seating|table|counter|booth|terrace)\b/, name: /\b(name)\b/, email: /\b(email|e-mail)\b/, dietary: /\b(allerg|diet)\w*/ }
    const { booking, notes, pendingMeal } = extract(state, text, today, null)
    const changed = changedKeys(state.booking, booking)
    if (changed.length) { state.booking = booking; state.pendingMeal = pendingMeal; state.awaiting = null; return finishOrAsk(state, say(ack(changed, booking), ...notes), events) }
    const field = Object.keys(map).find((k) => map[k].test(t))
    if (field) {
      state.booking[field] = null
      if (field === 'email') state.booking.emailSkipped = false
      state.awaiting = field
      return { state, events, reply: QUESTIONS[field](state) }
    }
  }

  const { intent, alsoBook, switchedToBooking } = resolveIntent(text, t)

  if (intent === 'goodbye' && !(state.awaiting && state.awaiting !== 'anythingElse' && parseYesNo(text) === 'no')) {
    state.ended = true
    events.push({ type: 'ended' })
    return { state, events, reply: `Thank you for calling ${business.name}. Have a wonderful day!` }
  }
  if (intent === 'restart') {
    const fresh = initialState()
    return { state: fresh, events: [{ type: 'reset' }], reply: "Okay, let's start fresh. Would you like to book a table?" }
  }
  if (intent === 'human') {
    events.push({ type: 'transfer' })
    return { state, events, reply: `Of course. Our team is available at ${business.phone} during opening hours, and I've left a note asking a staff member to call you back. Is there anything else I can help with meanwhile?` }
  }

  const focus = state.awaiting && SLOT_ORDER.includes(state.awaiting) ? state.awaiting : null
  const { booking, notes, pendingMeal, advice } = extract(state, text, today, focus)
  const changed = changedKeys(state.booking, booking)
  const bookingActive = state.mode === 'booking' || intent === 'book' || alsoBook || changed.some((k) => ['guests', 'date', 'time'].includes(k))

  let info = ''
  if (intent === 'hours') info = `We're open ${business.hoursText}`
  else if (intent === 'location') info = `We're at ${business.address}. Street parking is available nearby.`
  else if (intent === 'contact') info = `You can reach us at ${business.phone} or ${business.email}.`
  else if (intent === 'menu') info = menuAnswer(t)
  else if (intent === 'allergyQuestion' && !advice) info = 'Sure. Which allergy or diet should I check for? For example shellfish, gluten, dairy, sesame, or vegetarian.'
  if (intent === 'allergyQuestion' && !advice) state.awaiting = state.mode === 'booking' ? state.awaiting : 'dietaryQuestion'

  if (state.awaiting === 'dietaryQuestion' && !advice && !intent && !changed.length) {
    return { state, events, reply: "Sorry, which allergy should I check? You can name one or more, like shellfish and gluten, or say 'all of them'." }
  }
  if (state.awaiting === 'dietaryQuestion' && advice && state.mode !== 'booking') {
    state.booking = booking
    state.awaiting = 'offerBooking'
    return { state, events, reply: `${advice} Would you like me to book a table for you?` }
  }

  if (state.awaiting === 'offerBooking' || state.awaiting === 'anythingElse') {
    const yn = parseYesNo(text)
    const declines = yn === 'no' || /\b(nothing|i'm good|im good|i am good|all good|i'm fine|im fine|i'm ok|im ok|that's it|thats it|that's all|thats all|all set|i'm done|im done|done)\b/.test(t)
    if (yn === 'yes' && state.awaiting === 'offerBooking' && !changed.length) {
      state.mode = 'booking'
      return finishOrAsk(state, '', events)
    }
    if (yn === 'yes' && state.awaiting === 'anythingElse' && !changed.length && !intent) {
      return { state, events, reply: 'Of course. What else can I help you with? I can answer questions about our menu, hours, or allergies.' }
    }
    if (declines && !intent && !changed.length) {
      if (state.awaiting === 'offerBooking' && state.mode !== 'booked') {
        state.awaiting = 'anythingElse'
        return { state, events, reply: 'No problem. Is there anything else I can help you with?' }
      }
      state.ended = true
      events.push({ type: 'ended' })
      return { state, events, reply: `Thank you for calling ${business.name}. Have a wonderful day!` }
    }
  }

  if (bookingActive && state.mode !== 'booked') {
    state.mode = 'booking'
    state.booking = booking
    state.pendingMeal = pendingMeal
    const opener = switchedToBooking && !changed.length ? "Sure, let's book a table." : alsoBook && info ? "Now let's book your table." : ''
    const lead = say(info, opener, ack(changed.filter((k) => k !== 'dietary'), booking), advice, ...notes)
    if (notes.length) {
      state.misses = 0
      state.awaiting = nextMissing(state.booking) ?? state.awaiting
      return { state, events, reply: lead }
    }
    if (focus === 'time' && state.suggestedTime && !changed.length && parseYesNo(text) === 'yes') {
      state.booking.time = state.suggestedTime
      state.suggestedTime = null
      return finishOrAsk(state, `Great, ${state.booking.time} it is.`, events)
    }
    if (focus && !changed.length && !info) {
      const yn = parseYesNo(text)
      const unsure = /\b(idk|dunno|don't know|dont know|not sure|no idea|unsure|you choose|up to you|whatever)\b/.test(t)
      const helpers = {
        guests: () => (unsure || yn ? "Just tell me how many people, for example 'two people'. We can seat up to 6 by phone." : null),
        date: () => (unsure ? "No problem. We're open every day. You could say 'tonight', 'tomorrow' or a day like 'Friday'." : yn ? "Which day works for you? For example 'tomorrow' or 'next Friday'." : null),
        time: () => {
          if (unsure) { state.suggestedTime = '7:00 PM'; return 'Our most popular time is 7:00 PM. Would that work, or would you like another time?' }
          return yn ? 'What time would suit you? We seat guests every half hour from 12 PM until 8:30 PM.' : null
        },
        name: () => (yn === 'no' || unsure ? 'I just need a name to hold the table. A first name is fine.' : yn === 'yes' ? 'Great, what name should I put the reservation under?' : null),
        email: () => (yn === 'yes' ? "Great, what's the email address? You can spell it like 'anna at gmail dot com'." : null),
      }
      const help = helpers[focus]?.() ?? null
      if (help) return { state, events, reply: help }
      if (focus === 'dietary' && unsure) {
        state.booking.dietary = { allergens: [], diet: null, none: true }
        return finishOrAsk(state, "No problem. Our staff will check with you about allergies when you arrive.", events)
      }
      if (focus === 'email' && unsure) {
        state.booking.emailSkipped = true
        return finishOrAsk(state, "No worries, we'll skip the email.", events)
      }
    }
    if (focus === 'seating' && !changed.length && !info && parseYesNo(text) === 'yes') {
      return { state, events, reply: `Sure, which would you like: the ${listJoin(seatingOptions.map((s) => s.toLowerCase()), 'or the')}?` }
    }
    if (focus === 'dietary' && !changed.length && !info && parseYesNo(text) === 'yes') {
      return { state, events, reply: 'Okay. Which allergies or diets should I note? For example shellfish, gluten, dairy, sesame, or vegetarian.' }
    }
    if (focus && !changed.length && !info) {
      state.misses += 1
      if (state.misses >= 2 && focus === 'email') { state.booking.emailSkipped = true; state.misses = 0; return finishOrAsk(state, "No worries, we'll skip the email for now.", events) }
      return { state, events, reply: `Sorry, I didn't quite catch that. ${QUESTIONS[focus](state)}` }
    }
    state.misses = 0
    return finishOrAsk(state, lead, events)
  }

  if (state.mode === 'booked' && changed.length) {
    return { state, events, reply: say(info, `Your reservation is already confirmed. If you need to change it, just use the reschedule link in your Calendly email, or say "start over" to make a new booking.`) }
  }

  if (advice) {
    state.booking = booking
    state.awaiting = state.mode === 'booked' ? 'anythingElse' : 'offerBooking'
    return { state, events, reply: say(info, advice, state.mode === 'booked' ? "I've added that to your booking note. Anything else?" : 'Would you like me to book a table for you?') }
  }

  if (info) {
    const follow = state.mode === 'booked' ? 'Anything else I can help with?' : intent === 'menu' ? 'Would you like to book a table, or hear which rolls are safe for allergies?' : 'Would you like to book a table?'
    state.awaiting = state.awaiting === 'dietaryQuestion' ? 'dietaryQuestion' : (state.mode === 'booked' ? 'anythingElse' : 'offerBooking')
    return { state, events, reply: state.awaiting === 'dietaryQuestion' ? info : say(info, follow) }
  }

  if (state.mode === 'booked') {
    state.awaiting = 'anythingElse'
    return { state, events, reply: 'Is there anything else I can help you with? You can ask about our menu, hours, or allergy-safe rolls.' }
  }

  return { state, events, reply: "I can help you book a table, tell you about our menu and hours, or check allergy-safe dishes. What would you like to do?" }
}

function finishOrAsk(state, lead, events) {
  const missing = nextMissing(state.booking)
  if (missing) {
    state.awaiting = missing
    return { state, events, reply: [lead, QUESTIONS[missing](state)].filter(Boolean).join(' ') }
  }
  state.mode = 'confirm'
  state.awaiting = 'confirm'
  return { state, events, reply: [lead, `Let me confirm: ${summary(state.booking)}. Shall I book it?`].filter(Boolean).join(' ') }
}

export { lunchSlots, dinnerSlots }
