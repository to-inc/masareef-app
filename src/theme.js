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
 * survive a palette change that leaves it stranded in an old blue.
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
  paddingBottom: 12,
  opacity: 0.9,
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE NORTH STAR VOCABULARY (docs/design/north-star.md §3, ratified 2026-08-25)
 *
 * Phase A introduces ONE radius vocabulary and ONE type vocabulary. Before this
 * the app carried 33 distinct font sizes between 10 and 52 and 12 distinct
 * radii — measured, not estimated, across 281 sites.
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

/** Three surface radii, audited (§3). Controls and geometry are NOT surfaces. */
export const RADIUS = { card: 20, row: 16, capsule: 999 };

/**
 * Six reading sizes (§3). Line-height ≥ 1.3 governs PROSE — `section`, `row`,
 * `body`, `label`. `hero` and `display` are single figures with no inter-line
 * reading; their leading binds a wrapped amount into one object and runs ~1.05,
 * which is how they are already set. (Flagged at three sites where a mechanical
 * 1.3 would have added ~10px of dead space above and below the one number the
 * Today screen exists to show.)
 */
export const TYPE = { hero: 40, display: 34, section: 22, row: 17, body: 16, label: 15 };

/**
 * NOT TYPE — pictures and icons, sized as geometry. Named so that "this is not
 * a TYPE token" is something the code SAYS rather than something a reader has
 * to infer from the absence of one.
 */
export const GLYPH = { illustration: 46, spot: 34 };
export const ICON = { nav: 21, primary: 32, control: 17 };

// Senior-friendly floor. CLAUDE.md: large type, big touch targets.
export const TAP = 48;
