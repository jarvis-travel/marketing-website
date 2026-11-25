import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { parsePricesFeed, offerIsLive, formatMoney as money, savingPercent as savingPct, type PlanPrice, type PricesFeed } from '../data/pricesFeed';
import type { PriceLookupKey } from '../data/pricing';
import { appJoinUrl, appSignInUrl } from '../data/appLink';

// Approved offer structure (pricing handoff, 2026-07): exactly two offers.
// Trip Pass is a real single-trip product, not a trial. Explore is the hero
// offer; Annual and Monthly are billing cadences of ONE subscription, never
// separate tiers. Quarterly is deliberately not shown (brand-owner call,
// JAR-430). No future tiers. Bullet copy follows the handoff's card language.
//
// The one offer on the page is Brent's: the regular annual ($99) struck through,
// with the November first year ($29.99) beside it, then the $59.99 renewal,
// ending Nov 30 (JAR-3180, carried into the Nov 2026 launch, Brent 2026-11-10).
//
// WHERE THE AMOUNTS COME FROM (JAR-4286). The page no longer imports a typed
// amount from pricing.ts. It reads /prices.json at runtime — core's prices,
// mirrored through jarvistravel.com's own nginx cache (JAR-4285), so one change
// in Stripe reaches the site with no release. The body is untrusted and
// validated (parsePricesFeed); on ANY failure (a miss, a 503, the SPA's
// index.html before core ships, a schema drift) the feed is null and the page
// shows every plan WITHOUT amounts. Never a typed fallback price. The offer
// plan is self-contained: amount_cents the renewal, first_year_cents the first
// year, regular_cents the struck $99, offer_ends_at the clock.
//
// The highlight travels (brand-owner direction): exactly one card wears the
// Ateneo treatment at a time. Explore holds it by default; while the visitor
// hovers or keyboard-focuses Trip Pass, the highlight shifts there and Explore
// goes quiet; it shifts back the moment they leave. One boolean drives both
// cards. Touch devices keep the default (Explore highlighted).

const TRIP_PASS_POINTS = [
  'Everything you need to plan one trip',
  'Your trip journal stays with you after the trip',
  'Good for travelers who have one trip in mind right now',
];

// The lookup keys this page renders. Mirrors contracts/stripe-lookup-keys.json
// (which check-lookup-keys.mjs keeps in sync with pricing.ts). Typed as
// PriceLookupKey so a key that leaves the shared contract is a compile error.
// This is the validator's allow-list: a feed carrying any other key is rejected
// whole, which is the fail-closed behaviour we want — a new plan is a conscious
// edit to this page and core (JAR-4285) together.
const TRIP_PASS: PriceLookupKey = 'jt_trip_pass';
const ANNUAL: PriceLookupKey = 'jt_explore_annual';
const ANNUAL_OFFER: PriceLookupKey = 'jt_explore_annual_nov2026';
const MONTHLY: PriceLookupKey = 'jt_explore_monthly';
const ALLOWED_KEYS: Set<string> = new Set<PriceLookupKey>([TRIP_PASS, ANNUAL, ANNUAL_OFFER, MONTHLY]);

type CadenceKey = 'annual' | 'monthly';

interface Cadence {
  key: CadenceKey;
  label: string;
  // The Stripe lookup key, not a rendered amount. It is what the Start-planning
  // link carries (appJoinUrl), and core resolves the November offer and coupon
  // at checkout from it — the site links to the regular annual key either way.
  lookupKey: PriceLookupKey;
  best?: boolean;
}

const CADENCES: Cadence[] = [
  { key: 'annual', label: 'Annual', lookupKey: ANNUAL, best: true },
  { key: 'monthly', label: 'Monthly', lookupKey: MONTHLY },
];

// The two visual states a card can be in. Both keep a 1px border so nothing
// shifts when the highlight moves; the hero border matches its own ground.
const heroCard = 'bg-sky-600 border-sky-600';
const quietCard = 'bg-white border-gray-200';

// The same two states for each card's action. One of the two is always quiet, and
// it is the first a visitor sees, so it still has to read as an action.
const heroAction = 'bg-amber-400 border-amber-400 text-gray-900 hover:bg-amber-300 hover:border-amber-300';
const quietAction = 'bg-transparent border-sky-600 text-sky-600';

// money() and savingPct() are the feed's own formatter and saving math, imported
// from pricesFeed (pure, node-tested) so the page stays a thin consumer.
const PERIOD: Record<PlanPrice['interval'], string> = { year: 'year', month: 'month', one_time: 'trip' };

// What one cadence renders as an amount. 'none' = the feed has no price for it,
// so the card shows the plan without a price (never a fallback amount).
type AmountVM =
  | { kind: 'none' }
  | { kind: 'plain'; amount: string; period: string }
  | { kind: 'offer'; struck: string; first: string; firstPeriod: string; renewal: string; renewalPeriod: string };

/**
 * A regular price, struck through. Screen readers mostly do not announce a
 * strike, so the struck amount is labelled in words: otherwise "$99 $29.99" is
 * read as two prices with nothing to say which one is charged.
 */
function Struck({ children }: { children: string }) {
  return (
    <>
      <span className="sr-only">Regular price </span>
      <s>{children}</s>
    </>
  );
}

export function PricingPage() {
  // The validated price feed, or null until it loads (and whenever it fails).
  // Null renders the page with no amounts, which is the safe default, so a
  // never-resolving or rejected fetch simply shows the plans without prices.
  const [feed, setFeed] = useState<PricesFeed | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    // 5s ceiling: a hung request must not hold the page in its no-amount state
    // forever on a flaky network; abort resolves the fetch as a failure (null).
    const timer = setTimeout(() => ctrl.abort(), 5000);
    // Same origin (jarvistravel.com's own nginx), no cookie, no custom header —
    // the browser never talks to core (JAR-4285). A non-200, a non-JSON body
    // (the SPA index.html before core ships), an abort, or a schema mismatch all
    // land as null via the catch / the validator.
    fetch('/prices.json', { credentials: 'omit', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => setFeed(raw == null ? null : parsePricesFeed(raw, ALLOWED_KEYS)))
      .catch(() => setFeed(null))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  // Freeze "now" at mount so the offer can't flip mid-visit; the offer ends on
  // this clock, not on the cache, so a stale cached body still goes dark on time.
  const now = useMemo(() => new Date(), []);
  const byKey = useMemo(
    () => new Map<string, PlanPrice>((feed?.plans ?? []).map((p) => [p.lookupKey, p])),
    [feed],
  );
  const plan = (k: PriceLookupKey): PlanPrice | undefined => byKey.get(k);

  const monthly = plan(MONTHLY);
  const annualRegular = plan(ANNUAL);
  const annualOffer = plan(ANNUAL_OFFER);
  // The offer shows only when its plan is present, carries the struck/first
  // amounts, and the clock has not passed offer_ends_at.
  const offerLive =
    !!annualOffer &&
    annualOffer.firstYearCents !== null &&
    annualOffer.regularCents !== null &&
    offerIsLive(annualOffer.offerEndsAt, now);

  // One source for both the cadence row and the hero block, so they never show
  // different amounts for the same cadence.
  const amountFor = (key: CadenceKey): AmountVM => {
    if (key === 'monthly') {
      return monthly ? { kind: 'plain', amount: money(monthly.amountCents), period: PERIOD[monthly.interval] } : { kind: 'none' };
    }
    if (offerLive && annualOffer) {
      return {
        kind: 'offer',
        struck: money(annualOffer.regularCents as number),
        first: money(annualOffer.firstYearCents as number),
        firstPeriod: PERIOD[annualOffer.interval],
        renewal: money(annualOffer.amountCents),
        renewalPeriod: PERIOD[annualOffer.interval],
      };
    }
    return annualRegular
      ? { kind: 'plain', amount: money(annualRegular.amountCents), period: PERIOD[annualRegular.interval] }
      : { kind: 'none' };
  };

  // The badge percent for the Annual cadence: off the $59.99 renewal while the
  // offer runs (58%), off the regular $99 once it ends (31%). Null (no badge)
  // when there is no monthly amount to compare against, or no annual amount yet.
  const badgePct = offerLive && annualOffer
    ? savingPct(annualOffer.amountCents, monthly?.amountCents)
    : annualRegular
      ? savingPct(annualRegular.amountCents, monthly?.amountCents)
      : null;

  // "Ends Nov 30", formatted by the page from the validated instant in Pacific
  // time (the offer ends 2026-12-01T07:59Z = Nov 30, 11:59pm PT; JAR-4283).
  const endsText =
    offerLive && annualOffer?.offerEndsAt
      ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(
          new Date(annualOffer.offerEndsAt),
        )
      : '';

  // The Explore Annual bullet, amount-aware: the renewal line while the offer
  // runs, the plain annual rate once it ends, and an amount-free line when the
  // feed carries no price (jarvistravel-copy: present tense, no number invented).
  const annualBullet = offerLive && annualOffer
    ? `Explore Annual renews at ${money(annualOffer.amountCents)} per ${PERIOD[annualOffer.interval]}${
        badgePct !== null ? `, ${badgePct}% less than paying monthly` : ''
      }.`
    : annualRegular
      ? `Explore Annual is ${money(annualRegular.amountCents)} per ${PERIOD[annualRegular.interval]}${
          badgePct !== null ? `, ${badgePct}% less than paying monthly` : ''
        }.`
      : 'Explore Annual renews once a year.';

  const tripPass = plan(TRIP_PASS);

  const [cadenceKey, setCadenceKey] = useState<CadenceKey>('annual');
  const cadence = CADENCES.find((c) => c.key === cadenceKey) ?? CADENCES[0];
  const heroAmount = amountFor(cadence.key);

  // True while the visitor is over (or keyboard-focused inside) Trip Pass.
  const [tripActive, setTripActive] = useState(false);
  const exploreHot = !tripActive;

  return (
    <div className="pt-24">
      {/* Header - flat Ateneo band. */}
      <section className="bg-sky-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-400 mb-6">
            Pricing
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-50 leading-tight [text-wrap:balance] max-w-3xl mb-6">
            Pick the plan that fits the way you travel.
          </h1>
          <p className="text-lg text-sky-100 max-w-xl leading-relaxed [text-wrap:pretty]">
            Trip Pass covers one trip, start to finish. Explore covers every
            trip, all year.
          </p>
        </div>
      </section>

      {/* The two offers - Moonlight ground, one traveling highlight. */}
      <section className="bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="grid md:grid-cols-5 gap-6 items-stretch">
            {/* Trip Pass - the entry offer. */}
            <div
              onMouseEnter={() => setTripActive(true)}
              onMouseLeave={() => setTripActive(false)}
              onFocusCapture={() => setTripActive(true)}
              onBlurCapture={() => setTripActive(false)}
              className={`md:col-span-2 border rounded-[14px] p-8 flex flex-col transition-colors duration-200 ${
                tripActive ? heroCard : quietCard
              }`}
            >
              <h2
                className={`text-[11px] font-semibold tracking-[0.14em] uppercase mb-4 transition-colors ${
                  tripActive ? 'text-amber-400' : 'text-amber-700'
                }`}
              >
                Trip Pass
              </h2>
              {/* The amount line shows only when the feed has a Trip Pass price;
                  without it the card still reads its name, its one-line promise,
                  its bullets and Start planning (no fallback amount). */}
              {tripPass && (
                <div className="mb-2 [font-variant-numeric:tabular-nums]">
                  <span
                    className={`text-4xl font-bold transition-colors ${
                      tripActive ? 'text-gray-50' : 'text-gray-900'
                    }`}
                  >
                    {money(tripPass.amountCents)}
                  </span>
                  <span
                    className={`ml-2 transition-colors ${
                      tripActive ? 'text-sky-200' : 'text-gray-500'
                    }`}
                  >
                    per {PERIOD[tripPass.interval]}
                  </span>
                </div>
              )}
              <p
                className={`text-lg font-semibold mb-6 transition-colors ${
                  tripActive ? 'text-gray-50' : 'text-gray-900'
                }`}
              >
                One trip, one payment, no subscription.
              </p>
              <ul className="space-y-3 mb-8">
                {TRIP_PASS_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <Check
                      className={`w-4 h-4 shrink-0 mt-1 transition-colors ${
                        tripActive ? 'text-sky-300' : 'text-sky-600'
                      }`}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span
                      className={`transition-colors ${
                        tripActive ? 'text-sky-100' : 'text-gray-600'
                      }`}
                    >
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
              {/* Into the app with the plan already chosen. A plain anchor, not a
                  router Link: this is a cross-origin navigation and react-router
                  would try to resolve it as an internal route. The link carries a
                  local lookup key, never anything from the feed. */}
              <a
                href={appJoinUrl(TRIP_PASS)}
                className={`self-start px-8 py-3.5 rounded-xs font-semibold border transition-colors ${
                  tripActive ? heroAction : quietAction
                }`}
              >
                Start planning
              </a>
            </div>

            {/* Explore - the hero offer; holds the highlight unless Trip Pass
                has the visitor's attention. */}
            <div
              onMouseEnter={() => setTripActive(false)}
              onFocusCapture={() => setTripActive(false)}
              className={`md:col-span-3 border rounded-[14px] p-8 flex flex-col transition-colors duration-200 ${
                exploreHot ? heroCard : quietCard
              }`}
            >
              <h2
                className={`text-[11px] font-semibold tracking-[0.14em] uppercase mb-4 transition-colors ${
                  exploreHot ? 'text-amber-400' : 'text-amber-700'
                }`}
              >
                Explore
              </h2>
              <p
                className={`text-lg font-semibold mb-6 transition-colors ${
                  exploreHot ? 'text-gray-50' : 'text-gray-900'
                }`}
              >
                For travelers who take more than one trip a year.
              </p>

              {/* Billing cadence - two ways to pay for the same subscription.
                  Selectable even when the feed carries no amounts: the choice
                  drives the Start-planning link, not just the displayed price. */}
              <div
                role="group"
                aria-label="Explore billing options"
                className="grid gap-2 mb-6"
              >
                {CADENCES.map((option) => {
                  const selected = cadenceKey === option.key;
                  const vm = amountFor(option.key);
                  const rowClass = exploreHot
                    ? selected
                      ? 'border-sky-300 bg-sky-500/30'
                      : 'border-sky-400 bg-sky-500/0 hover:border-sky-300 hover:bg-sky-500/20'
                    : selected
                      ? 'border-sky-600 bg-sky-600/10'
                      : 'border-gray-300 bg-sky-600/0 hover:border-sky-600 hover:bg-sky-600/[0.06]';
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCadenceKey(option.key)}
                      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-left transition-colors ${rowClass}`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`font-medium transition-colors ${
                            exploreHot ? 'text-gray-50' : 'text-gray-900'
                          }`}
                        >
                          {option.label}
                        </span>
                        {option.best && badgePct !== null && (
                          <span
                            className={`text-[11px] font-semibold tracking-wide uppercase border px-2 py-0.5 rounded-xs transition-colors ${
                              exploreHot
                                ? 'text-amber-400 bg-amber-400/[0.12] border-amber-400/30'
                                : 'text-amber-700 bg-white border-amber-700/40'
                            }`}
                          >
                            Save {badgePct}%
                          </span>
                        )}
                      </span>
                      {/* ml-auto keeps the price on the right when a narrow
                          screen wraps it under the label. Omitted entirely when
                          the feed has no amount for this cadence. */}
                      {vm.kind !== 'none' && (
                        <span
                          className={`ml-auto text-right [font-variant-numeric:tabular-nums] transition-colors ${
                            exploreHot ? 'text-sky-100' : 'text-gray-600'
                          }`}
                        >
                          {vm.kind === 'offer' ? (
                            <>
                              <Struck>{vm.struck}</Struck> {vm.first}
                              <span
                                className={`transition-colors ${
                                  exploreHot ? 'text-sky-200' : 'text-gray-500'
                                }`}
                              >
                                {' '}first {vm.firstPeriod}
                              </span>
                              <span
                                className={`block text-xs transition-colors ${
                                  exploreHot ? 'text-sky-200' : 'text-gray-500'
                                }`}
                              >
                                then {vm.renewal}/{vm.renewalPeriod}
                              </span>
                            </>
                          ) : (
                            <>
                              {vm.amount}
                              <span
                                className={`transition-colors ${
                                  exploreHot ? 'text-sky-200' : 'text-gray-500'
                                }`}
                              >
                                /{vm.period}
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* The selected cadence's headline amount. Omitted whole when the
                  feed has no price for it. */}
              {heroAmount.kind !== 'none' && (
                <div className="mb-6 [font-variant-numeric:tabular-nums]">
                  {heroAmount.kind === 'offer' && (
                    <span
                      className={`mr-2 text-2xl font-semibold transition-colors ${
                        exploreHot ? 'text-sky-200' : 'text-gray-500'
                      }`}
                    >
                      {/* A real space, not only the margin: without one the two
                          amounts reach a screen reader as one run, "$99$29.99". */}
                      <Struck>{heroAmount.struck}</Struck>{' '}
                    </span>
                  )}
                  <span
                    className={`text-4xl font-bold transition-colors ${
                      exploreHot ? 'text-gray-50' : 'text-gray-900'
                    }`}
                  >
                    {heroAmount.kind === 'offer' ? heroAmount.first : heroAmount.amount}
                  </span>
                  <span
                    className={`ml-2 transition-colors ${
                      exploreHot ? 'text-sky-200' : 'text-gray-500'
                    }`}
                  >
                    {heroAmount.kind === 'offer'
                      ? `first ${heroAmount.firstPeriod}`
                      : `per ${heroAmount.period}`}
                  </span>
                  {heroAmount.kind === 'offer' && (
                    <p
                      className={`mt-2 text-sm transition-colors ${
                        exploreHot ? 'text-sky-100' : 'text-gray-600'
                      }`}
                    >
                      Then {heroAmount.renewal} per {heroAmount.renewalPeriod} until
                      you cancel.{endsText ? ` Ends ${endsText}.` : ''}
                    </p>
                  )}
                </div>
              )}

              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <Check
                    className={`w-4 h-4 shrink-0 mt-1 transition-colors ${
                      exploreHot ? 'text-sky-300' : 'text-sky-600'
                    }`}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span
                    className={`transition-colors ${
                      exploreHot ? 'text-sky-100' : 'text-gray-600'
                    }`}
                  >
                    {annualBullet}
                  </span>
                </li>
              </ul>

              {/* Carries whichever cadence the visitor selected above, so the
                  choice they just made survives into checkout. A local lookup
                  key, never anything from the feed. */}
              <a
                href={appJoinUrl(cadence.lookupKey)}
                className={`mt-auto w-full py-3.5 rounded-xs font-semibold text-center border transition-colors ${
                  exploreHot ? heroAction : quietAction
                }`}
              >
                Start planning
              </a>
            </div>
          </div>

          {/* The site's way back in for people who already have an account. */}
          <div className="max-w-2xl mx-auto text-center mt-14">
            <p className="text-gray-900 font-medium">
              Already have an account?{' '}
              <a
                href={appSignInUrl()}
                className="text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Home's "No app to download." section, in other words, since the site
          says a line once (JAR-3583). */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-4">
            Nothing to download.
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed max-w-xl mx-auto [text-wrap:pretty]">
            Both plans work in your browser, on your phone or your computer, with
            nothing to install.
          </p>
        </div>
      </section>
    </div>
  );
}
