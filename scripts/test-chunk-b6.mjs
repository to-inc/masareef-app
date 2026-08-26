#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK B6 ═══════════
 * «Detail push via the View Transitions API where supported — guarded
 *  (document.startViewTransition?.(…) ?? direct call). BOTH branches pinned:
 *  used when present, gracefully absent when not; never a broken intermediate
 *  state.» (chunk-ledger B6 · nav-F4)
 *
 * WHY BOTH BRANCHES ARE **EXECUTED**, NOT MERELY GREPPED. A source pin proves
 * the code SAYS the thing, never that it happens (N2's own lesson, on this
 * very wall). The shell's pushDetail is extracted below and run three times —
 * API present, API absent, reduced motion — and in every run the state change
 * must fire EXACTLY ONCE. Zero is a dead tap; twice is a double navigation;
 * either is the broken intermediate state the chunk forbids.
 *
 * WHY flushSync IS PART OF THE CONTRACT. startViewTransition snapshots the old
 * frame, runs the callback, snapshots the new — but React batches updates
 * asynchronously, so without flushSync the callback returns with the DOM
 * UNCHANGED and the API animates old-to-old: a transition that looks broken
 * only on devices that support it, which is the worst kind of regression.
 *
 * THE MOTION LAW, at this chunk: the API itself has no reduced-motion opinion —
 * its default crossfade plays regardless. So the guard is OURS, twice: the JS
 * asks matchMedia before starting a transition at all, and the stylesheet
 * flattens the ::view-transition pseudos under the same query, belt and braces.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'CHUNK-B6-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

const app = read('src/App.jsx');
const css = read('src/styles.css');

// ——— the guarded shape, verbatim: optional call, nullish fallback
ok(app.includes('document.startViewTransition?.('),
  'B6.1 the API is reached ONLY through optional call — a bare call is a TypeError on every browser that lacks it');
ok(/\?\?\s*apply\(\)/.test(app),
  'B6.2 …with the direct call as the nullish fallback — absence degrades to the SAME state change, not to a dead tap');
ok(/import \{ flushSync \} from 'react-dom'/.test(app) && app.includes('flushSync(apply)'),
  'B6.3 the transition callback flushes synchronously — otherwise React commits after the snapshot and the API animates old-to-old');
ok(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(app),
  'B6.4 the JS half of the motion law: reduced motion never STARTS a transition — instant state change instead');

// ——— extract pushDetail and RUN it, all three worlds
{
  const declAt = app.indexOf('const pushDetail = useCallback(');
  const endAt = app.indexOf('}, []);', declAt);
  const arrow = declAt === -1 || endAt === -1
    ? null
    : app.slice(declAt + 'const pushDetail = useCallback('.length, endAt + 1);
  ok(!!arrow, 'B6.5 pushDetail was located in App.jsx — a slice that missed it would execute nothing');

  if (arrow) {
    let fn = null;
    try {
      // eslint-disable-next-line no-new-func -- executing the shell's own source under stubs
      fn = new Function('document', 'matchMedia', 'flushSync', `return (${arrow});`);
    } catch (e) {
      ok(false, `B6.5b pushDetail parses standalone (THREW — ${e.message})`);
    }
    const run = (world) => {
      let applied = 0; let started = 0; let flushed = 0; let threw = null;
      const doc = world.absent ? {} : {
        startViewTransition: (cb) => {
          started++; cb();
          // `aborted` models the REAL failure the device produced: a hidden
          // page (or a superseding push) SKIPS the transition — and per spec
          // it is `ready` that rejects (InvalidStateError, observed live
          // 2026-08-26; the first fix caught only `finished` and the error
          // kept coming). Both are modelled so the handler must cover both.
          return world.aborted
            ? { ready: Promise.reject(new Error('aborted')), finished: Promise.reject(new Error('aborted')) }
            : { ready: Promise.resolve(), finished: Promise.resolve() };
        },
      };
      const mm = () => ({ matches: !!world.reduced });
      const flush = (f) => { flushed++; f(); };
      try {
        fn(doc, mm, flush)(() => { applied++; });
      } catch (e) { threw = e.message; }
      return { applied, started, flushed, threw };
    };

    const supported = run({});
    eq(supported.threw, null, 'B6.6 supported world: no throw');
    eq(supported.started, 1, 'B6.6 supported world: the View Transition is USED when present');
    eq(supported.applied, 1, 'B6.6 supported world: the state change fires exactly once, inside the transition');
    eq(supported.flushed, 1, 'B6.6 supported world: …and it is flushed, so the API snapshots the NEW frame');

    const absent = run({ absent: true });
    eq(absent.threw, null, 'B6.7 absent world: no throw — graceful absence, not a crash on older WebKit');
    eq(absent.applied, 1, 'B6.7 absent world: the state change still fires exactly once — never a broken intermediate state');

    const reduced = run({ reduced: true });
    eq(reduced.threw, null, 'B6.8 reduced-motion world: no throw');
    eq(reduced.started, 0, 'B6.8 reduced-motion world: no transition starts — the media guard collapses motion, not behaviour');
    eq(reduced.applied, 1, 'B6.8 reduced-motion world: the state change fires exactly once, instantly');

    /**
     * THE ABORTED WORLD — found on the live page, not imagined. A transition
     * started while the document is hidden (or overtaken by a second push)
     * aborts: the update callback HAS run, the state is right, and the
     * transition's promises reject with InvalidStateError. Unhandled, that
     * rejection is console noise a real crash could hide behind. The absence
     * of theatre must be swallowed; the state change must still have landed.
     */
    const rejections = [];
    const onRej = (err) => rejections.push(err);
    process.on('unhandledRejection', onRej);
    const aborted = run({ aborted: true });
    await new Promise((resolve) => setTimeout(resolve, 25));
    process.off('unhandledRejection', onRej);
    eq(aborted.threw, null, 'B6.8b aborted-transition world: no throw');
    eq(aborted.applied, 1, 'B6.8b aborted-transition world: the state change still landed exactly once');
    eq(rejections.length, 0,
      'B6.8b aborted-transition world: the finished-promise rejection is HANDLED — skipped theatre never surfaces as an unhandled error');
  }
}

// ——— the pushes actually push: detail navigations route through it
ok((app.match(/pushDetail\(/g) || []).length >= 6,
  `B6.9 ≥6 detail navigations ride pushDetail (got ${(app.match(/pushDetail\(/g) || []).length}) — a helper nothing calls is a dead token`);
ok(/onCamera=\{\(\) => pushDetail\(\(\) => setEntryMode\('receipt'\)\)\}/.test(app),
  'B6.10 keypad → camera is a detail push');
ok(/onOpenBatch=\{\(\) => pushDetail\(/.test(app),
  'B6.11 Book → batch review is a detail push — the highest-consequence detail screen in the app');

// ——— the stylesheet half: token duration, and the CSS belt on the JS braces
ok(/::view-transition-old\(root\),\s*\n?\s*::view-transition-new\(root\)\s*\{[^}]*var\(--dur-page\)/.test(css),
  'B6.12 the transition pseudos ride var(--dur-page) — even the browser-drawn crossfade speaks the MOTION vocabulary');
{
  const mediaAt = css.indexOf('@media (prefers-reduced-motion: reduce)');
  const media = mediaAt === -1 ? '' : css.slice(mediaAt);
  ok(/::view-transition[^{]*\{[^}]*animation:\s*none/.test(media.replace(/\n/g, ' ')),
    'B6.13 …and flatten to animation:none under reduced motion — the CSS half of the same guard');
}

if (failures.length) {
  console.log(`❌ CHUNK B6 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · detail pushes transition where supported and simply happen where not`);
