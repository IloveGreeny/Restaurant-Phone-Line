
const DIRECT = {
  tmrw: 'tomorrow', tmr: 'tomorrow', tmrrw: 'tomorrow', '2morrow': 'tomorrow', '2moro': 'tomorrow', tomoro: 'tomorrow', tomoz: 'tomorrow',
  tonite: 'tonight', '2nite': 'tonight', tday: 'today', tdy: 'today',
  mon: 'monday', tue: 'tuesday', tues: 'tuesday', wed: 'wednesday', thu: 'thursday', thur: 'thursday', thurs: 'thursday',
  fri: 'friday', sat: 'saturday', sun: 'sunday',
  ppl: 'people', pple: 'people', ppls: 'people', pax: 'people',
  pls: 'please', plz: 'please', thx: 'thanks', ty: 'thanks',
  ya: 'yes', yah: 'yes', yea: 'yes', yeh: 'yes', ye: 'yes', yass: 'yes', yess: 'yes', yesss: 'yes', ofc: 'sure', k: 'ok', kk: 'ok',
  nah: 'no', naw: 'no', noo: 'no', nooo: 'no', nop: 'no',
  rez: 'reservation', resy: 'reservation', veggie: 'vegetarian', vego: 'vegetarian',
}

const KEYWORDS = [
  'tomorrow', 'today', 'tonight', 'morning', 'afternoon', 'evening', 'weekend',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirty', 'fifteen', 'forty',
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'twentieth', 'thirtieth',
  'people', 'person', 'persons', 'guests', 'guest', 'adults', 'party', 'table', 'reservation', 'reserve', 'booking',
  'lunch', 'dinner', 'noon', 'midday', 'half', 'past', "o'clock",
  'counter', 'booth', 'private', 'terrace', 'outdoor', 'outside', 'inside', 'indoor', 'patio', 'dining', 'preference', 'anywhere',
  'allergy', 'allergies', 'allergic', 'shellfish', 'shrimp', 'prawns', 'lobster', 'seafood',
  'gluten', 'celiac', 'coeliac', 'dairy', 'lactose', 'sesame',
  'vegetarian', 'vegan', 'diet', 'dietary',
  'menu', 'rolls', 'price', 'prices', 'recommend', 'popular', 'special', 'hours', 'open', 'opening', 'closing', 'close',
  'where', 'address', 'located', 'location', 'directions', 'parking', 'contact', 'phone', 'number', 'email',
  'yes', 'yeah', 'sure', 'correct', 'right', 'perfect', 'great', 'okay', 'confirm', 'absolutely', 'exactly',
  'nope', 'nothing', 'cancel', 'change', 'restart', 'manager', 'human', 'goodbye', 'thanks', 'thank', 'please', 'skip',
  'able', 'also', 'back', 'been', 'book', 'call', 'calling', 'come', 'coming', 'could', 'does', 'done', 'each', 'else',
  'even', 'fine', 'from', 'good', 'have', 'hello', 'here', 'hey', 'just', 'know', 'last', 'like', 'look', 'looking',
  'make', 'many', 'maybe', 'mean', 'more', 'much', 'name', 'need', 'next', 'nice', 'only', 'other', 'over', 'same',
  'should', 'some', 'sorry', 'still', 'than', 'that', 'them', 'then', 'there', 'they', 'thing', 'think', 'this',
  'time', 'want', 'week', 'well', 'what', 'when', 'which', 'will', 'wife', 'husband', 'friend', 'friends', 'with',
  'would', 'your', 'about', 'around', 'after', 'before', 'again', 'family', 'kids', 'child', 'children', 'birthday',
  'none', 'nobody', 'noone', 'anyone', 'everyone', 'someone', 'everything', 'anything', 'food', 'fish', 'milk', 'nuts',
  'peanut', 'peanuts', 'soy', 'wait', 'true', 'yeah', 'yep', 'yup', 'cool', 'any', 'ask', 'nine', 'note', 'notes',
  'didn', 'dont', "don't", "doesn't", "can't", 'cant', "won't", 'wont', 'isn', 'aren', 'here', 'hers', 'him', 'his',
  'mine', 'ours', 'their', 'these', 'those', 'very', 'really', 'quite', 'sounds', 'later', 'earlier', 'early', 'late',
]
const KNOWN = new Set(KEYWORDS)

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

export function fixWord(word) {
  if (DIRECT[word]) return DIRECT[word]
  if (word.length < 4 || KNOWN.has(word) || /[\d@.:']/.test(word)) return word
  const maxDist = word.length <= 5 ? 1 : word.length <= 8 ? 2 : 3
  let best = null
  let bestDist = Infinity
  for (const k of KEYWORDS) {
    if (k[0] !== word[0] || Math.abs(k.length - word.length) > maxDist) continue
    const dist = distance(word, k)
    if (dist < bestDist) { best = k; bestDist = dist }
  }
  return bestDist <= maxDist ? best : word
}

export function fixSpelling(text) {
  return text
    .split(' ')
    .map((w) => (w ? fixWord(w) : w))
    .join(' ')
}
