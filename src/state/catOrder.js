import { CATEGORIES } from '../lib/constants.js';

/**
 * THE ORDER OF EVERY CATEGORY GRID (Tarek, 2026-10-10: «reorganise the categories
 * with two sorts — how often it has been used + categorical proximity»).
 *
 *   1. His most-USED six lead (rows per category this year + last, the server's
 *      `year.catUse`). Those six are also the collapsed short list.
 *   2. Everything else follows by KIN, so related labels sit side by side.
 *
 * Dad's book is not touched: CONSTANTS' «append, never insert» law protects the
 * one-tap row he has learned, so the shell only hands `use` in on a book kept in
 * another unit. With no `use` the grids keep CATEGORIES exactly as before.
 */
const KIN = [
  'Eating out', 'Groceries',                                                   // food
  'Villa', 'Rent', 'omara2 al behar', 'Utilities', 'Elect. Recharge',
  'Water. Recharge', 'Gas', 'Internet', 'Telephone',                           // home & bills
  'Car', 'Transportation',                                                     // getting around
  'Medical', 'Personal expenses', 'Sports',                                    // health & self
  'Leisure', 'Hobbies', 'Vacations', 'Madinety club', 'Shams club', 'Officers club', // leisure & clubs
  'Gifts', 'Donations', 'fara7',                                               // giving
  'InstaPay - Services', 'InstaPay - Purchases', 'Taxes and fines',            // payments
  'Science Pitchers', 'HYS', 'Team',                                           // work
];
const LEAD = 6;

export function orderCategories(use) {
  if (!use) return CATEGORIES;
  // The sheet stores some labels with a stray space ('Elect. Recharge '); the
  // grids use trimmed forms, so the counts are keyed the same way (audit).
  const raw = use;
  use = {};
  for (const [k, v] of Object.entries(raw)) use[k.trim()] = (use[k.trim()] || 0) + v;
  const kin = KIN.filter((c) => CATEGORIES.includes(c))
    .concat(CATEGORIES.filter((c) => !KIN.includes(c)));            // a label added later still shows
  const lead = kin.filter((c) => use[c] > 0)
    .sort((a, b) => use[b] - use[a] || kin.indexOf(a) - kin.indexOf(b))
    .slice(0, LEAD);
  return lead.concat(kin.filter((c) => !lead.includes(c)));
}

let current = CATEGORIES;
/** Called by the shell whenever a summary arrives. */
export function setCategoryUse(use) { current = orderCategories(use); }
export const allCategories = () => current;
export const shortCategories = () => current.slice(0, LEAD);
