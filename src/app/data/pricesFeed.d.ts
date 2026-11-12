// Types for pricesFeed.mjs (JAR-4286). The module is authored as a dependency-
// free ES module so the node test harness (scripts/__tests__/prices-feed.test.mjs)
// can import it directly; this declaration lets the TS page import it typed.

/** One validated, normalized plan from /prices.json. Absent optional fields
 *  come back as null. Amounts are integer cents. */
export interface PlanPrice {
  lookupKey: string;
  amountCents: number;
  /** First-year amount while the offer is on; null otherwise. Always < amountCents. */
  firstYearCents: number | null;
  /** The struck regular amount shown beside the offer; null when absent. */
  regularCents: number | null;
  currency: 'usd';
  interval: 'month' | 'year' | 'one_time';
  /** ISO-8601 instant the offer ends, or null. */
  offerEndsAt: string | null;
}

export interface PricesFeed {
  plans: PlanPrice[];
}

/** Validate an untrusted /prices.json body. Returns the normalized feed, or null
 *  for anything that is not exactly a well-formed price list (page shows no amounts). */
export function parsePricesFeed(raw: unknown, allowedKeys: Set<string>): PricesFeed | null;

/** Is the offer still on at `now`? True only when `offerEndsAt` is a valid ISO
 *  instant strictly in the future. */
export function offerIsLive(offerEndsAt: string | null, now: Date): boolean;
