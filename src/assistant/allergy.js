import { menu, allergenLabels } from '../data/menu.js'
import { normalize } from './parsers.js'

const KEYWORDS = [
  { tag: 'shellfish', re: /\b(shellfish|shell fish|shrimp|prawns?|crab|lobster|crustaceans?)\b/ },
  { tag: 'fish', re: /\b(fish|salmon|tuna|seafood|sea food)\b/ },
  { tag: 'gluten', re: /\b(gluten|wheat|celiac|coeliac|tempura)\b/ },
  { tag: 'dairy', re: /\b(dairy|milk|lactose|cheese|cream)\b/ },
  { tag: 'egg', re: /\b(eggs?)\b/ },
  { tag: 'sesame', re: /\b(sesame)\b/ },
  { tag: 'soy', re: /\b(soy|soya|soybeans?)\b/ },
]

const ALL_PHRASES = /\b(all (the |of the |common )?(allergies|allergens)|every (allergy|allergen)|all of your allergens|everything on the list)\b/
const ALL_SHORT = /\b(all of them|all of those|all of the above|all|everything|every one|each of them|any of them|them all)\b/

export function parseDietary(text, { allowAll = false } = {}) {
  const t = normalize(text)
  if (/\b(eat everything|eat anything|can eat everything|can eat anything|no allergies at all)\b/.test(t)) {
    return { allergens: [], diet: null, none: true }
  }
  const allergens = new Set()
  let diet = null
  if (/\b(vegan|plant based|plant-based)\b/.test(t)) diet = 'vegan'
  else if (/\b(vegetarian|veggie|no meat|don't eat meat)\b/.test(t)) diet = 'vegetarian'

  for (const { tag, re } of KEYWORDS) if (re.test(t)) allergens.add(tag)
  if (/\bseafood|sea food\b/.test(t)) allergens.add('shellfish')
  if (diet) { allergens.add('fish'); allergens.add('shellfish') }
  if (diet === 'vegan') { allergens.add('dairy'); allergens.add('egg') }

  if (allergens.size || diet) return { allergens: [...allergens], diet, none: false }
  if (ALL_PHRASES.test(t) || (allowAll && ALL_SHORT.test(t) && !/\b(that's all|thats all|all good|all set)\b/.test(t))) {
    return { allergens: Object.keys(allergenLabels), diet: null, none: false, all: true }
  }
  if (/\b(no|none|nothing|nope|no allergies|not really|all good|we're fine|we are fine|eat everything|anything)\b/.test(t)) {
    return { allergens: [], diet: null, none: true }
  }
  return null
}

export function safeItems(allergens = []) {
  return menu.filter((item) => !item.allergens.some((a) => allergens.includes(a)))
}

export function unsafeItems(allergens = []) {
  return menu.filter((item) => item.allergens.some((a) => allergens.includes(a)))
}

export function describeDietary({ allergens = [], diet = null, all = false }) {
  if (all) return 'all common allergens'
  if (diet) {
    const extra = allergens.filter((a) => !['fish', 'shellfish', ...(diet === 'vegan' ? ['dairy', 'egg'] : [])].includes(a))
    return extra.length ? `${diet}, no ${listJoin(extra)}` : diet
  }
  return allergens.length ? `no ${listJoin(allergens)}` : 'no allergies'
}

export function listJoin(arr, word = 'or') {
  if (arr.length <= 1) return arr.join('')
  return `${arr.slice(0, -1).join(', ')} ${word} ${arr[arr.length - 1]}`
}

export function adviceSentence(dietary) {
  const safe = safeItems(dietary.allergens)
  if (dietary.all) {
    const list = listJoin(Object.values(allergenLabels), 'and')
    if (!safe.length) return `Avoiding all the common allergens on our list, ${list}, none of our standard rolls are safe. I'll flag it so the chef can prepare something special.`
    return `Avoiding all the common allergens on our list, ${list}, the safe ${safe.length === 1 ? 'choice is' : 'choices are'} ${listJoin(safe.map((i) => i.name), 'and')}. I'll flag this for the kitchen so they take extra care.`
  }
  const label = dietary.diet ? `a ${describeDietary(dietary)} diet` : describeDietary(dietary)
  const lead = dietary.diet ? `For ${label}` : `With ${label}`
  if (!safe.length) {
    return `${lead}, I'm afraid none of our standard rolls are a safe match. I'll flag it so the chef can prepare something special for you.`
  }
  const names = safe.slice(0, 4).map((i) => i.name)
  const more = safe.length > 4 ? `, plus ${safe.length - 4} more` : ''
  return `${lead}, safe choices on our menu are ${listJoin(names, 'and')}${more}. I'll flag this for the kitchen so they take extra care.`
}
