#!/usr/bin/env node
/**
 * Rasterise the app icon from its SVG masters.  `npm run icons`
 *
 * The four PNGs in public/icons/ are BUILD OUTPUT that happens to be committed
 * (the published site serves them directly, and GitHub Pages runs no build step
 * for static assets). They are never hand-edited: edit `sextant.svg`, run this,
 * commit what changes.
 *
 * WHY qlmanage. This machine has no rsvg-convert, no ImageMagick, no Inkscape
 * and no cairosvg, and the one thing worse than an undocumented icon pipeline is
 * one that needs a toolchain nobody has installed. `qlmanage` is macOS's own
 * QuickLook thumbnailer, ships with the OS, and renders SVG. If this ever has to
 * run elsewhere, the fallbacks below are tried in order and the error says
 * exactly what to install.
 *
 * The previous icons had no recorded generation path at all, which is how
 * `maskable-512.png` came to be a byte-copy of `icon-512.png` for five days.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS = join(HERE, '..', 'public', 'icons');

/**
 * The index arm is the first detail to fail: below ~64px it merges with the sun
 * and the two read as one smudge. Stripped by ID, not by eye — and stripped from
 * the SVG before rasterising, so the renderer never sees it.
 *
 * Exported and tested rather than inlined: a rule with a threshold in it is a
 * rule worth being able to prove, and none of the four sizes we currently ship
 * would exercise it.
 */
export const INDEX_ARM_MIN_PX = 64;
export function forSize(svg, px) {
  if (px > INDEX_ARM_MIN_PX) return svg;
  return svg.replace(/<g id="index-arm">[\s\S]*?<\/g>\s*/, '');
}

const TARGETS = [
  { out: 'apple-touch-icon-180.png', px: 180, from: 'sextant.svg' },
  { out: 'icon-192.png', px: 192, from: 'sextant.svg' },
  { out: 'icon-512.png', px: 512, from: 'sextant.svg' },
  { out: 'maskable-512.png', px: 512, from: 'sextant-maskable.svg' },
];

function rasterise(svgText, px, outPath) {
  const work = mkdtempSync(join(tmpdir(), 'masareef-icon-'));
  try {
    const src = join(work, 'icon.svg');
    writeFileSync(src, svgText);

    // 1. rsvg-convert / ImageMagick, if this ever runs on a machine that has them
    for (const [bin, args] of [
      ['rsvg-convert', ['-w', String(px), '-h', String(px), '-o', outPath, src]],
      ['magick', [src, '-resize', `${px}x${px}`, outPath]],
    ]) {
      try { execFileSync(bin, args, { stdio: 'ignore' }); return bin; } catch { /* try the next */ }
    }

    // 2. macOS QuickLook — always present here.
    try {
      execFileSync('qlmanage', ['-t', '-s', String(px), '-o', work, src], { stdio: 'ignore' });
      const made = join(work, 'icon.svg.png');
      if (existsSync(made)) { copyFileSync(made, outPath); return 'qlmanage'; }
    } catch { /* fall through to the error below */ }

    throw new Error(
      'No SVG rasteriser worked.\n'
      + '  macOS: qlmanage ships with the OS — if it failed, run it by hand to see why.\n'
      + '  elsewhere: brew install librsvg   (gives rsvg-convert)',
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Importable for the test suite without generating anything.
 *
 * `fileURLToPath`, NOT `import.meta.url === \`file://${process.argv[1]}\``. The
 * idiomatic form compares a percent-ENCODED URL against a raw path, so on any
 * checkout whose path contains a space — such as the Google Drive folder this
 * project is edited in — it is silently false and the script does nothing at
 * all. It printed no output and exited 0; the only reason it was caught is that
 * the icons' md5s had not moved afterwards.
 */
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const t of TARGETS) {
    const svg = forSize(readFileSync(join(ICONS, t.from), 'utf8'), t.px);
    const via = rasterise(svg, t.px, join(ICONS, t.out));
    console.log(`  ${t.out.padEnd(26)} ${String(t.px).padStart(4)}px  ← ${t.from}  (${via})`);
  }
  console.log('\n  Now run: npm run check:icons');
}
