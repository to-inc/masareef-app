# CLAUDE.md — Masareef (مصاريف)

Personal expense tracker for the developer's father — a retired man in Cairo who has
tracked every expense manually in a Google Sheet for years. We are automating his data
entry while keeping HIS sheet as the single source of truth. He is the only user.
Do not generalize this into a multi-user product.

## The one design law
**Capture must take under 5 seconds.** Every decision is judged by the Fogg model
(B = MAP): motivation is already there, so maximize Ability (fewer taps) and let the
Prompt be automatic (the bank SMS fires the system; Dad remembers nothing).
If a feature adds friction to capture, it is wrong even if it adds power.

## Non-negotiable constraints
1. **His Google Sheet stays the source of truth.** One tab per month, columns exactly:
   `Date | Description | Cash / Visa | Category | Amount`. Date format `d/M/yyyy`,
   timezone Africa/Cairo. His summary dashboard reads these tabs — never change the
   schema, never reorder columns, never rename his tabs.
2. **His ~21 custom categories are fixed** (see docs/02-data-context.md). Never invent,
   rename, merge, or "clean up" categories. `omara2 al behar` and `fara7` are real
   categories. `Water. Recharge` has a dot — keep it.
3. **iOS only, and third-party apps cannot read SMS on iOS.** SMS capture goes through
   an iOS Shortcuts Message automation → POST to Apps Script. Do not propose
   Android-style SMS listeners.
4. **Cash is ~20% of his entries** and invisible to SMS. Every capture design needs a
   cash path (currently: 2-tap Shortcut + Egyptian Arabic voice Shortcut).
5. **Senior-friendly UI**: large type, big touch targets, one decision per screen,
   most-used categories first, no gamification, no streaks, no nagging.
6. **Arabic is everywhere**: bank SMS is Arabic (`تم خصم …`), voice input is Egyptian
   Arabic, amounts may arrive in Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) — always normalize.
   Travel months contain EUR/SEK/NOK amounts; non-EGP amounts are written into the
   sheet as `"<amount> <CUR>"` in the Amount column.
7. **Determinism over AI for parsing.** The bank SMS has a fixed format; regex + the
   merchant-memory table categorize >80% of entries with zero cost. LLM calls are a
   last resort, never in the capture hot path.

## Current state (what already exists — read before writing code)
- `backend/Code.gs` — WORKING Apps Script backend (container-bound to his sheet):
  parses the NBE/BanK-AlAhly SMS, normalizes Arabic digits, guesses category from a
  self-learning `Memory` tab (onEdit trigger: fixing a ❓ teaches it), dedupes via
  6h cache, appends rows. Endpoints: type = `sms` | `manual` | `voice`.
- `backend/SETUP-GUIDE.md` — deployment steps + the three iOS Shortcuts
  (A: SMS automation, B: cash keypad, C: "Hey Siri مصاريف" Egyptian Arabic voice).
- `prototype/baba-expense-app.jsx` — high-fidelity React prototype of the dad-facing
  app (design system "Nile ledger": deep green #0E3B2E, sand paper #F6F1E6, brass
  #B8923B, Fraunces display font). Screens: SMS inbox with one-tap category confirm,
  cash keypad, and a summary tab (Today/Week/Month/Year) with cumulative
  this-vs-last-period charts, same-point comparison markers, tappable All/Visa/Cash
  metric cards that recolor charts, avg lines. This is the visual + UX reference for
  any real app. Charts currently run on demo data marked by constants at the top.
- `docs/` — product brief, data context (sheet schema, categories, merchant map,
  sample SMS), roadmap, decision log. **Read docs/02-data-context.md before touching
  any parsing or sheet code.**

## Roadmap discipline
UPDATED 2026-07-29: Phase 2 is accelerated and runs IN PARALLEL with Phase 1 —
Phase 1 deploys to the real sheet while the PWA is built against a COPY. The app
reads AND writes through the one doPost (D12 — Apps Script can't answer CORS
preflight, so reads are simple POSTs too; doGet stays a health ping). Never
duplicate state in a second database. Receipt OCR is in scope (D10, two-phase,
confirm-before-write). The binding docs for all Phase-2 work:
docs/05-implementation-plan.md (workstreams) and docs/06-api-contract.md (the
spec — where docs/design/ differs from it, 06 wins).

## Working model (two sessions)
The Fable 5 session is the orchestrator (architecture, spec, review); an Opus 5
session in this folder is the executor (implements WS1–WS6, ticks the checkboxes
in docs/05). Executors: do not change the API contract, the frozen sheet schema,
or the decision log unilaterally — route those to the orchestrator or Tarek.

## Conventions
- **Honest rendering (learned 2026-07-29, four bugs deep):** no view may
  fabricate a value where the data is null/absent — a missing amount renders as
  `—`, a missing comparison hides its markers and says so, never `0`. The test
  is "does a person read a number that isn't true?", not "does `|| 0` appear?"
  (geometry zeros and partial-period sums are fine). The backend's honesty is
  only as good as the render layer's.
- **Mock parity (learned twice in one day):** a mock's DEFAULT state must match
  the real service's default state — the CORS mock accepted what Google
  refuses, and api/mock.js shipped prev-year data the server doesn't return by
  default; both certified clients that failed against reality. Optimistic
  states go behind explicit flags (e.g. MOCK_HAS_PREV_YEAR), never as defaults.
- Keep the Apps Script in plain ES5-compatible GAS style (no build step) so it can be
  pasted into the browser editor.
- Secrets: the Shortcut↔Script shared SECRET lives only in CONFIG and the Shortcuts;
  never commit a real value.
- Any new parser behavior needs a test case added to the `TEST()` function with a real
  (redacted) SMS variant.
- When unsure about his sheet's actual tab naming or column quirks, ASK the developer
  (Tarek) rather than assuming — his dashboard formulas depend on exact matches.

## How a turn ends (measured law, 2026-08-30)

An audit of **366 of Tarek's prompts** across 18 sessions found that **21% of
everything he typed existed only to collect work that was already asked for, or
to discover that «done» was not true.** He sent **2.6 prompts for every one
thing he actually asked**. These three rules exist to end that, and each one
names the cause it kills.

**1 · THE WHOLE ASK, OR AN EXPLICIT REMAINDER.** *(kills INCOMPLETE_WORK — 32
of 78, the largest cause.)*
Before reporting, re-read his message and LIST every separable thing it asked
for. Each item is either done with evidence, or named in the reply as not done
with the reason. «Fix all three», «wire them too», «and the caption too» are
prompts he should never have had to send — each one is a deliverable that was
sitting in the original request. Finishing two of three and reporting warmly is
the single most expensive habit in this project.

**2 · «DONE» IS A COMMAND'S OUTPUT, NEVER A SENTENCE.** *(kills
UNVERIFIED_CLAIM — 14.)*
The words *done, shipped, working, live, fixed, passing* may appear only beside
a command run in THAT turn whose output shows it. Presence is not use: a token
in the bundle is not a rendered token — that exact mistake shipped a currency
mark that nothing displayed for a day, and was reported as complete on the
strength of a grep. If it is on the screen, render it and read the output. If it
is live, fetch the live bundle and compare it to the local build
(`npm run preflight` does this).

**3 · READ THE ENVIRONMENT, DO NOT GUESS IT.** *(kills WRONG_ASSUMPTION — 10.)*
Run `npm run preflight` at the start of a sitting and before any deploy. It
prints the facts this project has repeatedly guessed wrong: the date and time,
which clone is live, whether the tree is in sync, whether Drive is readable,
whether the live bundle IS the local build, that his book's unit is EUR, and
whether the clipboard actually holds what he is about to paste. All of it is
readable in two seconds and none of it may be assumed.

**Corollary — do not ask what you can read.** Five round trips were spent on
questions the codebase or the wire could have answered. Ask only when the answer
is a preference or a ruling, never when it is a fact.
