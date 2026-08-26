import { DIR } from './i18n/strings.js';

/**
 * PALETTE — "Morning Harbor" (مينا الصبح). Owner's direction, 2026-08-03.
 *
 * Replaces "Nile ledger" (deep green / sand paper / brass), which is retired —
 * it lives in git history and nowhere else.
 *
 * LIGHT ONLY, DELIBERATELY. There is no dark variant and none is planned: this
 * is a senior-first day app used in Cairo daylight by one 70-year-old man, and a
 * second theme would double the surface every honest-render and contrast check
 * has to cover in exchange for a mode he has never asked for.
 *
 * Every value below is either canonical (given by the Owner) or DERIVED and
 * marked as such. The canonical set does not assign colours to a few roles the
 * app has — method chips and the three metric series — so those are composed
 * from canonical tokens rather than invented, and flagged for confirmation.
 *
 * Contrast is not a matter of opinion here: `scripts/test-contrast.mjs` measures
 * every pair this file is used in and fails the build if one drops below its
 * WCAG floor. Change a value, run `npm run check:contrast`.
 */
export const C = {
  // ——— canonical: ground and surfaces
  shell: '#FAF7F1',     // the page
  mist: '#DCE9F0',      // secondary surface / the morning sky
  card: '#FFFFFF',
  /**
   * `line` — quiet fills, and BORDERS THAT MEAN SOMETHING.
   *
   * North Star §3, Phase A: plain cards lost their border; the shell→card
   * luminance step carries elevation on its own. What still takes a `line`
   * border does so because the border is doing WORK:
   *   · CONTROLS — buttons, chips, the textarea, the period segmented control.
   *     A tappable thing with no edge stops looking tappable, and §3 says
   *     «plain cards», not «all borders». Removing these would buy calm by
   *     spending affordance, which the five-second capture law will not pay.
   *   · ADVISORY surfaces — the sand banners (offline, outbox, truncation, the
   *     foreign-money notes). §3 keeps conflict/settled/advisory bordered by
   *     name.
   *   · MEDIA edges — a 40×40 thumbnail needs a boundary against a white card.
   * A plain content card taking this border again is the drift to catch.
   */
  line: '#E3DDCE',

  // ——— canonical: ink
  ink: '#2C4356',       // body text
  muted: '#5C6871',     // secondary text — see the contrast table for its floor

  // ——— canonical: primary
  harbor: '#3E7CA6',    // active tabs, primary buttons, chart stroke, suggested category

  // ——— canonical: tertiary
  sand: '#E7D9BE',      // chips, and the calm advisory surfaces (offline, outbox)

  /**
   * canonical: THE one warm action. Reserved for the cash keypad's submit
   * button and nothing else — the whole point of a single warm accent is that
   * it means one thing. If it appears twice it means nothing.
   */
  amber: '#D9A441',
  amberInk: '#3d2f0d',  // the only text colour that goes on amber
  /**
   * THE RIM ON THE ONE WARM ACTION, and why the fill was not simply darkened.
   *
   * `amber` at 2.10:1 against `shell` fails WCAG 1.4.11 — not because the LABEL
   * is hard to read (it is 5.80:1 and fine) but because the button's own EDGE
   * dissolves into a cream page, so the control has no visible boundary.
   *
   * The measured minimal fix was `amber → #B48836`, which passes (3.01:1, and
   * the label still clears at 4.04:1 — checked, because the suggestion never
   * said so). It was NOT taken: `#D9A441` is D15's "dawn amber", ruled by the
   * Owner as the single warm action and carried by the icon. A contrast finding
   * about an EDGE is not a licence to restate a colour the Owner chose.
   *
   * So the edge gets its own token and the fill keeps its ruling. Boundary
   * contrast is what 1.4.11 actually asks for.
   */
  amberRim: '#A87F2E',  // 3.42:1 on shell — the CTA's boundary, never its fill

  // ——— canonical: the two settled/unsettled card states (WS3-C)
  conflictInk: '#A05446',
  conflictBg: '#FDF1EE',
  conflictLine: '#ECCDC5',
  settledInk: '#4C7950',
  settledBg: '#EEF4EE',
  settledLine: '#D5E4D3',

  onDark: '#FFFFFF',    // text on harbor / ink / muted fills
};

/**
 * ═══ ANTI-DRIFT — role casting, not decoration (north-star §3; vis-F2) ═══
 *
 * NO NEW HUES. Every role the reference design plays with a colour, this
 * palette plays with one it already has:
 *   · harbor plays Gentler-green — data, navigation, selection;
 *   · amber plays Gentler-orange-Add — the commit, nothing else;
 *   · muted @ PREV_SERIES_OPACITY plays the previous series;
 *   · line plays the gridlines.
 * A screen that seems to need a fifth hue needs a new USE of these four. The
 * drift this comment exists to stop arrives as a reasonable-sounding hex in a
 * diff — teal for a new chart series, green for success — and each one breaks
 * the contrast suite's closed world and the one-warm-action law at once.
 */

/**
 * DERIVED, not canonical — flagged for the Owner.
 *
 * The palette assigns no colour to the payment methods or to the three metric
 * series, and those need to stay apart from each other at a glance. They are
 * composed from canonical tokens only:
 *
 *   Visa → harbor      the card is the primary path; it is the primary colour
 *   Cash → muted       NOT amber: amber means "the cash button", exactly once
 *   all  → ink
 *
 * The prev-period series stays canonical `muted` at 45% so it reads as quiet
 * without becoming a fourth hue — `line` alone is invisible as a 2.5px stroke.
 */
export const METHOD = {
  Visa: { fg: C.ink, bg: C.mist },
  Cash: { fg: C.ink, bg: C.sand },
};

export const PREV_SERIES_OPACITY = 0.45;

/**
 * Display face: numerals and month names. System serif — no webfont request, so
 * nothing blocks first paint on Cairo mobile data. (This retires the self-hosted
 * Fraunces subset; its @font-face and .woff2 went with it.)
 *
 * Arabic has no serif here and never did: these stacks are Latin-only and Arabic
 * falls through to the system face, which is both zero-payload and more legible
 * at his sizes.
 */
export const FONT_DISPLAY = '"Baskerville","Hoefler Text",Palatino,Georgia,serif';
export const FONT_UI =
  "-apple-system, BlinkMacSystemFont, 'SF Arabic', 'Geeza Pro', system-ui, 'Segoe UI', sans-serif";

/**
 * Amounts line up column-to-column only if the digits are the same width. On a
 * proportional serif "111" is visibly narrower than "888", which makes a column
 * of figures look ragged and, worse, makes two amounts hard to compare by eye.
 */
export const NUMERALS = { fontVariantNumeric: 'tabular-nums' };

/** The Today screen's morning crown — that view only. */
export const MORNING_CROWN = `linear-gradient(180deg, ${C.mist} 0%, ${C.shell} 30%)`;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE NORTH STAR VOCABULARY (docs/design/north-star.md §3, ratified 2026-08-25)
 *
 * Phase A introduces ONE vocabulary per dimension — radius, type, spacing,
 * motion. Before this the app carried 33 distinct font sizes between 10 and 52
 * and 12 distinct radii — measured, not estimated, across 281 sites.
 *
 * ——— WHAT THESE VOCABULARIES DO **NOT** GOVERN, stated here because the survey
 * that produced them found 100 of those 281 sites are not type at all.
 *
 * A `fontSize` is not automatically typography. `<div style={{fontSize: 52}}>🧾</div>`
 * is a PICTURE sized in pixels; so is a 34px ⌛, a 21px tab icon, a 32px ﹢ in a
 * 48px circle, and an SVG axis label whose units are viewBox user-space rather
 * than CSS pixels. Mapping any of them onto a reading scale is a category error:
 * it would resize every empty-state illustration in the app to the size of a
 * headline, and it would do it in a single find-and-replace that looked tidy.
 *
 * Likewise a `borderRadius` is not automatically a surface. A 3.5px-wide bar
 * cap, an 8×8 legend swatch and a 40×40 thumbnail are GEOMETRY: all three
 * surface radii exceed half their width and would clamp them to circles.
 *
 * So the rule is a POSITIVE DECLARATION rather than an omission:
 *   · text  → a TYPE token, always;
 *   · pictures, icons, chart geometry and fixed-size media → `GLYPH`/`ICON`
 *     below, or a raw px carrying an explicit `geometry` note — declared, never
 *     merely surviving, so the next pass reads them as decided rather than as
 *     stragglers it should tidy.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Four surface radii, audited (§3) + ruling 4. Controls and geometry are NOT
 * surfaces. `inset` is the small INNER surface — a swatch-sized panel sitting
 * on a card, never the card itself.
 *
 * ═══ GEOMETRY EXEMPTION (ruling 4 — cite it by this name at the site) ═══
 * Furniture whose radius is bounded by its own dimensions — bar caps,
 * hairlines, thumbnails, ~30px controls — states its radius inline WITH A
 * COMMENT NAMING THIS EXEMPTION. Mapping such a site onto a surface token
 * clamps it to a circle, and a checkbox that becomes a circle is an
 * AFFORDANCE change, not a style. An inline radius without the named comment
 * is the drift A3's audit exists to catch.
 */
// `sheet: 24` — Planner ruling 2026-08-26 for B4: an advisory sheet slides in
// OVER the page, so its lip sits one step softer than the card it covers.
export const RADIUS = { card: 20, row: 16, capsule: 999, inset: 8, sheet: 24 };

/**
 * Eight reading sizes (§3 + rulings 1–2). Line-height ≥ 1.3 governs PROSE —
 * `section`, `row`, `body`, `label`. `hero` and `display` are single figures
 * with no inter-line reading; their leading binds a wrapped amount into one
 * object and runs ~1.05, which is how they are already set. (Flagged at three
 * sites where a mechanical 1.3 would have added ~10px of dead space above and
 * below the one number the Today screen exists to show.)
 *
 * `action` (ruling 1) — a NAMED ROLE, not a compositional rule. «primary =
 * row + weight + fill» is three facts that must co-occur at every future
 * site; a token is one fact. The Inbox one-tap guess — the most-used tap in
 * the app — stays ≥ 19: senior-first is not negotiable downward.
 *
 * `caption` (ruling 2) — the ONE size below the `label` prose floor, legal
 * ONLY for annotations that DUPLICATE information available elsewhere
 * («auto», unit suffixes, chip years, row meta, badge counts). Nothing may be
 * readable ONLY at 13. If a badge pill overflows at 13, the pill grows — the
 * type does not shrink; come back with evidence if geometry genuinely breaks.
 */
export const TYPE = {
  hero: 40, display: 34, section: 22, action: 19, row: 17, body: 16, label: 15,
  caption: 13,
};

/**
 * Four spacing roles (§3 — never-assigned before A1, assigned here). `gutter`
 * is the screen's side margin, `gap` the space between siblings, `cardPad` a
 * card's own inset, `section` the breath between one titled group and the
 * next. This is the WHOLE spacing grammar: a margin chosen per-screen is how
 * the New screen got «all very cramped» (GAP 1) — each site locally
 * reasonable, no two of them in agreement.
 */
export const SPACE = { gutter: 20, gap: 12, cardPad: 16, section: 32 };

/**
 * Four durations and two easings (§3). `tap` acknowledges, `move` relocates
 * within a screen, `page` swaps a screen, `draw` is the chart drawing itself
 * ONCE per mount — a redraw on data refresh is theatre, and theatre is
 * banned. What this file cannot enforce and every consumer owes: the
 * `prefers-reduced-motion` floor (B2's media guard). A duration here is a
 * ceiling, never a promise to animate.
 */
export const MOTION = {
  tap: 120, move: 260, page: 320, draw: 700,
  easeOut: 'cubic-bezier(0.2,0,0,1)',
  easeSettle: 'cubic-bezier(0.22,1,0.36,1)',
};

/**
 * NOT TYPE — pictures and icons, sized as geometry. Named so that "this is not
 * a TYPE token" is something the code SAYS rather than something a reader has
 * to infer from the absence of one.
 */
export const GLYPH = { illustration: 46, spot: 34 };
export const ICON = { nav: 21, primary: 32, control: 17 };

/**
 * THE SENIOR FLOORS — one family, three members (CLAUDE.md: large type, big
 * touch targets). `TAP` is the touch floor the way `TYPE.label` is the prose
 * floor and `unitSize`'s clamp below is the unit floor: each one is the same
 * law — nothing he must read or hit may shrink below what a 70-year-old can
 * read or hit — expressed in that member's own dimension.
 */
export const TAP = 48;

/**
 * The unit beside a value runs at 0.55× the value's size (§3), floored at
 * `TYPE.label` (ruling 5). A 12px unit in front of a 70-year-old is the ratio
 * defeating the scale; the floor is senior-first law expressed as arithmetic.
 * The floor binds to `TYPE.label` BY REFERENCE so it cannot detach from the
 * prose floor if that floor ever moves.
 */
export const UNIT_RATIO = 0.55;
export const unitSize = (valuePx) => Math.max(TYPE.label, Math.round(valuePx * UNIT_RATIO));

/**
 * The section divider: `·— ———` in Morse, which is A O.
 *
 * The same two letters the icon carries structurally — the frame reads A, the
 * sun reads O — so the mark and the divider say the same thing in two
 * registers, and neither of them says it with a letterform.
 *
 * A BACKGROUND IMAGE, NOT TEXT, and that is the whole point rather than an
 * implementation detail: as text these beads would be read aloud by VoiceOver as
 * a string of punctuation before every section heading. A background is
 * decorative by construction, so assistive technology skips it and the heading
 * he actually needs is the first thing announced.
 *
 * Built from `C.harbor` here rather than hard-coded so the divider cannot
 * survive a palette change that leaves it stranded in an old blue. It sits
 * BELOW the vocabulary because it consumes it — `const` bindings put anything
 * above SPACE outside SPACE's reach.
 */
const MORSE_BEADS = (colour) => {
  /**
   * The colour goes in RAW. Encoding it here as well as in the whole-document
   * pass below double-escapes the `#` into `%2523`, which is not a colour — the
   * browser drops the fill and paints the beads BLACK, on a page that has no
   * black in it. Caught by the assertion in test-inbox.mjs, not by looking.
   */
  const c = colour;
  const dash = (x) => `<rect x='${x}' y='1' width='9' height='2' rx='1' fill='${c}'/>`;
  return 'url("data:image/svg+xml,'
    + encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 4' width='56' height='4'>`
      + `<circle cx='2' cy='2' r='1.4' fill='${c}'/>`
      + dash(6) + dash(21) + dash(33) + dash(45)
      + `</svg>`,
    ).replace(/'/g, '%27')
    + '")';
};

export const DIVIDER = {
  backgroundImage: MORSE_BEADS(C.harbor),
  backgroundRepeat: 'no-repeat',
  /**
   * The beads sit at the INLINE START — the right edge in Arabic, the left in
   * English. `background-position` has no logical keyword, so the physical one
   * is chosen from the active locale.
   *
   * The first version hardcoded `bottom right`, which is correct in RTL and
   * hangs the divider off the end of the line in LTR. Caught by looking at the
   * English screen, which is the argument for having looked.
   */
  backgroundPosition: DIR === 'rtl' ? 'bottom right' : 'bottom left',
  backgroundSize: '56px 4px',
  // The clearance under the beads IS the sibling gap — a divider that clears
  // more than a sibling would claim a hierarchy the layout does not have.
  paddingBottom: SPACE.gap,
  opacity: 0.9,
};
