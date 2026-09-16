// Single source of truth for per-route page metadata.
//
// Every marketing route shares one static <head> in index.html, so without
// this map each page reports the home page's title, description, canonical and
// social-card tags. useRouteMeta() reads this on navigation and updates the
// document head. A future build-time prerender step reads the same map to emit
// static per-route HTML for scrapers that do not run JavaScript.
//
// Copy follows the jarvistravel-copy voice: benefit-led, plain speak, no
// booking lexicon, no em dashes, written as if the app is live.

/** Canonical origin for the marketing site. No trailing slash. */
export const SITE_ORIGIN = 'https://jarvistravel.com';

/** Shared social card until per-route cards exist. */
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-card.png`;

export interface RouteMeta {
  /** Document title and og/twitter title. */
  title: string;
  /** Meta description and og/twitter description. Aim for under ~160 chars. */
  description: string;
}

// Keyed by pathname with no trailing slash (root is '/').
export const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: 'JarvisTravel: your vacation should be a break, not a second job',
    description:
      'JarvisTravel plans the pace, the budget and the map of your trip in one place, so your vacation feels like a break, not a second job.',
  },
  '/features': {
    title: 'How JarvisTravel works: one plan for the pace, budget and map',
    description:
      'See how Jarvis paces each day, keeps the budget inside the plan, and maps your whole trip, so the tough days show up while you can still fix them.',
  },
  '/pricing': {
    title: 'JarvisTravel pricing: Trip Pass and Explore',
    description:
      'Pick the plan that fits the way you travel. Trip Pass for a single journey, Explore for travelers who go more than once a year.',
  },
  '/about': {
    title: 'About JarvisTravel: why we built it',
    description:
      'We started JarvisTravel because planning a trip had turned into a second job. Here is what we are building, and how we run it.',
  },
  '/contact': {
    title: 'Contact JarvisTravel',
    description:
      'Reach the JarvisTravel team with a question, a press request, or a privacy note. Or join now and start planning your next trip.',
  },
  '/privacy': {
    title: 'Privacy Policy: JarvisTravel',
    description:
      'How JarvisTravel handles your data: what we collect, what we do not sell, and the choices that stay yours.',
  },
  '/terms': {
    title: 'Terms of Service: JarvisTravel',
    description: 'The terms that govern your use of JarvisTravel.',
  },
  '/data-security': {
    title: 'Data Security: JarvisTravel',
    description:
      'How JarvisTravel protects your account and the details of your trips.',
  },
};

/** Strip a trailing slash so '/features/' and '/features' resolve the same.
 *  The root path stays '/'. */
export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/** Meta for a path, falling back to the home entry (unknown paths redirect to
 *  '/' in the router, so this fallback is a safety net, not a real 404 page). */
export function resolveRouteMeta(pathname: string): RouteMeta {
  return ROUTE_META[normalizePath(pathname)] ?? ROUTE_META['/'];
}

/** Absolute canonical URL for a path. Root keeps its trailing slash to match
 *  the value already baked into index.html. */
export function canonicalUrl(pathname: string): string {
  const path = normalizePath(pathname);
  return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}
