/**
 * Which picture and tint family each category wears on the Book's rows
 * (components/CategorySign.jsx draws them). Plain JS so the category check can
 * import it: every entry in CATEGORIES must have one (scripts/test-categories.mjs).
 */
// [picture, tint family] — keyed by the frozen English value (CATEGORIES).
export const SIGN = {
  'Eating out': ['fork', 'sand'], Groceries: ['cart', 'sand'], Gifts: ['gift', 'sand'],
  'Personal expenses': ['person', 'sand'], fara7: ['sparkle', 'sand'],
  Internet: ['wifi', 'home'], Telephone: ['phone', 'home'], 'Elect. Recharge': ['bolt', 'home'],
  'Water. Recharge': ['drop', 'home'], Utilities: ['doc', 'home'], Villa: ['house', 'home'],
  Rent: ['key', 'home'], 'omara2 al behar': ['tower', 'home'], Gas: ['flame', 'home'], 'Taxes and fines': ['doc', 'home'],
  Car: ['car', 'out'], Transportation: ['bus', 'out'], Vacations: ['plane', 'out'],
  'Madinety club': ['flag', 'out'], 'Shams club': ['flag', 'out'], 'Officers club': ['flag', 'out'],
  Leisure: ['sun', 'out'], Sports: ['ball', 'out'], Hobbies: ['brush', 'out'],
  Medical: ['cross', 'care'], Donations: ['heart', 'care'],
  'InstaPay - Services': ['swap', 'care'], 'InstaPay - Purchases': ['swap', 'care'],
  'Science Pitchers': ['people', 'care'], HYS: ['people', 'care'], Team: ['people', 'care'],
};

/** The [picture, family] for a category, or null when none is drawn. */
export const signFor = (category) => SIGN[String(category || '').trim()] || null;
