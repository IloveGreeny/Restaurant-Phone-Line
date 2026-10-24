import { test } from 'node:test'
import assert from 'node:assert/strict'
import { respond, initialState } from './engine.js'
import { parseDate, parseTime, parseGuests, parseEmail, parseName } from './parsers.js'
import { parseDietary, safeItems } from './allergy.js'

const TODAY = new Date(2026, 9, 24, 11, 0)

function call(lines, verbose = false) {
  let state = initialState()
  const replies = []
  const events = []
  for (const line of lines) {
    const r = respond(state, line, TODAY)
    state = r.state
    replies.push(r.reply)
    events.push(...r.events)
    if (verbose) console.log(`CALLER: ${line}\nASSISTANT: ${r.reply}\n`)
  }
  return { state, replies, events }
}

test('parsers', () => {
  assert.equal(parseDate('tomorrow', TODAY), '2026-10-25')
  assert.equal(parseDate('next friday', TODAY), '2026-10-30')
  assert.equal(parseDate('October 30th', TODAY), '2026-10-30')
  assert.equal(parseDate('the 2nd of november', TODAY), '2026-11-02')
  assert.equal(parseTime('at 7')?.minutes, 19 * 60)
  assert.equal(parseTime('half past six')?.minutes, 18 * 60 + 30)
  assert.equal(parseTime('7:30 pm')?.minutes, 19 * 60 + 30)
  assert.equal(parseTime('noon')?.minutes, 12 * 60)
  assert.equal(parseGuests('a table for four'), 4)
  assert.equal(parseGuests('3 people'), 3)
  assert.equal(parseGuests('for 7pm'), null)
  assert.equal(parseEmail('anna dot smith at gmail dot com'), 'anna.smith@gmail.com')
  assert.equal(parseName('my name is anna petrosyan'), 'Anna Petrosyan')
  assert.equal(parseName("I'm allergic to shellfish"), null)
})

test('allergy advisor', () => {
  const d = parseDietary("I'm allergic to shellfish")
  assert.deepEqual(d.allergens, ['shellfish'])
  const safe = safeItems(d.allergens).map((i) => i.name)
  assert.ok(safe.includes('Tekka Maki'))
  assert.ok(!safe.includes('Rainbow Roll'))
  const veg = parseDietary("we're vegetarian")
  assert.deepEqual(safeItems(veg.allergens).map((i) => i.name), ['Oshinko Maki'])
})

test('full booking in one breath', () => {
  const { state, events } = call([
    "Hi, I'd like a table for 4 next Friday at 7pm, I'm allergic to shellfish",
    'Anna Petrosyan',
    'the sushi counter please',
    'anna at gmail dot com',
    'yes please',
  ], process.env.VERBOSE)
  assert.equal(state.mode, 'booked')
  assert.equal(state.booking.guests, 4)
  assert.equal(state.booking.date, '2026-10-30')
  assert.equal(state.booking.time, '7:00 PM')
  assert.equal(state.booking.seating, 'Sushi Counter')
  assert.equal(state.booking.email, 'anna@gmail.com')
  assert.deepEqual(state.booking.dietary.allergens, ['shellfish'])
  assert.ok(events.some((e) => e.type === 'booked'))
})

test('step by step: Monday is open now, odd time gets suggestions', () => {
  const { state, replies } = call([
    'I want to make a reservation',
    'two',
    'Monday',
    'at 4:15',
    '5:30',
    'my name is David',
    'no preference',
    'no allergies',
    'skip',
    'no',
    'time',
    'dinner at 8',
    'yes',
  ], process.env.VERBOSE)
  assert.match(replies[2], /Monday, October 26/)
  assert.match(replies[3], /closest times are 4:00 PM or 4:30 PM/)
  assert.equal(state.booking.time, '8:00 PM')
  assert.equal(state.booking.date, '2026-10-26')
  assert.equal(state.mode, 'booked')
})

test('new hours: 12 PM – 9 PM, last seating 8:30', () => {
  const { replies } = call(['what are your hours', 'table for 2 tomorrow at 9pm'])
  assert.match(replies[0], /12 PM to 9 PM/)
  assert.match(replies[1], /8:00 PM or 8:30 PM/)
})

test('bug: answering the suggested time with "p.m." after jumping ahead', () => {
  const { state, replies } = call([
    'I want to book a table',
    '2',
    'tomorrow at 5:15 p.m.',
    'like 7:00 p.m.',
  ], process.env.VERBOSE)
  assert.match(replies[2], /closest times/)
  assert.equal(state.booking.date, '2026-10-25')
  assert.equal(state.booking.time, '7:00 PM')
  assert.match(replies[3], /name/)
})

test('bug: "5:30 p,m" and "5.30 pm" understood', () => {
  let r = call(['table for 2 tomorrow', '5:30 p,m'])
  assert.equal(r.state.booking.time, '5:30 PM')
  r = call(['table for 2 tomorrow', '5.30 pm'])
  assert.equal(r.state.booking.time, '5:30 PM')
})

test('bug: misspellings are understood', () => {
  const { state } = call(['i want a reservaton for 3 pepole tommorow at 6pm, we are vegeterian', 'Daisy'])
  assert.equal(state.booking.guests, 3)
  assert.equal(state.booking.date, '2026-10-25')
  assert.equal(state.booking.time, '6:00 PM')
  assert.equal(state.booking.dietary.diet, 'vegetarian')
  assert.equal(state.booking.name, 'Daisy')
  assert.deepEqual(state.booking.dietary.allergens.sort(), ['fish', 'shellfish'])
  const daisy = call(['Hi, my name is Daisy, a table for 2 tomorrow at 6pm']).state.booking
  assert.equal(daisy.name, 'Daisy')
  assert.equal(daisy.dietary, null)
  assert.equal(call(['table for 2', 'tomorow']).state.booking.date, '2026-10-25')
  assert.equal(call(['table for 2', 'next fridy']).state.booking.date, '2026-10-30')
})

test('bug: saying "no" to "anything else?" ends the call', () => {
  const base = ['table for 2 tomorrow at 7pm', 'Ani', 'no preference', 'none', 'skip', 'yes']
  for (const answer of ['no', 'nope', 'no thanks', "no i'm good", 'nothing', "that's it"]) {
    const { state, replies } = call([...base, answer])
    assert.equal(state.ended, true, `"${answer}" should end the call`)
    assert.match(replies.at(-1), /Have a wonderful day/)
  }
})

test('questions mid-call', () => {
  const { replies, state } = call([
    'What are your hours?',
    'what can I eat if I am vegan',
    'yes',
    'for 2 tomorrow at lunch',
    '12:30',
    'Lilit',
    'outside',
    'bye',
  ], process.env.VERBOSE)
  assert.match(replies[0], /every day/)
  assert.match(replies[1], /Oshinko/)
  assert.equal(state.booking.time, '12:30 PM')
  assert.equal(state.booking.seating, 'Outdoor Terrace')
  assert.equal(state.ended, true)
})

test('bug: "no" / "I don\'t have a preference" answers the seating question', () => {
  const base = ['table for 2 tomorrow at 7pm', 'Manvel']
  for (const answer of ['no', 'nope', 'i dont have prefernce', "I don't have a preference", "doesn't matter", 'any', 'either is fine', 'up to you', 'no thanks', 'not really', 'whatever']) {
    const { state, replies } = call([...base, answer])
    assert.equal(state.booking.seating, 'Main Dining Room', `"${answer}" should mean no preference`)
    assert.match(replies.at(-1), /allergies/)
  }
  const yes = call([...base, 'yes'])
  assert.match(yes.replies.at(-1), /which would you like/)
  assert.equal(call([...base, 'yes', 'the terrace']).state.booking.seating, 'Outdoor Terrace')
  assert.equal(call([...base, 'sushi counter please']).state.booking.seating, 'Sushi Counter')
})

test('bug: filler words are not taken as a name', () => {
  for (const answer of ['u', 'you', 'thank you', 'thanks']) {
    const { state } = call(['table for 2 tomorrow at 7pm', answer])
    assert.equal(state.booking.name, null, `"${answer}" is not a name`)
  }
  assert.equal(call(['table for 2 tomorrow at 7pm', 'Ani']).state.booking.name, 'Ani')
})

test('helpful replies to yes / no / "I don\'t know" on every question', () => {
  const t = (lines) => call(lines)
  assert.match(t(['book a table', 'idk']).replies.at(-1), /how many people/)
  assert.match(t(['book a table', '2', "i don't know"]).replies.at(-1), /open every day/)
  const time = t(['book a table', '2', 'tomorrow', 'not sure', 'yes'])
  assert.equal(time.state.booking.time, '7:00 PM')
  assert.match(t(['table for 2 tomorrow at 7pm', 'no']).replies.at(-1), /first name is fine/)
  assert.equal(t(['table for 2 tomorrow at 7pm', 'Ani', "i don't know"]).state.booking.seating, 'Main Dining Room')
  assert.match(t(['table for 2 tomorrow at 7pm', 'Ani', 'counter', 'not sure']).replies.at(-1), /check with you about allergies/)
  assert.match(t(['table for 2 tomorrow at 7pm', 'Ani', 'counter', 'none', 'yes']).replies.at(-1), /email address/)
  assert.match(t(['table for 2 tomorrow at 7pm', 'Ani', 'counter', 'none', 'idk']).replies.at(-1), /confirm/)
})

test('bug: "all of them" when asked which allergy', () => {
  for (const answer of ['all of them', 'all', 'everything', 'all allergies', 'all of the above', 'every allergy']) {
    const { state, replies } = call(['whats safe for any allergies', answer])
    assert.equal(state.booking.dietary?.all, true, `"${answer}" should mean all allergens`)
    assert.match(replies.at(-1), /Oshinko Maki/)
    assert.match(replies.at(-1), /book a table/)
  }
  const b = call(['table for 2 tomorrow at 7pm', 'Ani', 'counter', 'all of them'])
  assert.equal(b.state.booking.dietary.all, true)
  assert.match(b.replies.at(-1), /Oshinko Maki/)
  assert.match(call(['whats safe for any allergies', 'hmm']).replies.at(-1), /which allergy should I check/)
  assert.equal(call(['table for 2 tomorrow at 7pm', 'Ani', 'counter', 'i can eat everything']).state.booking.dietary.none, true)
})

test('bug: caller changes their mind mid-sentence', () => {
  const day = (answer) => call(['book a table', 'four', answer]).state.booking.date
  assert.equal(day('tomorrow or no maybe Monday'), '2026-10-26')
  assert.equal(day('tomorrow, no wait, Monday'), '2026-10-26')
  assert.equal(day('tomorrow actually make it Monday'), '2026-10-26')
  assert.equal(day('not tomorrow, Monday'), '2026-10-26')
  assert.equal(day('monday, sorry I mean tuesday'), '2026-10-27')
  assert.equal(day('tomorrow'), '2026-10-25')

  const t = call(['table for 2 tomorrow at 7pm, no actually 8pm']).state.booking
  assert.equal(t.time, '8:00 PM')
  assert.equal(t.date, '2026-10-25')
  assert.equal(call(['table for 4, actually make it 5 people, tomorrow at 7']).state.booking.guests, 5)
  assert.equal(call(['table for 2 tomorrow at 7', 'Ani', 'counter, no actually the terrace']).state.booking.seating, 'Outdoor Terrace')
})

test('undecided caller is asked to choose', () => {
  let r = call(['book a table', 'four', 'tomorrow or Monday'])
  assert.equal(r.state.booking.date, null)
  assert.match(r.replies.at(-1), /Would you prefer Sunday, October 25 or Monday, October 26\?/)
  r = call(['book a table', 'four', 'tomorrow or Monday', 'Monday'])
  assert.equal(r.state.booking.date, '2026-10-26')

  r = call(['table for 4 or 5 tomorrow at 7'])
  assert.equal(r.state.booking.guests, null)
  assert.match(r.replies.at(-1), /4 guests or 5 guests/)
  r = call(['table for 2 tomorrow at 7 or 8'])
  assert.match(r.replies.at(-1), /7:00 PM or 8:00 PM/)
})

test('normal sentences with commas are not mistaken for corrections', () => {
  const b = call(['Hi, table for 4, tomorrow, at 7pm, sushi counter please']).state.booking
  assert.equal(b.guests, 4)
  assert.equal(b.date, '2026-10-25')
  assert.equal(b.time, '7:00 PM')
  assert.equal(b.seating, 'Sushi Counter')
  assert.equal(call(["Sorry, can I book a table for 3 on Friday at 6?"]).state.booking.guests, 3)
})

test('choosing between options after a date was already set', () => {
  const r = call(['i want to book a table', 'four', 'tomorrow or no maybe Monday', 'tomorrow or monday', 'monday'])
  assert.equal(r.state.booking.date, '2026-10-26')
  assert.match(r.replies.at(-1), /Monday, October 26\. What time/)
})

test('bug: "menu… or you know what, book a table" switches to booking, one question at a time', () => {
  let r = call(['help me with the menu or you know what the book a table'])
  assert.equal(r.state.mode, 'booking')
  assert.match(r.replies.at(-1), /^Sure, let's book a table\. How many guests/)
  r = call(['tell me the menu, actually never mind, I want to book a table for 2 tomorrow at 7'])
  assert.equal(r.state.booking.guests, 2)
  assert.match(r.replies.at(-1), /name/)
  r = call(['tell me about the menu and book a table'])
  assert.match(r.replies.at(-1), /three kinds of sushi.*Now let's book your table\. How many guests/)
  r = call(['what is on the menu'])
  assert.equal((r.replies.at(-1).match(/\?/g) || []).length, 1)
  assert.match(r.replies.at(-1), /Would you like to book a table, or hear which rolls are safe for allergies\?$/)
  r = call(['book a table, actually what are your hours'])
  assert.match(r.replies.at(-1), /12 PM to 9 PM/)
})

test('bug: "3 or 4" guests asks which', () => {
  for (const answer of ['3 or 4', 'three or four', '3 or maybe 4', '3-4', '3 to 4', 'for 3 or 4 people']) {
    const r = call(['book a table', answer])
    assert.equal(r.state.booking.guests, null, `"${answer}" should not pick a number`)
    assert.match(r.replies.at(-1), /Would you prefer 3 guests or 4 guests\?/, answer)
  }
  assert.equal(call(['book a table', '3 or 4', '4']).state.booking.guests, 4)
  assert.equal(call(['book a table', '3, no actually 4']).state.booking.guests, 4)
  assert.equal(call(['table for 3 to 4 people tomorrow at 7']).state.booking.guests, null)
  assert.equal(call(['table for 2 tomorrow at 7']).state.booking.guests, 2)
})

test('bug: 24-hour time and "instead of 12pm 13:00" while asked for a name', () => {
  const base = ['book a table', '2', 'tomorrow', '12pm']
  for (const answer of ['or maybe instead of 12pm 13:00p', 'go or maybe instead of 12pm 13:00pm', 'instead of 12pm, 13:00', 'actually 13:00', 'not 12pm, 1pm', 'rather than 12, 1pm']) {
    const r = call([...base, answer])
    assert.equal(r.state.booking.time, '1:00 PM', answer)
    assert.equal(r.state.booking.name, null, `"${answer}" is not a name`)
    assert.match(r.replies.at(-1), /1:00 PM\. May I have a name/, answer)
  }
  assert.equal(call(['table for 2 tomorrow at 19:30']).state.booking.time, '7:30 PM')
  assert.equal(call(['book a table', '2', 'tomorrow', '18:00']).state.booking.time, '6:00 PM')
  assert.equal(call(['book a table', '2', 'tomorrow', '7p']).state.booking.time, '7:00 PM')
  assert.match(call(['book a table', '2', 'tomorrow', '12pm or 13:00']).replies.at(-1), /12:00 PM or 1:00 PM/)
})
