# masareef/app — the PWA

The dad-facing installable web app. Reads and writes through the one `doPost` in
`../backend/Code.gs`; his Google Sheet stays the single source of truth.

## ⚠️ Do not run `npm install` in this folder

This project lives inside a Google Drive mount. `node_modules` here means tens of
thousands of tiny files handed to the Drive sync client — slow installs, slow
builds, and a sync queue that never drains.

**Work from a local clone instead:**

```bash
rsync -a --exclude node_modules --exclude dist "$PWD/" ~/masareef-app/ && cd ~/masareef-app && npm install && npm run dev
```

Source stays canonical in Drive; copy changes back when you are done (or keep the
local copy as your working tree and rsync in the other direction). `dist/` and
`node_modules/` are gitignored.

> **After an rsync, hard-reload the preview** (⌘⇧R, or Empty Cache and Hard
> Reload). Vite's HMR does not reliably survive having its files replaced in
> bulk underneath it — you can end up looking at a stale bundle and debugging a
> problem you already fixed.

## Publishing

**Drive is the editing source. This repo is only ever a faithful copy of it** —
it lives outside Drive so a sync conflict can never corrupt `.git`. Never edit
here: the next sync overwrites it.

One-time setup:

```bash
export MASAREEF_DRIVE_APP="/path/to/…/masareef/app"   # add to ~/.zshrc
```

Every publish, in this order:

```bash
bash scripts/sync-from-drive.sh && git add -A && git commit && git push
```

`sync-from-drive.sh` mirrors Drive with `--delete` (preserving `.git`,
`node_modules`, `dist`) and then runs `check-before-publish.sh`, so a private
file that appears in Drive cannot pass quietly into a commit.

**Why the source path is an environment variable rather than a constant:** it
contains a personal email address and a private shared-drive name, and this file
is published. **And why the script refuses so loudly:** it uses `rsync --delete`,
so a missing or empty source — an unmounted Drive, a renamed folder — would
delete this entire repo. It verifies the source really is the app before removing
anything.

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # production build → dist/
npm run preview   # serve dist/ locally
npm run icons     # regenerate public/icons/*.png from the SVG masters
```

## App icon

**"Sextant 4a / Dawn Sight"** (2026-08-03). The frame reads as an **A** and the
sun as an **O** — the symbolism is structural, and there are no letterforms on
the icon. The section divider says the same two letters in Morse (`·— ———`), as
a CSS background rather than as text so a screen reader skips it.

`public/icons/sextant.svg` is the **source of truth**; `sextant-maskable.svg` is
the same drawing plus one transform that scales the mark into Android's 80% safe
zone. The four PNGs are generated, never hand-edited:

```bash
npm run icons && npm run check:icons
```

Rasterising uses `rsvg-convert` or ImageMagick when present, and otherwise
macOS's own `qlmanage`, which ships with the OS — this repo deliberately has no
image dependency. `npm run check:icons` decodes the generated PNGs and checks
the pixels, not the file sizes: it verifies the mark is actually painted, that
the icon is fully opaque to every edge, that the maskable stays inside the safe
zone (computed from the SVG's own geometry), and that **`maskable-512.png` is
not a copy of `icon-512.png`** — which is what it had silently been until this
rev, byte for byte.

### ⚠️ An installed iOS web clip keeps its old icon — forever

iOS caches the home-screen icon at install time and never refreshes it. The only
way to get the new one is to remove the web clip and add it again — and **that
creates fresh storage**: the saved `/exec` URL and secret are wiped and the app
opens on SetupView.

So the rollout is deliberately uneven, and that is fine:

- **Existing installs** keep the old icon until their owner chooses to
  reinstall. Nothing is broken; the app is entirely current apart from the icon.
- **Whoever does reinstall** must re-paste the URL and the secret once. Have them
  to hand *before* deleting the web clip.
- **New installs** — Dad's, when WS6 cuts over — get the sextant from day one and
  never see any of this.

## Environment

| Variable | Meaning |
|---|---|
| `VITE_GAS_URL` | `/exec` URL of the target Apps Script deployment |
| `VITE_USE_MOCK` | `true` → run entirely on `src/api/mock.js` |
| `VITE_BASE` | Build base path (defaults to `/masareef/` for GitHub project pages) |

**The SECRET is never in an env file.** It is pasted once into the running app
and stored in localStorage (WS3's `SetupView`). Nothing secret belongs in a file
that ends up in the repo.

## State of play

- **WS2 (done)** — shell, all prototype components ported, running on mock data.
  `src/api/mock.js` returns the exact `summary` shape from
  `../docs/06-api-contract.md` §2.2, **including the null-padding convention and
  `month.undated`**. If you change the mock, keep both — the charts read
  `null` as "hasn't happened yet" and `0` as "happened, spent nothing", and
  swapping them silently corrupts every comparison.
- **WS3** — replaces the stubs in `src/api/index.js` with the real transport
  (`client.js`, `endpoints.js`), adds `SetupView`, the localStorage snapshot,
  and the outbox.
- **WS4** — replaces `src/views/ReceiptView.jsx`, currently a placeholder that
  exists only to fix the tab bar's final shape.

## Things that will look wrong but are not

- **`dir="ltr"` on the chart wrappers.** The document is RTL; time is not. The
  cumulative charts read left→right so "today" stays on the right-hand end.
- **Latin category names inside Arabic text.** They are the frozen sheet schema
  and must round-trip byte-identical. `unicode-bidi: isolate` keeps bidi from
  reordering them (`Water. Recharge` renders with its dot in the right place).
- **Western digits everywhere.** Matches his sheet and Fraunces' numerals.
  Arabic-Indic input is normalized on the way in, never on the way out.
- **No "save" button anywhere.** Every action writes immediately; the Today view
  is a read-back mirror of the sheet. The prototype's "Write N rows" button was
  removed on purpose.
- **`—` where you might expect a number.** That is deliberate; see below.

## Field-test diagnostics (Tarek only, never Dad)

The one unproven path is **EXIF orientation on iOS Safari**. The Chromium decode
is verified; Safari's fallback branch is not. It fails *silently* — a sideways
receipt still extracts, just worse — so it would surface as "the OCR seems
unreliable" a week later, which is the hardest kind of bug to trace.

`prepareReceipt` therefore checks the encoded output: a receipt is nearly always
taller than it is wide, so **landscape output on a portrait photo means the
rotation was not applied**. That turns a statistical, week-long symptom into a
photo-one signal.

- Always: a `console.warn` on landscape output, `console.info` otherwise.
- On the phone, where Safari's console needs a tethered Mac and is useless
  mid-test, enable the on-card readout:

```js
localStorage.setItem('masareef.debug', '1')
```

The confirm card then shows `1176×1568 · 49KB · q0.8 · portrait ✓`, turning red
with `⚠ LANDSCAPE — EXIF rotation not applied?` if the check trips. Turn it off
with `localStorage.removeItem('masareef.debug')` before Dad's build.

## Checks

```bash
npm test            # primitives + the twin-payload render check
npm run check:honest
```

Both run inside `scripts/check-before-publish.sh`, so a sync that imports a
fabrication cannot pass quietly into a commit.

**Why there are two, when one looks like a superset of the other** — proven by
mutation, not assumed:

| mutation | `test-format.mjs` | `honest-render.mjs` |
|---|---|---|
| revert the `format.js` primitive | **fails** | passes — the call-site guards still stand |
| a view coercing its own value with `\|\| 0` | passes — the primitive is fine | **fails** |

Neither subsumes the other. Deleting either one leaves a live route to the same
bug.

**How the render check works.** Each view is rendered twice from payloads that
differ only in slots carrying nullable data: `null` in one, a sentinel number in
the other. Any text that *changed* is by construction a slot that displays that
datum — and on the null side it must contain **no digit**. That catches the case
a primitive test structurally cannot: a view that never calls `money()` at all.
It carries its own negative control, and it treats two identical renders as a
**failure**, because a payload that never reaches the view proves nothing.

Only display-only fields are nulled. `sumTo` treats null as `0` by design (a
partial period is a real sum), so nulling a field that feeds a total would flag
honest arithmetic as a lie — and a check that cries wolf gets switched off.

## Review rule: the render layer must not fabricate

**The backend's honesty is only as good as the render layer's.** The server goes
to real trouble never to invent data — an unreadable amount stays `null`, a
month with no tab stays `null`, `unpriced` counts rows it cannot price. All of
that is undone by one `money(null)`, which renders `0`: a number he never wrote,
presented with the same confidence as one he did.

**As of 2026-07-31 this rule is executable** (see Checks above) — but the rule
still matters, because the check can only see slots a payload can reach.

The primitive itself used to fabricate by **two** routes, and both are now
closed: `Number(null)` is `0` and `isFinite(0)` is true, so `money(null)` never
reached its own guard; and that guard returned `'0'` anyway. Every one of the
fixes below was made at a CALL SITE while the primitive stayed loaded, which is
why the class kept reappearing in new files:

| Where | Bug | Should be |
|---|---|---|
| `InboxView` amount | `money(null)` → `0` | `—` |
| `InboxView` travel badge | `null !== 'EGP'` → "✈ سفر" on an unpriced row | only a real foreign currency |
| `SummaryView` today row | `amountWithCurrency(null)` → `0` | `—` |
| `MetricCards` / `CumulativeChart` | `cumsum(prev)[i] \|\| 0` → "last year: 0" and a grey marker on the baseline, when the 2025 file simply isn't connected | `—`, and draw no marker |

**So, when adding or changing any view:** for every field you render that can be
null or absent — amount, currency, category, date, guess, `undated`/`unpriced`
counts, any week/month/year cell — check what it renders when the value is
missing. It must read as an absence (`—`, hidden, or an honest label), never as
a fabricated value. `0`, `""` and a silently-omitted badge all fail this.

Note that `|| 0` is *correct* in SVG geometry (a null day should draw a
zero-height bar) and in `sumTo` (summing a partial period). The test is whether
a **person reads a number that isn't true**, not whether the operator appears.
