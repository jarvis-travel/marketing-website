// ============================================================================
// JARVISTRAVEL MARKETING - APP CAPTURE
//
// A real screen of the app, flat and frameless: no device bezel, no tilt, no
// shadow (NINE's "ledge"). Phones get the phone capture and wider screens the
// desktop one, because a 1440px screen scaled to a phone's width has text too
// small to read.
//
// NO VISIBLE CAPTION. The alt says what the screen shows, for screen readers;
// a caption announcing "a screenshot of the app" is the disclaimer the copy
// rules forbid (jarvistravel-copy rule 8).
// ============================================================================

import type { AppCaptureImage } from '../data/appCaptures';

/** Below Tailwind's `sm` breakpoint. */
const PHONE = '(max-width: 639px)';

interface AppCaptureProps {
  image: AppCaptureImage;
  /** What the screen shows, in the site's voice. */
  alt: string;
  /** The desktop capture's rendered width, for the browser's srcset pick. */
  sizes: string;
  className?: string;
}

export function AppCapture({ image, alt, sizes, className = '' }: AppCaptureProps) {
  return (
    <picture>
      {/* Each source carries its own dimensions, so the space is reserved at
          the right shape before the image loads, on phones and desktops alike. */}
      <source media={PHONE} type="image/webp" srcSet={image.phone} sizes="300px" width={390} height={844} />
      <source type="image/webp" srcSet={image.desktop} sizes={sizes} width={1440} height={900} />
      <img
        src={image.fallback}
        alt={alt}
        width={1440}
        height={900}
        loading="lazy"
        decoding="async"
        className={`block h-auto w-full max-w-[300px] mx-auto sm:max-w-none rounded-[14px] ${className}`}
      />
    </picture>
  );
}
