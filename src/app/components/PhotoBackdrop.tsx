// ============================================================================
// JARVISTRAVEL MARKETING - PHOTO BACKDROP
//
// A photograph behind a banded section, with its credit. THE TWO ARE ONE
// COMPONENT on purpose: Unsplash's terms make the attribution a condition of
// displaying the photo, so there is deliberately no way to render the image
// here and put the credit somewhere else — or forget it. A caller gets both or
// neither.
//
// Neither is the shipped state today. photoFor() returns null for every slot
// until CI regenerates the manifest with a key, and null renders nothing at
// all: the section keeps its brand colour and its contour motif, which is the
// design it has now rather than a fallback for a missing image.
// ============================================================================

import { photoFor } from '../data/photos';
import { PhotoCredit } from './PhotoCredit';

interface PhotoBackdropProps {
  /** A slot declared in scripts/fetch-unsplash-manifest.mjs. */
  slot: string;
  /** Tailwind colour for the scrim that keeps the headline legible. */
  scrim?: string;
}

/** The same hotlinked photo at wider sizes, so a full-bleed band stays sharp on a
 *  large or high-density screen. Only `w` changes: the ixid that carries the
 *  view back to the photographer stays on every candidate. */
function widerSizes(url: string): string | undefined {
  try {
    return [1080, 1600, 2400]
      .map((w) => {
        const u = new URL(url);
        u.searchParams.set('w', String(w));
        return `${u.toString()} ${w}w`;
      })
      .join(', ');
  } catch {
    // A manifest URL that doesn't parse gets no srcset; the img still has its src.
    return undefined;
  }
}

export function PhotoBackdrop({ slot, scrim = 'bg-sky-900/55' }: PhotoBackdropProps) {
  const photo = photoFor(slot);
  if (!photo) return null;

  return (
    <>
      <img
        src={photo.url}
        srcSet={widerSizes(photo.url)}
        sizes="100vw"
        // EMPTY ALT, DELIBERATELY. This photograph sits behind a headline that
        // already says everything the section means; the image carries no
        // information a screen reader would otherwise miss. An alt here could
        // only describe the decoration, and narrating decoration is the
        // disclaimer-caption habit the copy rules forbid. Empty alt is the
        // correct, standards-backed way to say "decorative".
        alt=""
        aria-hidden="true"
        // Loaded lazily and decoded off the main thread: this is decoration and
        // must never delay the headline it sits behind.
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* The scrim is what makes the copy legible over an arbitrary photograph,
          so it is not optional styling — a band whose text is unreadable over
          its own backdrop is worse than a band with no backdrop. */}
      <div className={`absolute inset-0 ${scrim}`} aria-hidden="true" />
      <PhotoCredit photo={photo} variant="overlay" className="absolute bottom-2 right-3 z-10" />
    </>
  );
}
