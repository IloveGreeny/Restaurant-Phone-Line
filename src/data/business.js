export const business = {
  name: 'Qitchen',
  assistantName: 'Restaurant Phone Line',
  tagline: 'Sushi worth fishing for.',
  address: '123 Roastery Lane, Portland',
  phone: '+1 (555) 234-5678',
  email: 'hello@qitchen.example',
  hoursText: 'every day, Monday to Sunday, from 12 PM to 9 PM. Our last seating is at 8:30 PM.',
  closedWeekdays: [],
  maxGuests: 6,
}

function makeSlots(fromMinutes, toMinutes) {
  const slots = []
  for (let m = fromMinutes; m <= toMinutes; m += 30) {
    let h = Math.floor(m / 60)
    const min = String(m % 60).padStart(2, '0')
    const ap = h >= 12 ? 'PM' : 'AM'
    if (h > 12) h -= 12
    slots.push(`${h}:${min} ${ap}`)
  }
  return slots
}

export const allSlots = makeSlots(12 * 60, 20 * 60 + 30)
export const lunchSlots = makeSlots(12 * 60, 14 * 60 + 30)
export const dinnerSlots = makeSlots(17 * 60, 20 * 60 + 30)

export const seatingOptions = ['Main Dining Room', 'Sushi Counter', 'Private Booth', 'Outdoor Terrace']
