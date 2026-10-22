/**
 * Contrast smoke test.
 *
 * Walks the app's own colour pairs (button fills, badge tints, text colours)
 * and fails when a pair drops below WCAG AA. Run with:
 *   npm run smoke:contrast   (from the client folder)
 */
import palette from '../src/lib/palette.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const toRgb = (hex) => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

/** [foreground, background, minimum ratio, label] */
const PAIRS = [
  // body text
  [palette.ink.DEFAULT, '#FFFFFF', 4.5, 'ink on white'],
  [palette.ink.DEFAULT, palette.canvas, 4.5, 'ink on canvas'],
  [palette.ink.muted, '#FFFFFF', 4.5, 'ink-muted on white'],
  [palette.ink.muted, palette.canvas, 4.5, 'ink-muted on canvas'],
  [palette.ink.faint, '#FFFFFF', 4.5, 'ink-faint on white'],
  [palette.ink.faint, palette.canvas, 4.5, 'ink-faint on canvas'],
  [palette.ink.faint, palette.ink[100], 4.5, 'ink-faint on ink-100'],
  [palette.ink.faint, palette.ink[50], 4.5, 'ink-faint on ink-50'],
  [palette.ink[600], palette.ink[50], 4.5, 'ink-600 on ink-50'],
  [palette.ink[600], palette.ink[100], 4.5, 'ink-600 on ink-100'],

  // links and accents
  [palette.brand[600], '#FFFFFF', 4.5, 'brand-600 link text'],
  [palette.brand[700], palette.brand[50], 4.5, 'brand-700 on brand-50'],
  [palette.brand[600], palette.brand[50], 4.5, 'brand-600 on brand-50'],
  [palette.cyan[700], '#FFFFFF', 4.5, 'cyan-700 on white'],
  [palette.cyan[800], palette.cyan[50], 4.5, 'cyan-800 on cyan-50'],

  // badge tints
  [palette.success[700], palette.success[50], 4.5, 'success-700 on success-50'],
  [palette.warning[700], palette.warning[50], 4.5, 'warning-700 on warning-50'],
  [palette.danger[700], palette.danger[50], 4.5, 'danger-700 on danger-50'],
  [palette.navy[700], palette.navy[100], 4.5, 'navy-700 on navy-100'],

  // solid buttons: white label
  ['#FFFFFF', palette.brand[500], 4.5, 'white on brand-500'],
  ['#FFFFFF', palette.danger[600], 4.5, 'white on danger-600'],
  ['#FFFFFF', palette.success[700], 4.5, 'white on success-700'],
  ['#FFFFFF', palette.navy[900], 4.5, 'white on navy-900'],

  // solid buttons: dark label
  [palette.navy[900], palette.warning[500], 4.5, 'navy-900 on warning-500'],
  [palette.navy[900], palette.warning[400], 4.5, 'navy-900 on warning-400'],
  [palette.navy[900], palette.cyan[500], 4.5, 'navy-900 on cyan-500'],

  // semantic text used for stock levels and balances
  [palette.success[700], '#FFFFFF', 4.5, 'success-700 on white'],
  [palette.warning[700], '#FFFFFF', 4.5, 'warning-700 on white'],
  [palette.danger[600], '#FFFFFF', 4.5, 'danger-600 on white'],
  [palette.danger[700], '#FFFFFF', 4.5, 'danger-700 on white'],

  // toasts
  [palette.success[800], palette.success[50], 4.5, 'success-800 on success-50'],
  [palette.danger[800], palette.danger[50], 4.5, 'danger-800 on danger-50'],

  // non-text UI: fills need 3:1
  [palette.line, '#FFFFFF', 1.0, 'line border (decorative)'],
  [palette.danger[500], '#FFFFFF', 3, 'danger-500 focus ring'],
  [palette.brand[500], '#FFFFFF', 3, 'brand-500 focus ring'],
];

let failed = 0;
for (const [fg, bg, min, label] of PAIRS) {
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  if (!ok) failed++;
  // eslint-disable-next-line no-console
  console.log(
    `  [${ok ? 'PASS' : 'FAIL'}] ${label.padEnd(34)} ${ratio.toFixed(2)}:1 (min ${min})`
  );
}

if (failed) {
  // eslint-disable-next-line no-console
  console.error(`\n${failed} colour pair(s) below the minimum contrast.`);
  process.exit(1);
}

// ---------------------------------------------------------------- token audit
// Two things must hold:
//   1. every colour utility resolves to a real token (otherwise Tailwind emits
//      no rule and the element silently loses its colour)
//   2. no raw Tailwind palette colours are used — they bypass the app tokens

const FILES = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(jsx?|css)$/.test(entry)) FILES.push(full);
  }
})(srcRoot);

const SCALED = ['navy', 'brand', 'cyan', 'success', 'warning', 'danger', 'ink'];
const FLAT = ['line', 'canvas'];
const RAW_TAILWIND = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];

const CLASS_RE = /\b(?:[a-z-]+:)*(?:text|bg|border|ring|fill|stroke|from|to|via|divide|outline|placeholder|decoration|accent|caret)-([a-z]+)(?:-(\d{2,3}))?\b/g;

let unknown = 0;
for (const file of FILES) {
  const src = readFileSync(file, 'utf8');
  let match;
  CLASS_RE.lastIndex = 0;
  while ((match = CLASS_RE.exec(src))) {
    const [, name, shade] = match;
    const where = file.replace(srcRoot, 'src');

    if (RAW_TAILWIND.includes(name)) {
      unknown++;
      // eslint-disable-next-line no-console
      console.error(`  [FAIL] raw Tailwind colour "${name}${shade ? `-${shade}` : ''}" in ${where}`);
      continue;
    }

    let ok = true;
    if (SCALED.includes(name)) {
      ok = shade ? Boolean(palette[name]?.[shade]) : Boolean(palette[name]?.DEFAULT);
    } else if (FLAT.includes(name)) {
      ok = !shade && Boolean(palette[name]);
    } else {
      continue; // not an app token family (white, transparent, current, ...)
    }

    if (!ok) {
      unknown++;
      // eslint-disable-next-line no-console
      console.error(`  [FAIL] unknown colour token "${name}${shade ? `-${shade}` : ''}" in ${where}`);
    }
  }
}

if (unknown) {
  // eslint-disable-next-line no-console
  console.error(`\n${unknown} colour reference(s) outside the palette.`);
  process.exit(1);
}

// ------------------------------------------------- background/text pair audit
// Catches the real-world mistake: a tinted background paired with a text
// colour that is too light, e.g. "bg-cyan-50 text-cyan-700" (3.9:1).
// Scans every class string for a background followed by a text colour.

const PAIR_RE = /\bbg-([a-z]+)-(\d+)[^"'`]*?\btext-([a-z]+)-(\d+)\b/g;

let badPairs = 0;
for (const file of FILES) {
  const src = readFileSync(file, 'utf8');
  let match;
  PAIR_RE.lastIndex = 0;
  while ((match = PAIR_RE.exec(src))) {
    const [, bgName, bgShade, fgName, fgShade] = match;
    const bg = palette[bgName]?.[bgShade];
    const fg = palette[fgName]?.[fgShade];
    if (!bg || !fg) continue;
    const ratio = contrast(fg, bg);
    if (ratio < 4.5) {
      badPairs++;
      // eslint-disable-next-line no-console
      console.error(
        `  [FAIL] text-${fgName}-${fgShade} on bg-${bgName}-${bgShade} is ${ratio.toFixed(2)}:1 in ${file.replace(srcRoot, 'src')}`
      );
    }
  }
}

if (badPairs) {
  // eslint-disable-next-line no-console
  console.error(`\n${badPairs} background/text pair(s) below 4.5:1.`);
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log('All colour pairs meet their contrast target.');
