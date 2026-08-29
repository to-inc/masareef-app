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
export const RADIUS = { card: 26, row: 20, capsule: 999, inset: 8, sheet: 24 };

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
/**
 * ⚠️ `nav` 21→20 with the glass redesign (2026-08-28). The nav glyph is no
 * longer ONE size: it is 20 at rest and 26 when the tab is pressed, because
 * icon scale is now a STATE SIGNAL — a senior user reads the size change
 * before the colour change. `ICON.nav` IS the rest size; the pressed size is
 * `NAV.iconActive`. Two tokens for one dimension would be the drift this file
 * spends its length preventing, so there is exactly one of each.
 * A1 pins this value; the pin moved in the same edit.
 */
export const ICON = { nav: 20, primary: 32, control: 17 };

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
  dawn: 'radial-gradient(120% 80% at 18% 0%, #F6E1C3 0%, rgba(246,225,195,0) 62%),'
      + ' radial-gradient(100% 70% at 92% 8%, #EBD5E4 0%, rgba(235,213,228,0) 58%),'
      + ` radial-gradient(130% 95% at 50% 100%, #DCE9F0 0%, rgba(220,233,240,0) 62%), ${C.shell}`,
  tide: 'radial-gradient(110% 75% at 12% 0%, #D9E9F2 0%, rgba(217,233,242,0) 62%),'
      + ' radial-gradient(95% 65% at 96% 18%, #C9E1EE 0%, rgba(201,225,238,0) 58%),'
      + ` radial-gradient(120% 90% at 60% 100%, #E7EFF3 0%, rgba(231,239,243,0) 60%), ${C.shell}`,
  haze: 'radial-gradient(120% 80% at 80% 0%, #E9E1D2 0%, rgba(233,225,210,0) 60%),'
      + ` radial-gradient(100% 80% at 10% 30%, #E2EBF0 0%, rgba(226,235,240,0) 60%), ${C.shell}`,
};

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
  dawn: '#F6E1C3',   // the sand stop at 18% 0%
  tide: '#D9E9F2',   // the harbor wash at 12% 0%
  haze: '#E9E1D2',   // the warm stop at 80% 0%
};

/**
 * 2 · SURFACES — four tiers, and elevation is blur plus a 1px specular top
 * edge, NOT a line border. Borders survive only where they mean something:
 * controls and advisory surfaces, which is the rule `C.line` already states.
 *
 * `frost` is a multiplier the display setting drives (Sheer 6 / As designed /
 * Deep frost 42). It is a FUNCTION rather than a constant so the setting can
 * change the whole system from one place; calling `GLASS.card()` with no
 * argument gives the designed weight.
 */
const blur = (px, sat, f = 1) =>
  `blur(${Math.round(px * f)}px)${sat ? ` saturate(${sat}%)` : ''}`;

export const GLASS = {
  /** Content home. white .66→.34, blur 26, sat 150. */
  card: (f = 1) => ({
    background: `linear-gradient(155deg, ${W(0.66)}, ${W(0.34)})`,
    backdropFilter: blur(26, 150, f),
    WebkitBackdropFilter: blur(26, 150, f),
    border: `1px solid ${W(0.55)}`,
    boxShadow: `0 10px 30px ${alpha(C.ink, 0.1)}, inset 0 1px 0 ${W(0.8)}`,
    borderRadius: RADIUS.card,
  }),
  /** One step thinner. Lists, list-scale controls. */
  row: (f = 1) => ({
    background: `linear-gradient(155deg, ${W(0.5)}, ${W(0.26)})`,
    backdropFilter: blur(18, 140, f),
    WebkitBackdropFilter: blur(18, 140, f),
    border: `1px solid ${W(0.45)}`,
    boxShadow: `0 6px 18px ${alpha(C.ink, 0.07)}, inset 0 1px 0 ${W(0.7)}`,
    borderRadius: RADIUS.row,
  }),
  /**
   * Pressed INTO a card. The amount lives here, and so does the active nav
   * tab — «you are here» and «this is the figure» are the same gesture in this
   * system: the surface sinks rather than lifts.
   */
  well: () => ({
    background: `linear-gradient(175deg, ${alpha(C.ink, 0.075)}, rgba(250,247,241,.28) 45%, ${W(0.42)})`,
    boxShadow: `inset 0 2px 6px ${alpha(C.ink, 0.18)}, inset 0 -1px 2px ${W(0.75)}, 0 1px 0 ${W(0.65)}`,
    border: `1px solid ${alpha(C.ink, 0.1)}`,
    borderRadius: RADIUS.capsule,
  }),
  /**
   * Offline, outbox, caveats, the old-expenses callout. KEEPS ITS EDGE BY LAW —
   * this is the one tier the North Star's «plain cards lose their border» rule
   * deliberately exempts, and the glass redesign does not touch that ruling.
   */
  advisory: (f = 1) => ({
    background: `linear-gradient(160deg, ${alpha(C.sand, 0.72)}, ${alpha(C.sand, 0.42)})`,
    backdropFilter: blur(14, null, f),
    WebkitBackdropFilter: blur(14, null, f),
    border: `1px solid ${alpha(C.line, 0.9)}`,
    boxShadow: `inset 0 1px 0 ${W(0.6)}`,
    borderRadius: RADIUS.sheet,
  }),
  /**
   * When the ground is close in tone the white rim disappears and a glass
   * control stops looking like a control. The smart edge adds an ink hairline
   * UNDER the white one, so the boundary reads on light and dark grounds
   * alike. Applied to segmented controls; use it anywhere an edge dissolves.
   */
  smartEdge: () => ({
    border: `1px solid ${alpha(C.ink, 0.13)}`,
    boxShadow: `inset 0 1px 0 ${W(0.85)}, 0 4px 12px ${alpha(C.ink, 0.08)}`,
  }),
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
 * 6 · THE FLOATING BAR — and its ALIGNMENT LAW, which is the part most easily
 * broken by a later padding tweak.
 *
 * The active tab is a pressed well; the inactive tab is not. Their paddings
 * and circle sizes differ, and they are chosen so that BOTH states put the
 * icon centre at y=32 from the bar top and the label top at y=58:
 *     active   6 (margin) + 4 (pad) + 44/2 = 32
 *     inactive 8 (pad)             + 48/2 = 32
 * Change one number here and you must re-solve the pair. The suite pins it.
 *
 * ICON SCALE IS A STATE SIGNAL, not decoration: 20px at rest, 26px pressed,
 * animated over MOTION.tap-scale time. A senior user reads the size change
 * before the colour change.
 */
export const NAV = {
  /** The pressed size. The REST size is `ICON.nav` — one token per dimension. */
  iconActive: 26,
  circleActive: 44,
  circleInactive: 48,
  activeMargin: 6,
  activePadTop: 4,
  activePadBottom: 6,
  inactivePadTop: 8,
  inactivePadBottom: 12,
  /** The invariant both states must satisfy — asserted, never assumed. */
  iconCentreY: 32,
  labelTopY: 58,
  bar: (f = 1) => ({
    background: `linear-gradient(160deg, ${W(0.66)}, ${W(0.36)})`,
    backdropFilter: blur(30, 160, f),
    WebkitBackdropFilter: blur(30, 160, f),
    border: `1px solid ${W(0.6)}`,
    boxShadow: `0 12px 34px ${alpha(C.ink, 0.14)}, inset 0 1px 0 ${W(0.85)}`,
    borderRadius: RADIUS.capsule,
    alignItems: 'stretch',
  }),
  /** The active tab's harbor-tinted disc — the rgb is the token's. */
  activeCircleBg: alpha(C.harbor, 0.14),
  /** «جديد» at rest floats above the bar; ACTIVE it loses the float and sinks. */
  plusFloatMarginTop: -14,
  plusPressedShadow: 'inset 0 2px 5px rgba(0,0,0,.28)',
};

/**
 * The three display settings the design prototyped as props. They are real
 * settings, not dead knobs: `frost` is the `f` multiplier every recipe above
 * accepts, `atmosphere` re-tints the ground, `comfortZoom` scales the root.
 */
export const FROST = { sheer: 6 / 26, designed: 1, deep: 42 / 26 };
export const ATMOSPHERE = {
  morning: 'none',
  golden: 'sepia(.12) saturate(1.06) hue-rotate(-6deg)',
  dusk: 'saturate(.94) hue-rotate(8deg) brightness(.98)',
};
export const COMFORT_ZOOM = { min: 1, max: 1.15, step: 0.05 };
