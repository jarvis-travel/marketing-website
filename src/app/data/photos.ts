// ============================================================================
// JARVISTRAVEL MARKETING - UNSPLASH PHOTOGRAPHY
//
// The app reads photos from a core proxy at runtime; this site is static, with
// no backend and no authenticated origin to proxy through. So the same contract
// is met at BUILD time: scripts/fetch-unsplash-manifest.mjs holds the key in CI,
// registers the download Unsplash's terms require, and bakes the result into
// photoManifest.json. Nothing here ever sees a key, and there is nothing for a
// bundle to leak — scripts/check-no-unsplash-key-in-bundle.mjs proves that per
// build rather than asserting it here.
//
// AN EMPTY SLOT IS AN ORDINARY STATE, not a failure: a slot with no photo
// returns null, and its section renders the brand surface. That mirrors the
// app, where a null photo means "Unsplash had nothing, or the key is unset, or
// the budget is spent" and the answer to all three is the brand surface, which
// is a designed state rather than a fallback.
// ============================================================================

import manifest from './photoManifest.json';

export interface PhotoCreditLinks {
  name: string;
  profileUrl: string;
  unsplashUrl: string;
}

export interface SitePhoto {
  url: string;
  alt: string;
  credit: PhotoCreditLinks;
}

/** http(s) only, parsed rather than pattern-matched.
 *
 *  Ported from the app's safeUrl, narrowed to the one shape this site needs.
 *  These values arrive from a JSON file written by a script that talked to a
 *  third party, so they are data, not trusted markup: a `javascript:` value
 *  reaching an href executes on click, and `//evil.com` navigates off-site
 *  without any dangerous scheme at all. Parsing catches both, along with the
 *  casing and whitespace tricks a regex has to be written carefully to refuse.
 */
function httpUrlOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A photo, or null when it cannot be rendered WITH ITS CREDIT.
 *
 *  THE DROP IS THE POINT, and it is the app's rule verbatim: the two credit
 *  links are checked as strictly as the photo URL, and a failure in either one
 *  drops the whole photo rather than rendering it bare. Unsplash's terms are
 *  not "show a photo, and a credit where convenient" — an unattributable photo
 *  is one we may not display, so the only safe failure is not to.
 */
function toPhoto(raw: unknown): SitePhoto | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const credit = (r.credit ?? null) as Record<string, unknown> | null;
  if (!credit || typeof credit.name !== 'string' || credit.name.trim() === '') return null;

  const url = httpUrlOrNull(r.url);
  const profileUrl = httpUrlOrNull(credit.profileUrl);
  const unsplashUrl = httpUrlOrNull(credit.unsplashUrl);
  if (!url || !profileUrl || !unsplashUrl) return null;

  // alt is ours, not Unsplash's: a description of what the photo shows, for
  // someone who cannot see it. Never a disclaimer about the image being an
  // image — the marketing copy rules forbid "photo of…" narration.
  const alt = typeof r.alt === 'string' ? r.alt : '';

  return { url, alt, credit: { name: credit.name, profileUrl, unsplashUrl } };
}

const slots = (manifest as { slots?: Record<string, unknown> }).slots ?? {};

/** The photo for a named slot, or null. Null renders the brand surface. */
export function photoFor(slot: string): SitePhoto | null {
  return toPhoto(slots[slot]);
}

/** Exported for the tests, which need to exercise the drop rule against shapes
 *  the committed manifest deliberately does not contain. */
export const __testing = { toPhoto, httpUrlOrNull };
