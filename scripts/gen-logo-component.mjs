// Generate src/app/components/Logo.tsx and public/favicon.svg from the brand marks.
//
// The mark must be INLINE in the DOM for currentColor to inherit — via <img> it
// does not. So the SVG is emitted as JSX rather than imported as a file.
//
// Source: brand/logo/*.svg, vendored from jarvis-travel/design-library. See
// brand/logo/PROVENANCE.md for the pinned upstream commit and why a copy exists.
//
//   node scripts/gen-logo-component.mjs            regenerate
//   node scripts/gen-logo-component.mjs --check    verify, write nothing (CI)
//
// --check is what makes "single source of truth" an invariant rather than a
// comment: without it the mark could change upstream and the site would keep
// shipping a stale one, silently and forever (review M3).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Paths resolve against the repo, never the cwd, and never an absolute path on
// one machine. LIB used to be hardcoded to a developer's home directory, so the
// documented regeneration command failed with ENOENT everywhere else — and the
// upstream files are not on design-library's main branch, so there was nowhere
// else to point it (review M1).
const LIB = process.env.DESIGN_LIBRARY
  ? resolve(process.env.DESIGN_LIBRARY, 'brand/logo/normalized')
  : resolve(ROOT, 'brand/logo');
const OUT = resolve(ROOT, 'src/app/components/Logo.tsx');
const FAVICON = resolve(ROOT, 'public/favicon.svg');

const check = process.argv.includes('--check');

/** Pull the inner markup and viewBox out of a normalised SVG. */
function parse(name) {
  const file = `${LIB}/jarvistravel-${name}-current.svg`;
  if (!existsSync(file)) {
    throw new Error(
      `Brand mark not found: ${file}\n` +
        `Set DESIGN_LIBRARY to a design-library checkout, or see brand/logo/PROVENANCE.md.`
    );
  }
  const raw = readFileSync(file, 'utf8');

  // Both quote styles, and a real error rather than a null deref. The regex was
  // double-quote-only and the match was indexed unguarded, so a single-quoted or
  // missing viewBox crashed with "Cannot read properties of null" — or, worse,
  // baked viewBox="undefined" into the component (review L1).
  const vb = /viewBox\s*=\s*["']([^"']+)["']/.exec(raw);
  if (!vb) {
    throw new Error(`No viewBox in ${file} — cannot size the mark.`);
  }

  const inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s*data-name="[^"]*"/g, '')
    .replace(/\s*id="[^"]*"/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // A baked fill or stroke wins over the inherited colour, which silently
  // disables the entire currentColor mechanism this component exists for — the
  // mark would render one fixed colour on both grounds. Refuse rather than strip:
  // a mark with hardcoded paint is an upstream defect worth seeing (review L2).
  const painted = /\s(?:fill|stroke)\s*=\s*["'](?!currentColor|none)([^"']+)["']/.exec(inner);
  if (painted) {
    throw new Error(
      `${file} bakes ${painted[0].trim()} into the markup.\n` +
        `The mark must inherit via fill="currentColor"; fix it upstream, do not strip it here.`
    );
  }

  assertSafeMarkup(file, inner);
  return { viewBox: vb[1], inner, bounds: contentBounds(raw) };
}

// ── Source-mark validation ───────────────────────────────────────────────────
// The generator is the ONLY gate between a design-library SVG and markup that
// gets inlined into every visitor's DOM. Inlining is deliberate — it is what
// makes fill="currentColor" work — and it is also what makes an unvalidated
// mark an XSS vector: a <script> rendered through JSX executes on insertion,
// an <image href> is an external fetch, and a `{` in a text node becomes an
// evaluated JSX expression at module scope.
//
// Reviewers proved all four against the previous version by crafting a source
// SVG. "The source is trusted" is not a control; this is (review H1).

/** The only elements a normalised mark may contain. */
const ALLOWED_TAGS = new Set(['path', 'g']);

/** The only attributes those elements may carry. */
const ALLOWED_ATTRS = new Set([
  'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'fill-rule', 'clip-rule', 'transform', 'opacity', 'class',
]);

/** Constructs that are never acceptable, checked before the structural pass so
 *  the error names the actual danger rather than an incidental tag mismatch. */
const FORBIDDEN = [
  [/<\s*script/i, '<script> — executes on insertion when rendered through JSX'],
  [/<\s*foreignObject/i, '<foreignObject> — arbitrary HTML inside the SVG'],
  [/<\s*image/i, '<image> — fetches an external resource from every visitor'],
  [/<\s*use\b/i, '<use> — dereferences a URL, including cross-document'],
  [/\son[a-z]+\s*=/i, 'an on* event handler attribute'],
  [/xlink:/i, 'an xlink: reference'],
  [/javascript:/i, 'a javascript: URL'],
  [/[{}]/, 'a brace — inside JSX this is an evaluated expression, not a character'],
];

export function assertSafeMarkup(file, inner) {
  for (const [pattern, why] of FORBIDDEN) {
    const hit = pattern.exec(inner);
    if (hit) {
      throw new Error(`${file} contains ${why}\n  at: ${excerpt(inner, hit.index)}`);
    }
  }

  for (const tag of inner.matchAll(/<\s*\/?\s*([a-zA-Z][\w:-]*)/g)) {
    if (!ALLOWED_TAGS.has(tag[1].toLowerCase())) {
      throw new Error(
        `${file} contains <${tag[1]}>, which is not one of: ${[...ALLOWED_TAGS].join(', ')}\n` +
          `  Add it here only after deciding it is safe to inline into the DOM.`
      );
    }
  }

  for (const attr of inner.matchAll(/\s([a-zA-Z][\w:-]*)\s*=\s*["']/g)) {
    if (!ALLOWED_ATTRS.has(attr[1].toLowerCase())) {
      throw new Error(`${file} carries the attribute "${attr[1]}", which is not on the allowlist.`);
    }
  }

  // ids are stripped from the markup, but url(#…) references are not — so a
  // gradient, mask, clip-path or filter would survive as a reference to a
  // definition that no longer exists and render as nothing, silently (review).
  const reference = /url\(\s*#([\w-]+)\s*\)/.exec(inner);
  if (reference) {
    throw new Error(
      `${file} references url(#${reference[1]}), but ids are stripped from the markup —\n` +
        `  the definition it points at will not exist and the mark will render blank.\n` +
        `  Flatten the gradient/mask/clip-path upstream, or teach this script to keep the id.`
    );
  }
}

function excerpt(s, at) {
  return JSON.stringify(s.slice(Math.max(0, at - 20), at + 60));
}


// ── Content bounds ──────────────────────────────────────────────────────────
// All three source marks carry the same wide canvas, so the icon rendered in a
// square slot scaled the whole thing down and left the swift letterboxed. The
// favicon squares its own viewBox, but the LogoIcon component did not.

// Walk an SVG path's commands and return the bounding box of every point it
// touches. Bezier control points are included rather than the true curve
// extrema: the curve lies inside the convex hull of its control points, so the
// box is conservative — it can be a hair generous, never clipping.
function pathBounds(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  let x = 0, y = 0, startX = 0, startY = 0, cmd = '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const see = (px, py) => {
    if (px < minX) minX = px; if (px > maxX) maxX = px;
    if (py < minY) minY = py; if (py > maxY) maxY = py;
  };
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(t)) { cmd = t; i++; }
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M': { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; startX = x; startY = y; see(x, y); cmd = rel ? 'l' : 'L'; break; }
      case 'L': { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; see(x, y); break; }
      case 'H': { const nx = num(); x = rel ? x + nx : nx; see(x, y); break; }
      case 'V': { const ny = num(); y = rel ? y + ny : ny; see(x, y); break; }
      case 'C': { for (let k = 0; k < 3; k++) { const cx = num(), cy = num(); const ax = rel ? x + cx : cx, ay = rel ? y + cy : cy; see(ax, ay); if (k === 2) { x = ax; y = ay; } } break; }
      case 'S': case 'Q': { for (let k = 0; k < 2; k++) { const cx = num(), cy = num(); const ax = rel ? x + cx : cx, ay = rel ? y + cy : cy; see(ax, ay); if (k === 1) { x = ax; y = ay; } } break; }
      case 'T': { const cx = num(), cy = num(); x = rel ? x + cx : cx; y = rel ? y + cy : cy; see(x, y); break; }
      case 'A': { num(); num(); num(); num(); num(); const cx = num(), cy = num(); x = rel ? x + cx : cx; y = rel ? y + cy : cy; see(x, y); break; }
      case 'Z': { x = startX; y = startY; break; }
      default: i++;
    }
  }
  return { minX, minY, maxX, maxY };
}


/** The box every path in this SVG actually occupies, with a little air. */
function contentBounds(raw) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of raw.matchAll(/\sd\s*=\s*["']([^"']+)["']/g)) {
    const b = pathBounds(d[1]);
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
  }
  if (!Number.isFinite(minX)) return null;
  const pad = Math.max(maxX - minX, maxY - minY) * 0.01;
  return {
    viewBox: [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2]
      .map((n) => Math.round(n * 100) / 100)
      .join(' '),
  };
}

const lockup = parse('lockup');
const wordmark = parse('wordmark');
const icon = parse('icon');

const VARIANTS = [
  ['LogoLockup', 'lockup', lockup, 'wordmark + swift — the attribution mark'],
  ['LogoWordmark', 'wordmark', wordmark, 'type only'],
  ['LogoIcon', 'icon', { ...icon, viewBox: icon.bounds?.viewBox ?? icon.viewBox }, 'the swift alone, cropped to its own extents'],
];

const component = `// GENERATED by scripts/gen-logo-component.mjs — do not hand-edit.
// Source: brand/logo/*.svg (see brand/logo/PROVENANCE.md).
// CI runs \`npm run logo:check\`, so an edit here fails the build.
//
// The marks use fill="currentColor", so they inherit the surrounding text
// colour. That is the whole mechanism: one file per variant is correct on both
// light and dark grounds with no switching logic, provided the SVG is INLINE.
// Rendering via <img> would break inheritance.
//
// Containment is option B (brand owner, 2026-08-02): the swift stands free in
// clear space, never inside a tile. Colour follows the surface, never the theme
// directly: Moonlight on dark grounds, Neverything on light. Never #fff/#000.
//
// One component per mark, rather than one component with a variant prop. A
// prop meant the bundler could not drop the two marks nothing renders — all
// three shipped on every page, twice inlined, for ~7 kB of which ~5 kB was
// dead (review L5/L6). Separate exports tree-shake.

interface LogoProps {
  className?: string;
  /** Accessible name. Pass null for decorative use alongside visible text. */
  title?: string | null;
}

${VARIANTS.map(([component, , mark, description]) => `/** ${description} */
export function ${component}({ className, title = 'JarvisTravel' }: LogoProps) {
  const decorative = title === null;
  return (
    <svg
      viewBox="${mark.viewBox}"
      fill="currentColor"
      className={className}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
      xmlns="http://www.w3.org/2000/svg"
    >
${mark.inner.split('\n').map((l) => '      ' + l.trim()).join('\n')}
    </svg>
  );
}`).join('\n\n')}
`;

// The favicon was a third hand-maintained copy of the swift, with the brand
// greys written out as literal hex — the same two values the @theme block in
// src/index.css already defines as gray-900/gray-50. The PR's own standard is
// that neither the mark nor the colours can drift, so it comes off the same
// source now (review M4).
const { ink, moonlight } = readBrandGreys();

// The swift is ~3.2:1 but a tab slot is square, so the viewBox is padded to a
// square with clear space around the mark rather than the mark being placed on
// a tile — containment option B. The padding is DERIVED from the source viewBox
// rather than written down, so a change to the mark's canvas cannot leave a
// stale offset behind.
const [vx, vy, vw, vh] = icon.viewBox.split(/[\s,]+/).map(Number);
const side = Math.max(vw, vh);
const offsetX = vx - (side - vw) / 2;
const offsetY = vy - (side - vh) / 2;

const favicon = `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by scripts/gen-logo-component.mjs — do not hand-edit. -->
<!-- Mark: brand/logo/jarvistravel-icon-current.svg. Colours: @theme in src/index.css. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${offsetX} ${offsetY} ${side} ${side}">
  <style>
    /* The tab strip follows the OS, not the page, so this is the one place the
       mark cannot inherit its colour from a surface it sits on. */
    .mark { fill: ${ink}; }
    @media (prefers-color-scheme: dark) { .mark { fill: ${moonlight}; } }
  </style>
  <g class="mark">
${icon.inner.split('\n').map((l) => '    ' + l.trim()).join('\n')}
  </g>
</svg>
`;

/**
 * Read the two brand greys out of the @theme block in src/index.css, so they
 * cannot drift. (JAR-2751: the source of truth moved here from
 * tailwind.config.js, which the Tailwind 3 -> 4 migration removed.)
 *
 * The v3 version grabbed the first bare `900:` in the file and found
 * `sky.900` — the palette declared above gray — painting the favicon navy
 * (found by looking at the generated output, not by any test). Matching the
 * full custom-property key `--color-gray-<token>` cannot repeat that: sky's
 * remap declares `--color-sky-900`, which never satisfies the pattern.
 */
function readBrandGreys() {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8');
  const grab = (token) => {
    const m = new RegExp(`--color-gray-${token}\\s*:\\s*(#[0-9a-fA-F]{3,8})`).exec(css);
    if (!m) throw new Error(`src/index.css @theme defines no gray.${token} — cannot colour the favicon.`);
    return m[1];
  };
  return { ink: grab(900), moonlight: grab(50) };
}

const outputs = [
  [OUT, component],
  [FAVICON, favicon],
];

if (check) {
  const stale = outputs.filter(([path, want]) => {
    const have = existsSync(path) ? readFileSync(path, 'utf8') : '';
    return have !== want;
  });
  if (stale.length > 0) {
    console.error('Generated files are out of date with brand/logo/:');
    for (const [path] of stale) console.error(`  ${path.replace(ROOT + '/', '')}`);
    console.error('\nRun: npm run logo:gen');
    process.exit(1);
  }
  console.log('logo: generated files match brand/logo/');
} else {
  for (const [path, contents] of outputs) {
    writeFileSync(path, contents);
    console.log(`wrote ${path.replace(ROOT + '/', '')} (${contents.length} bytes)`);
  }
  console.log(`viewBoxes: lockup=${lockup.viewBox} wordmark=${wordmark.viewBox} icon=${icon.viewBox}`);
}
