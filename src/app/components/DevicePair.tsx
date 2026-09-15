// ============================================================================
// JARVISTRAVEL MARKETING - DEVICE PAIR
//
// One app screen at desktop and at phone size. The phone sits in front, lower
// left, overlapping the desktop screen behind it. Both are flat captures with
// no bezel and no tilt.
//
// ONE DEPTH CUE, ON THE PHONE ONLY: a soft shadow with a real offset, tinted
// toward the navy. An earlier version separated the two with a thick keyline
// in the ground colour; a zero-offset coloured ring reads as a border drawn
// around the phone, not as the phone sitting in front, and Brent found it
// jarring (2026-09-14).
//
// Phones get the phone capture alone. Two screens squeezed into 360px are two
// screens nobody can read.
//
// NO VISIBLE CAPTION. The alt says what the screen shows, for screen readers;
// a caption announcing "a screenshot of the app" is the disclaimer the copy
// rules forbid (jarvistravel-copy rule 8). It is read once: the phone in front
// of the desktop is the same screen, so that copy carries an empty alt.
// ============================================================================

import type { AppCaptureImage } from '../data/appCaptures';

interface DevicePairProps {
  image: AppCaptureImage;
  /** What the screen shows, in the site's voice. */
  alt: string;
  /** The navy ledge or the light page: sets the shadow's strength and whether the desktop needs an edge. */
  ground: 'plane' | 'page';
  /** The desktop screen's rendered width, for the browser's srcset pick. */
  sizes: string;
}

const PHONE_SIZES = '(min-width: 1024px) 240px, 26vw';

const PHONE_DEPTH = {
  // On navy the shadow only reads where the phone crosses the light desktop
  // screen, so it can be deep without looking heavy.
  plane: 'shadow-[0_28px_56px_-20px_rgba(4,16,30,0.6)]',
  page: 'shadow-[0_24px_48px_-18px_rgba(14,42,71,0.32)]',
};

export function DevicePair({ image, alt, ground, sizes }: DevicePairProps) {
  // A ring, not a border: it takes no layout space, so the aspect ratios the
  // composition is built on stay exact. Only the light page needs it, to keep
  // the desktop screen's edge against a background of nearly the same tone.
  const desktopEdge = ground === 'page' ? 'ring-1 ring-gray-200' : '';

  return (
    <>
      {/* Below `sm`: the phone screen alone, carrying the description. */}
      <picture className="sm:hidden">
        <source type="image/webp" srcSet={image.phone} sizes="300px" />
        <img
          src={image.fallback}
          alt={alt}
          width={390}
          height={844}
          loading="lazy"
          decoding="async"
          className={`mx-auto block h-auto w-full max-w-[300px] rounded-[18px] ${PHONE_DEPTH[ground]}`}
        />
      </picture>

      {/* The desktop screen is inset from the left so the phone can overlap
          its corner, and the padding below leaves room for the phone to sit
          lower than the desktop's bottom edge. */}
      <div className="relative hidden sm:block pl-[14%] pt-[3%] pb-[6%]">
        <picture>
          <source type="image/webp" srcSet={image.desktop} sizes={sizes} />
          <img
            src={image.fallback}
            alt={alt}
            width={1440}
            height={900}
            loading="lazy"
            decoding="async"
            className={`block h-auto w-full rounded-[14px] ${desktopEdge}`}
          />
        </picture>
        <picture>
          <source type="image/webp" srcSet={image.phone} sizes={PHONE_SIZES} />
          <img
            src={image.fallback}
            alt=""
            aria-hidden="true"
            width={390}
            height={844}
            loading="lazy"
            decoding="async"
            className={`absolute bottom-0 left-0 block h-auto w-[26%] rounded-[18px] ${PHONE_DEPTH[ground]}`}
          />
        </picture>
      </div>
    </>
  );
}
