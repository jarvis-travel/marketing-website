// ============================================================================
// JARVISTRAVEL MARKETING - DEVICE PAIR
//
// One app screen at desktop and at phone size, side by side and the same
// height. Flat and frameless (NINE's ledge): no bezel, no tilt, no shadow.
//
// Phones get the phone capture alone. Two screens squeezed into 360px are two
// screens nobody can read.
//
// NO VISIBLE CAPTION. The alt says what the screen shows, for screen readers;
// a caption announcing "a screenshot of the app" is the disclaimer the copy
// rules forbid (jarvistravel-copy rule 8). It is read once: the phone beside
// the desktop is the same screen, so that copy carries an empty alt.
// ============================================================================

import type { AppCaptureImage } from '../data/appCaptures';

interface DevicePairProps {
  image: AppCaptureImage;
  /** What the screen shows, in the site's voice. */
  alt: string;
  /** The navy ledge needs no edge; on the light page a hairline keeps the screens' shape. */
  ground: 'plane' | 'page';
  /** The desktop screen's rendered width, for the browser's srcset pick. */
  sizes: string;
}

const PHONE_SIZES = '(min-width: 1024px) 220px, 22vw';

export function DevicePair({ image, alt, ground, sizes }: DevicePairProps) {
  // A ring, not a border: a border adds 2px to each box, which is 2.2x more
  // height on the tall phone than on the wide desktop, and the pair stops
  // lining up (measured 301px against 298px). A ring takes no layout space.
  const edge = ground === 'page' ? 'ring-1 ring-gray-200' : '';

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
          className={`mx-auto block h-auto w-full max-w-[300px] rounded-[18px] ${edge}`}
        />
      </picture>

      {/* Column widths in the two aspect ratios (1440:900 and 390:844), so both
          screens come out the same height. */}
      <div className="hidden sm:grid grid-cols-[1.6fr_0.462fr] items-end gap-4 lg:gap-6">
        <picture>
          <source type="image/webp" srcSet={image.desktop} sizes={sizes} />
          <img
            src={image.fallback}
            alt={alt}
            width={1440}
            height={900}
            loading="lazy"
            decoding="async"
            className={`block h-auto w-full rounded-[14px] ${edge}`}
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
            className={`block h-auto w-full rounded-[18px] ${edge}`}
          />
        </picture>
      </div>
    </>
  );
}
