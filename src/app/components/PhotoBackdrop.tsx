// ============================================================================
// JARVISTRAVEL MARKETING - PHOTO BACKDROP
//
// A photograph behind a banded section, with its credit. THE TWO ARE ONE
// COMPONENT on purpose: Unsplash's terms make the attribution a condition of
// displaying the photo, so there is deliberately no way to render the image
// here and put the credit somewhere else — or forget it. A caller gets both or
// neither.
//
// It wraps the band's content, so the credit comes after that content in
// reading and tab order. A slot with no photo renders the content alone: the
// section keeps its brand colour and its contour motif.
// ============================================================================

import type { ReactNode } from 'react';
import { photoFor } from '../data/photos';
import { PhotoCredit } from './PhotoCredit';

interface PhotoBackdropProps {
  /** A slot declared in scripts/fetch-unsplash-manifest.mjs. */
  slot: string;
  /** The band's content, which the photo sits behind and the credit follows. */
  children: ReactNode;
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

export function PhotoBackdrop({ slot, children }: PhotoBackdropProps) {
  const photo = photoFor(slot);
  if (!photo) return <>{children}</>;

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
          its own backdrop is worse than a band with no backdrop. 70% because
          the photos have bright skies and white facades, and over white the
          band's lead text needs that much to clear 4.5:1. */}
      <div className="absolute inset-0 bg-sky-900/70" aria-hidden="true" />
      {children}
      {/* After the content, so the credit's links come after it in reading and
          tab order; it's positioned over the photo either way. */}
      <PhotoCredit photo={photo} variant="overlay" className="absolute bottom-2 right-3 z-10" />
    </>
  );
}
