// ============================================================================
// JARVISTRAVEL - LINKS INTO THE APP (JAR-1184)
// The marketing site's one way of handing a visitor to app.jarvistravel.com.
// ============================================================================

import type { PriceLookupKey } from './pricing';

/**
 * Where the app lives.
 *
 * Overridable so a preview build can point at a staging app, with the
 * production origin as the default: this site is deployed from the same branch
 * that serves jarvistravel.com, and an unset variable must not silently produce
 * a link to nowhere.
 */
const RAW_ORIGIN = import.meta.env.VITE_APP_ORIGIN || 'https://app.jarvistravel.com';

// Validated at BUILD time by requireAppOrigin() in vite.config.ts, not here.
// This used to throw at module scope, which reads as fail-fast and is the
// opposite: Vite bundles this file, so the throw ran in the visitor's browser
// after a green build — every page white-screened and CI said nothing
// (review F2). The build-time guard catches the same value before deploy.
const APP_ORIGIN = RAW_ORIGIN;

/**
 * The app's sign-in screen, where a visitor signs in or starts a sign-up. Every
 * Join Now goes here (Brent, 2026-09-16, JAR-1692), so there is one entry into
 * the app to keep working. Links to it are plain anchors, not router Links:
 * this is a cross-origin navigation.
 */
export function appSignInUrl(): string {
  return `${APP_ORIGIN}/auth/sign-in`;
}

/**
 * The sign-in link for a chosen plan: the pricing page's Join Nows.
 *
 * The app captures `?plan=` on whatever screen a visitor lands on (App.tsx reads
 * it once, before anything else runs), so the choice survives sign-in or a new
 * sign-up and the app's selector arrives already set to it. It used to point at
 * sign-up; Brent moved every Join Now to sign-in on 2026-09-16 (JAR-1692), and
 * only the path changed.
 *
 * The lookup key is what crosses the boundary, never a plan id. Plan ids are
 * database rows in core; this site has no business knowing them, and they change
 * when the catalogue is re-minted. `PriceLookupKey` is already declared as the
 * shared contract in pricing.ts, and core's coupon-id guard covers the other
 * half of it.
 *
 * Deliberately NOT conditional on whether signup is currently open. The app owns
 * that decision through VITE_SELF_SIGNUP_ENABLED, and it already shows the Early
 * Access notice when signup is closed. Duplicating the flag here would create a
 * second answer to one question that drifts the first time only one is changed:
 * the site would keep sending people to a waitlist after signup opened, or into
 * a signup form after it closed. One flag, one owner.
 */
export function appJoinUrl(plan: PriceLookupKey): string {
  // The plan key is the WHOLE choice. The cadence is not a second argument:
  // jt_explore_annual and jt_explore_monthly are distinct PriceLookupKeys
  // (pricing.ts), so a visitor who picked Monthly arrives as
  // ?plan=jt_explore_monthly and nothing has to re-ask. An earlier version
  // also appended &cadence=annual|monthly and said the app read it. The app
  // never did (web-app reads only `plan`), so that parameter was dead on the
  // wire and the sentence describing it was false. Removed rather than
  // implemented on the app side: it would carry no information the key does
  // not already carry (marketing-website#46 review).
  return `${appSignInUrl()}?plan=${encodeURIComponent(plan)}`;
}
