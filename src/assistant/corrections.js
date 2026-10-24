
const CORRECTION = "you know what|never mind|nevermind|forget it|forget that|no|nope|nah|actually|wait|i mean|sorry|rather|instead|make it|make that|change it to|change that to|let's say|lets say|let's do|lets do|scratch that|on second thought|better"
const CHOICE = 'or|either|maybe|perhaps'
const NEGATION = 'instead of|rather than|not|except|anything but'

const SPLIT = new RegExp(`(?:^|\\b)(${NEGATION}|${CORRECTION}|${CHOICE})\\b|(,|;| - )`, 'i')

export function segments(text) {
  const spaced = String(text).replace(/(\d(?::\d{2})?\s*(?:am|pm|p\.m\.|a\.m\.)?)\s+(?=\d{1,2}(?::\d{2}|\s*(?:am|pm|p\.m\.|a\.m\.|p\b)))/gi, '$1, ')
  const parts = spaced.split(SPLIT)
  const segs = [{ marker: null, text: parts[0] ?? '' }]
  for (let i = 1; i < parts.length; i += 3) {
    const marker = (parts[i] ?? parts[i + 1] ?? '').toLowerCase().trim() || ','
    segs.push({ marker, text: parts[i + 2] ?? '' })
  }
  return segs
}

export const isCorrection = (m) => m && new RegExp(`^(${CORRECTION})$`, 'i').test(m)
const isNegation = (m) => m && new RegExp(`^(${NEGATION})$`, 'i').test(m)

export function pickValue(text, parse, key = (v) => JSON.stringify(v)) {
  const segs = segments(text)
  if (segs.length === 1) return { value: parse(text, { later: false }) }

  const found = []
  const rejected = new Set()
  let corrected = false
  segs.forEach((s, i) => {
    const v = parse(s.text, { later: found.length > 0, prev: i > 0 ? segs[i - 1].text : '' })
    if (v == null) {
      if (isCorrection(s.marker) && found.length) corrected = true
      return
    }
    if (isNegation(s.marker)) { rejected.add(key(v)); return }
    if (isCorrection(s.marker) && found.length) corrected = true
    found.push(v)
  })

  const unique = []
  for (const v of found) if (!rejected.has(key(v)) && !unique.some((u) => key(u) === key(v))) unique.push(v)

  if (unique.length === 0) {
    const whole = parse(text, { later: false })
    return { value: whole != null && !rejected.has(key(whole)) ? whole : null }
  }
  if (unique.length === 1) return { value: unique[0] }
  if (corrected) return { value: unique[unique.length - 1] }
  return { options: unique }
}

export function isBareNumber(seg) {
  return /^\s*(about |around |like )?(\d{1,2}(:\d{2})?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)( ?(pm|am|p\.m\.|a\.m\.|people|guests|persons|of us))?\s*[.!?]?\s*$/i.test(seg)
}

const NUM = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
export function endsWithGuests(prev) {
  return new RegExp(`\\b(?:for|of) ${NUM}\\s*$|\\b${NUM} (?:people|guests|persons)\\s*$`, 'i').test(prev)
}
export function endsWithTime(prev) {
  return new RegExp(`(?:\\b(?:at|around|about|by) ${NUM}(?::\\d{2})?(?: ?(?:am|pm|p\\.m\\.|a\\.m\\.))?|\\d(?::\\d{2})? ?(?:am|pm|p\\.m\\.|a\\.m\\.))\\s*$`, 'i').test(prev)
}
export function leadingCount(seg) {
  const m = seg.match(new RegExp(`^\\s*${NUM}\\b(?!\\s*(?::|am|pm|p\\.m|a\\.m|o'clock))`, 'i'))
  return m ? m[1] : null
}
