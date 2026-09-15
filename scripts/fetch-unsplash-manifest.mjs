#!/usr/bin/env node
// Bake the marketing site's photography into a static manifest.
//
// The app proxies Unsplash through core at runtime, which this site cannot do:
// /v1/images/search sits behind authMiddleware with no CORS for a cross-origin
// static host. So the same contract is met at build time. This script holds the
// key, in CI only; the site reads only what this writes.
//
// RUN:  UNSPLASH_ACCESS_KEY=… node scripts/fetch-unsplash-manifest.mjs
//       (add --dry-run to see what it would fetch without calling anything)
//
// It refuses to run without a key rather than writing an empty manifest, so a
// CI run whose secret is missing FAILS instead of silently shipping a site with
// the photography quietly removed. An empty manifest is a legitimate committed
// state; an empty manifest produced by a broken run is not, and the two are
// indistinguishable afterwards.

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, '..', 'src', 'app', 'data', 'photoManifest.json');

const API = 'https://api.unsplash.com';
const UTM_SOURCE = 'jarvistravel';
const UTM_MEDIUM = 'referral';

// THE SLOTS ARE DECLARED HERE, not discovered, and each names the query that
// fills it. A slot the site does not render is dead weight; a slot the site
// renders with no entry here renders the brand surface, which is a designed
// state (see src/app/data/photos.ts).
//
// The queries encode the art direction JAR-647 settled on — golden hour, a
// person in a place rather than a posed subject, somewhere recognisably
// travelled-to. `orientation` matches the shape of the slot so the crop is not
// doing the composition's work.
//
// NO FACES. The marketing asset gate forbids recognisable faces in site
// imagery, and a query alone cannot enforce that — whoever regenerates this
// manifest has to LOOK at the result. That is why the chosen photo ids are
// committed rather than re-picked on every build: the curation is a human act,
// reviewed once, and this script re-fetches the SAME photos to refresh their
// URLs and re-register the downloads.
const SLOTS = [
  { slot: 'home.hero', query: 'golden hour coastal travel landscape', orientation: 'landscape' },
  { slot: 'home.planning', query: 'traveller planning map table', orientation: 'landscape' },
];

const key = (process.env.UNSPLASH_ACCESS_KEY || '').trim();
const dryRun = process.argv.includes('--dry-run');

if (!key && !dryRun) {
  console.error(
    'fetch-unsplash-manifest: UNSPLASH_ACCESS_KEY is not set.\n' +
    '\n' +
    'Refusing to write a manifest rather than writing an empty one: a CI run\n' +
    'with a missing secret would otherwise ship a site with the photography\n' +
    'silently removed, and the result is indistinguishable from a deliberate\n' +
    'empty manifest afterwards.\n' +
    '\n' +
    'The key is a CI secret on this repository. It must never be committed,\n' +
    'never be read through import.meta.env, and never appear in dist/ —\n' +
    'scripts/check-no-unsplash-key-in-bundle.mjs enforces the last of those.',
  );
  process.exit(2);
}

/** Add our utm parameters to a link Unsplash gave us, the way core does. */
function withUtm(raw) {
  try {
    const u = new URL(raw);
    u.searchParams.set('utm_source', UTM_SOURCE);
    u.searchParams.set('utm_medium', UTM_MEDIUM);
    return u.toString();
  } catch {
    return null;
  }
}

async function api(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

/** Register the download Unsplash's terms require whenever a photo is USED.
 *
 *  THE URL COMES OUT OF A RESPONSE, and a response is data, not an instruction
 *  about where to send our credentials. Every request here carries the access
 *  key in an Authorization header, so following a response-supplied URL blindly
 *  would hand the key to whoever wrote that response. Only the API host we are
 *  configured to talk to is allowed — the same refusal core's TriggerDownload
 *  makes, for the same reason.
 */
async function triggerDownload(downloadLocation) {
  if (!downloadLocation) return false;
  let u;
  try { u = new URL(downloadLocation); } catch { return false; }
  const base = new URL(API);
  if (u.protocol !== base.protocol || u.host !== base.host) {
    console.error(`  refused a download_location outside ${base.host}: ${u.host}`);
    return false;
  }
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  });
  return res.ok;
}

const existing = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const out = { generatedAt: new Date().toISOString(), slots: {} };

for (const { slot, query, orientation } of SLOTS) {
  const pinned = existing.slots?.[slot]?.photoId;
  if (dryRun) {
    console.log(`  ${slot}: ${pinned ? `refresh pinned photo ${pinned}` : `search "${query}" (${orientation})`}`);
    continue;
  }

  // A pinned id is re-fetched rather than re-searched. The curation — which
  // photo, and whether it has a face in it — was a human decision; a build that
  // silently swapped the picture would put an unreviewed image on the site.
  const photo = pinned
    ? await api(`/photos/${encodeURIComponent(pinned)}`)
    : (await api(`/search/photos?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=1&content_filter=high`)).results?.[0];

  if (!photo) { console.error(`  ${slot}: no photo found — leaving it unset`); continue; }

  const registered = await triggerDownload(photo.links?.download_location);
  if (!registered) {
    // Unsplash's terms make the download ping a condition of USE, so a photo we
    // could not register is a photo we may not ship.
    console.error(`  ${slot}: could not register the download — dropping the photo rather than using it unregistered`);
    continue;
  }

  const profileUrl = withUtm(photo.user?.links?.html);
  const unsplashUrl = withUtm(photo.links?.html);
  const name = photo.user?.name;
  if (!name || !profileUrl || !unsplashUrl || !photo.urls?.regular) {
    console.error(`  ${slot}: incomplete attribution — dropping the photo`);
    continue;
  }

  out.slots[slot] = {
    photoId: photo.id,
    url: photo.urls.regular,
    // Kept from the existing manifest when it has one: alt text is ours to
    // write, describing what the photo shows. Unsplash's own description is a
    // caption, not a description for someone who cannot see it.
    alt: existing.slots?.[slot]?.alt || '',
    credit: { name, profileUrl, unsplashUrl },
  };
  console.log(`  ${slot}: ${photo.id} by ${name}`);
}

if (dryRun) { console.log('\ndry run — nothing fetched, nothing written'); process.exit(0); }

writeFileSync(MANIFEST, `${JSON.stringify(out, null, 2)}\n`);
console.log(`\nwrote ${Object.keys(out.slots).length} slot(s) to src/app/data/photoManifest.json`);
