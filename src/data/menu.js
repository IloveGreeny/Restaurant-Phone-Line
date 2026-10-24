export const allergenLabels = {
  fish: 'fish',
  shellfish: 'shellfish',
  gluten: 'gluten',
  dairy: 'dairy',
  egg: 'egg',
  sesame: 'sesame',
  soy: 'soy',
}

export const menu = [
  { name: 'Tekka Maki', group: 'Maki', image: 'tekka-maki.webp', desc: 'Fresh Tuna · 6 pcs', price: 9.5, allergens: ['fish'] },
  { name: 'Oshinko Maki', group: 'Maki', image: 'oshinko-maki.webp', desc: 'Pickled Radish · 6 pcs', price: 6.5, allergens: [] },
  { name: 'Sake Maki', group: 'Maki', image: 'sake-maki.webp', desc: 'Atlantic Salmon · 6 pcs', price: 8.5, allergens: ['fish'] },
  { name: 'Hamachi Maki', group: 'Maki', image: 'hamachi-maki.webp', desc: 'Yellowtail · 6 pcs', price: 10, allergens: ['fish'] },
  { name: 'Salmon Tobiko Roll', group: 'Uramaki', image: 'salmon-tobiko-uramaki.webp', desc: 'Salmon, Avocado & Tobiko', price: 14.5, allergens: ['fish', 'sesame'] },
  { name: 'Rainbow Roll', group: 'Uramaki', image: 'rainbow-roll-uramaki.webp', desc: 'Assorted Fresh Fish & Avocado', price: 16.5, allergens: ['fish', 'shellfish', 'sesame'] },
  { name: 'Mango Fusion Roll', group: 'Uramaki', image: 'mango-fusion-uramaki.webp', desc: 'Tempura & Sweet Mango Glaze', price: 15, allergens: ['shellfish', 'gluten', 'egg'] },
  { name: 'Double Salmon Roll', group: 'Uramaki', image: 'double-salmon-uramaki.webp', desc: 'Fresh Salmon & Avocado', price: 15.5, allergens: ['fish', 'sesame'] },
  { name: 'Teriyaki Cream Roll', group: 'Special Rolls', image: 'teriyaki-cream-roll.webp', desc: 'Grilled Salmon & Cream Cheese', price: 16.5, allergens: ['fish', 'dairy', 'soy', 'gluten'] },
  { name: 'Crispy Volcano Roll', group: 'Special Rolls', image: 'crispy-volcano-roll.webp', desc: 'Tempura Crunch & Spicy Tobiko', price: 17.5, allergens: ['fish', 'gluten', 'egg'] },
  { name: 'Green Garden Roll', group: 'Special Rolls', image: 'green-dragon-roll.webp', desc: 'Prawn Tempura & Fresh Greens', price: 16, allergens: ['shellfish', 'gluten', 'egg'] },
  { name: 'Black Pearl Roll', group: 'Special Rolls', image: 'black-rice-roll.webp', desc: 'Black Rice, Prawn & Glaze', price: 18, allergens: ['shellfish', 'soy', 'gluten'] },
]
