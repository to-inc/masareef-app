# Gates: whole-app audit — every screen, both languages, against the real wire

OWNS: src/**, scripts/audit-screens.mjs, scripts/test-units.mjs, scripts/test-glass.mjs

Scope: audit every page of the app against a REAL server payload, fix every
defect found, and leave an oracle that renders all of them on each run.

The fixture is a captured `action:'summary'` response from the test bed on build
`20260827-1724` — not a hand-written shape, because a hand-written shape is a
guess about the server and this project has been wrong about the server before.

Two harness bugs were found and fixed BEFORE any finding was trusted, and both
would have produced false results:
  · the pending fixture was a flat row, so InboxView threw on `item.match` —
    that would have been reported as a crash the app does not have;
  · one Vite server was re-used across both languages, and `ssrLoadModule`
    caches modules, so the English column rendered Arabic. Every English
    assertion was a second Arabic one until each language got its own server.

- [x] LEAD: no period headlines a zero while it holds money, measured against the real wire in both languages
  CHECK: node scripts/check-lead.mjs
  EXPECT: /all \d+ lead checks passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/private/tmp/masareef-ship; path=64f7963a1548/18 entries; EXPECT=matched; output-sha256=1106c14b547daac5c63bcb8f6470a54cbde3a20a33220c86aa6a081a53e8fd72; output-bytes=81

- [x] SCREENS: every screen renders in both languages against the real payload with no leaked comment, no raw ISO code, no long-form unit, no undeclared sub-floor type and no tap under the floor
  CHECK: node scripts/audit-screens.mjs
  EXPECT: AUDIT-CLEAN
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/private/tmp/masareef-ship; path=64f7963a1548/18 entries; EXPECT=matched; output-sha256=60b59070dab207ed807aeebc0363216893622ce02441f1bc0258e29c73ff3a8a; output-bytes=132

- [x] GEOMETRY: every sub-floor size that survives is DECLARED geometry, machine-checkably, not a comment a reader has to find
  CHECK: node scripts/audit-screens.mjs
  EXPECT: AUDIT-CLEAN
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/private/tmp/masareef-ship; path=64f7963a1548/18 entries; EXPECT=matched; output-sha256=60b59070dab207ed807aeebc0363216893622ce02441f1bc0258e29c73ff3a8a; output-bytes=132

- [x] BOARD: the app's own board stays green
  CHECK: npm test
  EXPECT: /declared count matches/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/private/tmp/masareef-ship; path=64f7963a1548/18 entries; EXPECT=matched; output-sha256=a7c1828cba491f62b8610525a6a971ff2ead131d6d709574745b6fa576ad30f8; output-bytes=114636

- [x] CONTRAST: every measured pair still clears its floor
  CHECK: npm run check:contrast
  EXPECT: /all \d+ contrast checks passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/private/tmp/masareef-ship; path=64f7963a1548/18 entries; EXPECT=matched; output-sha256=36fe66906ce1764d410f4c25cf9d24c5354ecd7e7401b54979a60c0922d28e0f; output-bytes=12527

- [x] UNITS: the currency-mark and no-bare-amount laws hold on every period in both languages
  CHECK: npm run check:units
  EXPECT: /all \d+ unit checks passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/private/tmp/masareef-ship; path=64f7963a1548/18 entries; EXPECT=matched; output-sha256=6a65711252a07c4a0aca21def2438a726d02db15d8b2265190a1be02e2b50401; output-bytes=92333

- [x] JSX: no comment can reach the screen
  CHECK: npm run check:jsx
  EXPECT: /all \d+ jsx-comment checks passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/private/tmp/masareef-ship; path=64f7963a1548/18 entries; EXPECT=matched; output-sha256=8470990d2510adff041791754197932c89e7a960bd2154b83e9e51a1e2327c70; output-bytes=107

- [x] GLASS: the glass layer's invariants hold, including the fixed-position filter trap
  CHECK: npm run check:glass
  EXPECT: /all \d+ glass checks passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/private/tmp/masareef-ship; path=64f7963a1548/18 entries; EXPECT=matched; output-sha256=27a46c5459334be9d9177e460f88aacf553e5de1720e06e32d4b13751de19500; output-bytes=96
