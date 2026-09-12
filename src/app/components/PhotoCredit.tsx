// ============================================================================
// JARVISTRAVEL MARKETING - PHOTO CREDIT
//
// Ported from the app's PhotoCredit. Unsplash requires that wherever one of
// their photos appears we credit both the photographer and Unsplash, each
// linking back, each carrying our utm parameters. The links arrive already
// built, from the manifest, so a caller cannot render a photo with the
// attribution half-done.
//
// Renders nothing without a credit, which is also the "no photo" case: the
// brand surface is ours and needs no attribution.
// ============================================================================

import type { SitePhoto } from '../data/photos';

interface PhotoCreditProps {
  photo: SitePhoto | null;
  /** `overlay` sits over a photograph and carries its own shadow; `inline`
   *  sits on a solid surface and takes the muted text colour. */
  variant?: 'inline' | 'overlay';
  className?: string;
}

export function PhotoCredit({ photo, variant = 'inline', className = '' }: PhotoCreditProps) {
  if (!photo?.credit?.name) return null;

  const { name, profileUrl, unsplashUrl } = photo.credit;
  const overlay = variant === 'overlay';
  const tone = overlay
    ? 'text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]'
    : 'text-slate-500';
  const link = overlay ? 'text-white hover:text-white' : 'text-slate-500 hover:text-slate-900';

  return (
    <p className={`text-[11px] leading-tight ${tone} ${className}`}>
      Photo{' '}
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${link} underline underline-offset-2 transition-colors`}
      >
        {name}
      </a>{' '}
      /{' '}
      <a
        href={unsplashUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${link} underline underline-offset-2 transition-colors`}
      >
        Unsplash
      </a>
    </p>
  );
}
