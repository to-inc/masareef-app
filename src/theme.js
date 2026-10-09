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

  /**
   * canonical: HARBOR WHEN IT IS TEXT (glass audit Tier 1, A7).
   *
   * `harbor` has almost no headroom as ink. Measured on this app's own
   * surfaces: 4.53:1 on `card`, 4.23:1 on `shell`, 3.25:1 on `sand`. Only the
   * first clears the 4.5 floor, and it clears it by 0.6% — so every harbor
   * label on the shell background has been failing, quietly, at every size
   * below the 18.66px-bold large-text line. The contrast suite did not catch
   * it because it measures harbor on `card` (which passes) and rules harbor on
   * `shell` canonical at 23px bold (where the floor is 3:1 and it passes too).
   *
   * `#34688C` is not a new hue: it is the END STOP of the harbor gradient the
   * owner already ratified (HANDOFF:13, `#4E8CB4→#34688C`). It measures 5.99 /
   * 5.60 / 4.30 on the same three surfaces, still reads as harbor, and so
   * keeps the link affordance the colour exists to carry.
   *
   * `harbor` itself is UNCHANGED and stays the fill, stroke, tint, border and
   * chart colour — including the C2 derivation, whose negative control in
   * test-contrast.mjs asserts that harbor FAILS 4.5:1 on the worst-case bar.
   * Editing the token rather than its text uses would have flipped that
   * control and forced a re-derivation of the C2 ink override.
   */
  harborInk: '#34688C',
  /** R1 (OWNER-RULINGS, 2026-09-20): `#34688C` ratified as a canonical token in its own
   *  right — the gradient's END stop. Same value as harborInk, a different role. */
  harborDeep: '#34688C',

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
// MORNING_CROWN retired 2026-08-28 — GROUND.dawn is the same idea built from
// palette hues instead of one linear ramp, and it has the crown to match.

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
/**
 * ⚠️ THE SCALE MOVED WITH THE GLASS REDESIGN (Owner-approved, 2026-08-28):
 * `card` 20→26 and `row` 16→20, which are the design file's «Card — 26r» and
 * «Row — 20r» tiers. `sheet: 24` already equalled the advisory radius and did
 * not move; `capsule` and `inset` are untouched.
 *
 * This is a RULING, not a tidy-up, and it is recorded as one: A3.V pins this
 * line verbatim precisely so the scale cannot drift without somebody deciding
 * to move it, and the pin was updated in the same edit. Every existing
 * consumer (14 card sites, 50 row sites) inherits the new tier by name, which
 * is what «restyle the app to the glass system» has to mean if the vocabulary
 * is doing any work at all.
 */
export const RADIUS = { card: 26, row: 20, capsule: 999, inset: 8, sheet: 24, glassWell: 18, sheetTall: 34 }; // glassWell: R11 · sheetTall: v4 P4

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
  hero: 40, heroBook: 58, amountEntry: 68, amountReview: 48, display: 34, key: 26, title: 24, section: 22, action: 19, row: 17, body: 16, label: 15, // heroBook: v4 P3
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
/**
 * `nav` is 22 by R16 (v4, 2026-10-09) — one size at rest and active; the
 * active tab is told by its harbor tint and ink 700 label, not by icon scale
 * (the pressed-well nav and its 26px state are retired). A1 pins this value.
 */
export const ICON = { nav: 22, primary: 32, control: 17 }; // nav 20→22: R16

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
  /**
   * A8: the beads carry their OWN alpha. It used to arrive as a group
   * `opacity: 0.9` on the whole SECTION_RULE, which dimmed the heading text
   * along with the decoration and cost that text ~0.8 of a contrast point.
   * At 0.9 here the beads paint exactly as they always did; the label above
   * them no longer pays for it.
   */
  const a = 0.9;
  const dash = (x) => `<rect x='${x}' y='1' width='9' height='2' rx='1' fill='${c}' fill-opacity='${a}'/>`;
  return 'url("data:image/svg+xml,'
    + encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 4' width='56' height='4'>`
      + `<circle cx='2' cy='2' r='1.4' fill='${c}' fill-opacity='${a}'/>`
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
  /**
   * A8 (glass audit Tier 1): the `opacity: 0.9` that used to sit here is gone.
   *
   * A group opacity on a section label dims the LABEL, not just the beads —
   * and the label is `muted` on a light surface, which is the pair with the
   * least headroom in the file. Measured across the real painted bands the
   * dimmer put these headings at 3.86–4.32:1; without it they read 4.67–5.35.
   * Even against the bare paper base with zero gradient contribution the
   * dimmed version only reached 4.32, so this failure was never caused by the
   * glass and neither sanctioned contrast retreat would have moved it.
   *
   * The beads are the only thing that WANTED dimming. They are decorative, so
   * they carry their own alpha inside MORSE_BEADS rather than borrowing one
   * from the text they sit under.
   */
};

/* ═══════════════════════════════════════════════════════════════════════════
   THE GLASS LAYER (approved redesign, 2026-08-28 — `Masareef Glass System`)

   ⚠️ THE FIRST VERSION OF THIS HEADER SAID «every hex the design specifies is
   ALREADY a canonical token above». THAT WAS FALSE, and it was caught by an
   audit rather than by me. Measured over the design file: 44 distinct colours,
   17 canonical, **26 NOT**. The true claim is narrower and worth stating
   exactly, because a doc-in-code that overstates is the cache-with-no-
   invalidation this file warns about two hundred lines up.

   WHAT IS TRUE: every hex in HANDOFF's PALETTE section is already canonical —
   terracotta `#A05446` is `conflictInk`; the state tints `#EEF4EE/#4C7950` and
   `#FDF1EE/#A05446` are `settledBg/settledInk` and `conflictBg/conflictInk`;
   the amber rim `rgba(168,127,46,.8)` is `amberRim` to the byte. So no
   Owner-ruled colour is RESTATED here, and the recipes below build surfaces out
   of tokens rather than out of new paint.

   WHAT THE SCREENS ADD ON TOP, and it is not nothing:
     · 18 atmospheric gradient STOPS (#F6E1C3, #EBD5E4, #C9E1EE, …). These are
       washes, they exist only inside `GROUND`, and they are deliberately not
       tokens — see the note there.
     · 8 genuinely new SURFACE hues, which are NOT washes and DO need a ruling
       before they ship:
         #4E8CB4 / #34688C  the primary-action gradient, on every screen
         #E4B658 / #CF9A34  the amber commit gradient (it brackets `amber`,
                            but a gradient is still two new values)
         #D2BE96 / #8A6516  the sand advisory rim and its ink
         #A0823C            a warm ink used beside sand
         #7B8B96            a cash swatch that matches no token at all
   Until those are ruled on, the recipes below reference only canonical tokens,
   and any screen needing one of the eight must stop and ask.

   Every tint below derives its rgb from the token by `alpha()`. That is the
   `--harbor-tint` discipline from styles.css generalised: the ALPHA is the
   design's choice, the RGB is the token's, and a hand-typed `rgba(62,124,166,…)`
   anywhere in a view is the drift to catch — it can silently detach from a
   palette the Owner may still move.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A canonical token at an alpha — never a hand-typed rgb triple.
 * Accepts `#RGB` and `#RRGGBB`; throws on anything else, because a silent
 * fallback here would produce a plausible wrong colour in a glass recipe,
 * which is the one class this file spends its whole length preventing.
 */
export const alpha = (hex, a) => {
  const h = String(hex).trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`alpha(): not a hex colour: ${hex}`);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const W = (a) => `rgba(255,255,255,${a})`;   // white is not a palette token

/**
 * 1 · GROUNDS — what the glass refracts. Three atmospheres, built only from
 * palette hues, chosen per screen family: Book wakes warm, New goes cool so the
 * number reads clean, everything else sits on quiet mist.
 *
 * The stops are verbatim from the design file, which is the source of truth.
 * They are NOT `C` tokens: these are atmospheric wash colours that exist only
 * here, and inventing token names for them would imply they are reusable
 * elsewhere — they are not, they are three specific skies.
 */
export const GROUND = {
  /** v4 Dawn (R15) — amber · sand · harbor; the mauve stop is GONE. Verbatim from
   *  `Masareef Glass PWA.dc.html` P3. The ground for the P-screens. */
  dawn: 'radial-gradient(85% 45% at 10% 0%, #F2D3A6 0%, rgba(242,211,166,0) 70%),'
      + ' radial-gradient(75% 40% at 100% 14%, #EADFCB 0%, rgba(234,223,203,0) 70%),'
      + ' radial-gradient(110% 55% at 25% 100%, #B5D2E6 0%, rgba(181,210,230,0) 72%),'
      + ' radial-gradient(70% 38% at 95% 72%, #C9E0EC 0%, rgba(201,224,236,0) 70%), #F3EEE5',
  tide: 'radial-gradient(110% 75% at 12% 0%, #D9E9F2 0%, rgba(217,233,242,0) 62%),'
      + ' radial-gradient(95% 65% at 96% 18%, #C9E1EE 0%, rgba(201,225,238,0) 58%),'
      + ` radial-gradient(120% 90% at 60% 100%, #E7EFF3 0%, rgba(231,239,243,0) 60%), ${C.shell}`,
  haze: 'radial-gradient(120% 80% at 80% 0%, #E9E1D2 0%, rgba(233,225,210,0) 60%),'
      + ` radial-gradient(100% 80% at 10% 30%, #E2EBF0 0%, rgba(226,235,240,0) 60%), ${C.shell}`,
};

/**
 * THE BOTTOM EDGE of each ground — the average colour of its last 8 rows at
 * 390×844, MEASURED in Chromium (2026-10-10), not picked. In an iOS home-screen
 * app the web view can come up shorter than the screen; whatever lies below it
 * is painted in the page's BASE colour, so the base must be the colour the
 * screen already ends in — paper under the blue Dawn read as a white bar (E-017).
 */
/**
 * THE STATUS-BAR SHADE (E-017, Tarek's choice 2026-10-10: «Full screen + top
 * shade»). The home-screen app runs with a TRANSLUCENT status bar, the only way
 * iOS gives it the whole screen (measured on his phone: screen 874, app 812 —
 * short by exactly the 62pt top inset under the default style). iOS then draws
 * the clock and battery WHITE, so a dark fade sits behind them: 0.7 of ink at
 * the top keeps white ≥ 4.5:1 over every ground's crown (computed: dawn peach
 * 5.19, paper 4.49, haze 4.93, tide 4.81), fading to nothing below the bar.
 */
export const STATUS_SHADE = 'linear-gradient(rgba(44,67,86,0.7), rgba(44,67,86,0.45) 60%, rgba(44,67,86,0))';

/**
 * THE iOS SHORTFALL (E-017, measured on his phone 2026-10-10: screen 874, app
 * 812, top inset 62 — under BOTH status-bar styles). iOS 26 home-screen apps
 * report a layout viewport short by the top inset while the web view itself is
 * full height (the strip took the page's base colour). main.jsx measures the
 * gap into --ios-gap — 0 in every browser and on any iOS that fixes this — and
 * everything pinned to the bottom edge extends by it.
 */
export const pinBottom = (x = '0px') => `calc(${x} - var(--ios-gap, 0px))`;
export const FULL_BLEED = { top: 0, left: 0, right: 0, bottom: pinBottom() };

export const GROUND_EDGE = { dawn: '#CEDDE6', tide: '#EEF2F2', haze: '#FAF7F1' };

/**
 * Every colour a ground can show at full strength — its base and each stop's
 * centre. The contrast suite (A4) composites each glass tier over the lightest
 * and the darkest of these: blur averages the ground under a surface, so a stop
 * centre is the worst case a surface can sit on.
 */
export const GROUND_PIXELS = Object.fromEntries(Object.entries(GROUND).map(([k, v]) => [
  k, [...new Set(v.match(/#[0-9A-Fa-f]{6}/g))],
]));

/**
 * THE CROWN of each ground — the colour the top of the screen actually is.
 *
 * The header scrim fades content out beneath a sticky header, and it can only
 * do that invisibly if it dissolves into the ground it sits on. It used to
 * dissolve into `C.mist`, which was right when the Book ground was the
 * MORNING_CROWN ramp (mist → shell) and became WRONG the moment `GROUND.dawn`
 * put a warm sand stop at the crown: a cream veil hung over a warm morning.
 *
 * B5 states that law in prose — «the strip must dissolve INTO the ground it
 * sits on, or it stops being furniture and starts being paint» — and pinned the
 * literal ternary rather than the relationship, so it did not catch the change.
 * Declaring the crown BESIDE the ground is what stops the two drifting again:
 * whoever edits a ground sees the colour its scrim must match, on the next line.
 */
export const GROUND_CROWN = {
  dawn: '#F2D3A6',   // the amber-sand stop at 10% 0% (v4)
  tide: '#D9E9F2',   // the harbor wash at 12% 0%
  haze: '#E9E1D2',   // the warm stop at 80% 0%
};

/**
 * 2 · SURFACES — the v4 tiers (ARCHITECTURE A3, OWNER-RULINGS R13/R6/A15).
 * THE single source: no view may carry a glass literal; it calls `glass(tier)`.
 * Text sits only on `card` or `chip` (the opacity floor); `chrome` carries
 * labels of 14px+/600+ only; `well` is pressed and never blurs.
 *
 * `f` is the frost factor (FROST — R10's setting): it scales every blur.
 */
// R10: every blur rides `--frost` (the display setting, on the page root) — one
// variable restyles every glass surface. `f` remains for tests and callers.
const blur = (px, sat, f = 1) =>
  `blur(calc(var(--frost, 1) * ${Math.round(px * f)}px))${sat ? ` saturate(${sat}%)` : ''}`;

export const GLASS = {
  card:     { bg: `linear-gradient(155deg, ${W(0.72)}, ${W(0.40)})`, blur: 26, sat: 160,
              rim: W(0.7), cast: `0 12px 32px ${alpha(C.ink, 0.12)}`, inset: `inset 0 1px 0 ${W(0.95)}`, radius: 'card' },
  chip:     { bg: `linear-gradient(155deg, ${W(0.66)}, ${W(0.32)})`, blur: 18, sat: 150,
              rim: W(0.75), cast: `0 4px 12px ${alpha(C.ink, 0.08)}`, radius: 'capsule' },
  /** Owner ruling 2026-10-09 (after measuring R16): the BAR carries more white
   *  than v4's .55→.26 — at .26 its grey labels fell to 1.66:1 over a harbor
   *  button scrolling beneath. .94→.88 is the thinnest stop at which every
   *  label clears 4.5:1 over ANY paint in the palette (measured: .84 and .86
   *  still failed the darkest case). Still blurred, still frosted. */
  chrome:   { bg: `linear-gradient(160deg, ${W(0.94)}, ${W(0.88)})`, blur: 30, sat: 180,
              rim: W(0.8), cast: `0 10px 30px ${alpha(C.ink, 0.16)}`, inset: `inset 0 1px 0 ${W(0.85)}`, radius: 'capsule' },
  well:     { bg: `linear-gradient(175deg, ${alpha(C.ink, 0.08)}, ${W(0.30)})`,
              inset: `inset 0 2px 5px ${alpha(C.ink, 0.14)}, inset 0 -1px 0 ${W(0.7)}`,
              rim: alpha(C.ink, 0.1), radius: 'glassWell' },
  /** Sand glass, blur pinned at 16 (A15). Offline, outbox, caveats, old expenses. */
  advisory: { bg: `linear-gradient(165deg, ${W(0.5)}, ${alpha(C.sand, 0.75)} 45%, ${alpha(C.sand, 0.5)})`, blur: 16,
              rim: 'rgba(210,190,150,.75)', cast: '0 3px 10px rgba(160,130,60,.1)', radius: 'sheet' },
  /** A raised capsule INSIDE a well — the selected period (v4 P3). No blur: it sits on glass. */
  raised:   { bg: `linear-gradient(160deg, ${W(0.95)}, ${W(0.7)})`,
              cast: `0 4px 12px ${alpha(C.ink, 0.14)}`, inset: `inset 0 1px 0 ${W(1)}`, radius: 'capsule' },
  /** Terracotta glass — the uncategorised row (v4 P3). Text: conflictInk. v4 draws .85→.5;
   *  at .5 terracotta measured 4.16:1 over dawn's darkest stop — .9→.8 clears 4.5 (4.61). */
  alert:    { bg: `linear-gradient(160deg, ${alpha(C.conflictBg, 0.9)}, ${alpha(C.conflictBg, 0.8)})`, blur: 18,
              rim: alpha(C.conflictLine, 0.95), cast: `0 4px 12px ${alpha(C.conflictInk, 0.08)}`,
              inset: `inset 0 1px 0 ${W(0.8)}`, radius: 'glassWell' },
  /** The entry SHEET (v4 P4, R17): paper-tinted glass over a dimmed screen. v4 draws
   *  .62→.48; at .48 the ✕ and the «more» chip measured 3.78/3.96:1 over dimmed dawn.
   *  .88→.78 is the thinnest that clears 4.5:1 (the Owner's readability ruling, applied
   *  as for the bar). Measured in test-contrast §P4. */
  sheet:    { bg: `linear-gradient(180deg, ${alpha(C.shell, 0.88)}, ${alpha(C.shell, 0.78)})`, blur: 34, sat: 180,
              inset: `inset 0 1px 0 ${W(0.9)}`, radius: 'sheetTall' },
  /** The card BEHIND the focus card (v4 P6) — it only says «more are waiting». No text on it. */
  peek:     { bg: W(0.35), blur: 14, rim: W(0.6), radius: 'card' },
  /** The «نسخة جديدة جاهزة» card (v4 P8) — light glass above the bar; ink text on it. v4 draws
   *  .62→.34; the muted caption measured 4.26:1 over dawn's darkest stop — .7→.5 clears (4.61). */
  prompt:   { bg: `linear-gradient(160deg, ${W(0.7)}, ${W(0.5)})`, blur: 24, sat: 170,
              rim: W(0.85), cast: `0 12px 30px ${alpha(C.ink, 0.18)}`, radius: 'sheet' },
  /** The «اتحفظ ✓ — رجوع» undo toast (R19) — white text on dark glass. */
  toast:    { bg: `linear-gradient(160deg, ${alpha(C.ink, 0.72)}, rgba(31,43,53,.62))`, blur: 24,
              cast: `0 10px 30px ${alpha(C.ink, 0.22)}`, radius: 'capsule' },
};

/** A tier → a React style object. The only way a view gets glass. */
/** The white highlight line between rows of one glass card (v4 P3) — not a grey rule. */
export const GLASS_DIVIDER = `1px solid ${W(0.6)}`;

/** v4 P5 — the undo toast's action, and a row still on the phone (sand wash). */
export const TOAST_ACTION_BG = W(0.16);
/** A text field's edge on white — muted at .8, 3.71:1 (WCAG 1.4.11 wants 3:1; .7 gave a bare 3.04). C.line was ≈1.3:1. */
export const FIELD_EDGE = alpha(C.muted, 0.8);
/** v4 P8 — loading placeholders: warm blocks that hold the layout steady. Not text. */
export const SKELETON = { strong: '#ECE5D8', row: '#F0EBE1', faint: '#F4F0E8' };
export const PHONE_ROW_BG = `linear-gradient(90deg, ${alpha(C.sand, 0)}, ${alpha(C.sand, 0.5)})`;

/** v4 P4 — the entry sheet's furniture. */
export const SHEET = {
  top: 64,                                   // the sheet's top edge below the status bar
  dim: alpha('#1F2B35', 0.18),              // the screen behind, dimmed
  handle: '#CFC8BA',                        // the 40×5 grab bar
  pickedRim: `1.5px solid ${alpha(C.harbor, 0.75)}`, // a chosen category chip's edge
  saveBottom: 30,                           // the amber «سجّل» above the home indicator
  saveHeight: 62,
  saveCast: `0 12px 28px ${alpha(C.amber, 0.4)}, inset 0 1px 0 ${W(0.55)}`,
};

export const glass = (tier, f = 1) => {
  const t = GLASS[tier];
  if (!t) throw new Error(`glass(): no such tier: ${tier}`);
  // A5: the background reads a per-tier CSS variable first. styles.css sets it
  // to a solid colour only when blur is unsupported or reduced transparency is
  // asked for — so every glass surface falls back with no change in any view.
  const s = { background: `var(--glass-solid-${tier}, ${t.bg})`, borderRadius: RADIUS[t.radius] };
  if (t.blur) s.backdropFilter = s.WebkitBackdropFilter = blur(t.blur, t.sat, f);
  if (t.rim) s.border = `1px solid ${t.rim}`;
  const shadows = [t.cast, t.inset].filter(Boolean);
  if (shadows.length) s.boxShadow = shadows.join(', ');
  return s;
};

/**
 * When the ground is close in tone the white rim disappears and a glass control
 * stops looking like a control: an ink hairline under the white one. HANDOFF.
 */
export const SMART_EDGE = {
  border: `1px solid ${alpha(C.ink, 0.13)}`,
  boxShadow: `inset 0 1px 0 ${W(0.85)}, 0 4px 12px ${alpha(C.ink, 0.08)}`,
};

/** Canonical gradients (R1/R13): they START at the tokens; v4's lighter starts were illustrative. */
export const GRADIENT = {
  harbor: `linear-gradient(160deg, ${C.harbor}, ${C.harborDeep})`,
  amber: `linear-gradient(160deg, ${C.amber}, #CF9A34)`,
};

/**
 * 5 · STATE BOXES — tinted glass, not flat fills, and centred by flex rather
 * than by text-align so a two-line state still sits on its own axis.
 * The inks and grounds are the canonical state tokens; only the build is new.
 */
export const STATE_BOX = {
  ok:      { bg: `linear-gradient(160deg, ${alpha(C.settledBg, 0.88)}, ${alpha(C.settledBg, 0.55)})`,
             border: alpha(C.settledLine, 0.95), ink: C.settledInk, cast: alpha(C.settledInk, 0.08) },
  error:   { bg: `linear-gradient(160deg, ${alpha(C.conflictBg, 0.88)}, ${alpha(C.conflictBg, 0.55)})`,
             border: alpha(C.conflictLine, 0.95), ink: C.conflictInk, cast: alpha(C.conflictInk, 0.08) },
  /** Offline is SAND — it is an advisory, and advisories are warm here. */
  offline: { bg: `linear-gradient(165deg, ${W(0.55)}, ${alpha(C.sand, 0.62)} 40%, ${alpha(C.sand, 0.38)})`,
             border: 'rgba(210,190,150,.8)', ink: C.ink, cast: 'rgba(160,130,60,.12)' },
  pending: { bg: `linear-gradient(160deg, ${alpha(C.shell, 0.92)}, ${alpha(C.shell, 0.7)})`,
             border: alpha(C.ink, 0.14), ink: C.ink, cast: alpha(C.ink, 0.06) },
};

/**
 * 6 · THE FLOATING BAR — v4 (OWNER-RULINGS R16, 2026-10-09). Replaces the
 * pressed-well nav: a glass `chrome` capsule; «جديد» is a filled harbor pill,
 * ALWAYS; the active side tab takes a harbor tint and an ink 700 label.
 * Geometry is the P3 artboard's: 70 tall, 6 inner padding and gap, 20 from the
 * screen sides, 28 from the bottom (never inside the home-indicator safe area).
 */
/** «This one is chosen» on glass (v4): harbor at .13 behind ink 700 — the bar's active tab, a picked chip. */
export const SELECTED_TINT = alpha(C.harbor, 0.13);

export const NAV = {
  height: 70,
  pad: 6,
  gap: 6,
  inset: 20,
  bottom: 28,
  newFlex: 1.15,
  /** Side-tab label: chrome carries 14px+/600+ labels only (A3). */
  label: 14,
  activeTint: SELECTED_TINT,
  /** The «جديد» pill's own cast — the harbor glow under a filled control. */
  newCast: `0 6px 16px ${alpha(C.harbor, 0.35)}`,
};

/**
 * The three display settings the design prototyped as props. They are real
 * settings, not dead knobs: `frost` is the `f` multiplier every recipe above
 * accepts, `atmosphere` re-tints the ground, `comfortZoom` scales the root.
 */
export const FROST = { sheer: 6 / 26, designed: 1, deep: 42 / 26 };
/**
 * ⚠️ WHERE THIS MAY BE APPLIED — A22, and it is not a style preference.
 *
 * A CSS `filter` other than `none` makes its element the CONTAINING BLOCK for
 * every `position: fixed` descendant. This app has nine fixed elements: the
 * nav, the conflict strip, and all three bottom sheets. Applying an atmosphere
 * to any ancestor of those — which is exactly what the design prototype does
 * with `#glass-root { filter: ... }` — silently re-parents every one of them.
 *
 * And it would look fine in testing. `morning` is `'none'`, so the default
 * setting produces no filter and no bug; the breakage appears ONLY under
 * `golden` and `dusk`. A layout failure that depends on a colour setting is
 * not a bug anyone finds by using the app.
 *
 * So: apply an atmosphere to a GROUND LAYER that is a SIBLING of the content,
 * never to an ancestor of it. `test-glass.mjs` enforces this — it fails the
 * build on any bare CSS `filter` in a style object, with its own positive
 * control so the absence assertion cannot pass vacuously.
 */
export const ATMOSPHERE = {
  morning: 'none',
  golden: 'sepia(.12) saturate(1.06) hue-rotate(-6deg)',
  dusk: 'saturate(.94) hue-rotate(8deg) brightness(.98)',
};
export const COMFORT_ZOOM = { min: 1, max: 1.15, step: 0.05 };
