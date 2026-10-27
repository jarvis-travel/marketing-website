import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { priceOf, periodOf, annualSavingPercent, earlyAccessPriceOf, earlyAccessSavingPercent, type PriceLookupKey } from '../data/pricing';
import { appJoinUrl, appSignInUrl } from '../data/appLink';

// Approved offer structure (pricing handoff, 2026-07): exactly two offers.
// Trip Pass is a real single-trip product, not a trial. Explore is the hero
// offer; Annual and Monthly are billing cadences of ONE subscription, never
// separate tiers. Quarterly is deliberately not shown (brand-owner call,
// JAR-430). No future tiers. Bullet copy follows the handoff's card language,
// except the Explore Annual line, which carries the offer below, and the Trip
// Pass bullets, which Brent rewrote in the 2026-10-23 copy review (JAR-3557);
// that first bullet no longer says the product takes the trip for you.
//
// The one offer on the page is Brent's: on 2026-10-14 he asked for the regular
// annual price struck through, with the Early Access price beside it "for a
// limited time" (JAR-3180). All users get the Early Access coupon for now, and
// it comes off the first year only, so wherever the annual price appears it
// says "first year" and what it renews at. Monthly and Trip Pass are unchanged.
//
// The highlight travels (brand-owner direction): exactly one card wears the
// Ateneo treatment at a time. Explore holds it by default; while the visitor
// hovers or keyboard-focuses Trip Pass, the highlight shifts there and
// Explore goes quiet; it shifts back the moment they leave. One boolean
// drives both cards, so exactly one solid amber action is visible at any
// moment. Touch devices keep the default (Explore highlighted).

const TRIP_PASS_POINTS = [
  'Everything you need to plan one trip',
  'Your trip journal stays with you after the trip',
  'Good for travelers who have one trip in mind right now',
];

// Derived from the generated blocks, so neither can disagree with the amounts
// rendered beside them. SAVING_PCT compares the REGULAR annual price with paying
// monthly, so the bullet attaches it to the price Explore Annual renews at. The
// badge sits beside the first-year price, so while the offer runs it shows what
// that first year saves (Brent, 2026-10-14, JAR-3180).
const SAVING_PCT = annualSavingPercent();
const BADGE_PCT = earlyAccessPriceOf('jt_explore_annual') ? earlyAccessSavingPercent() : SAVING_PCT;

/**
 * A regular price, struck through. Screen readers mostly do not announce a
 * strike, so the struck amount is labelled in words: otherwise "$99 $79" is
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

const ANNUAL: PriceLookupKey = 'jt_explore_annual';
const ANNUAL_OFFER = earlyAccessPriceOf(ANNUAL);
const ANNUAL_RATE = `${priceOf(ANNUAL)} per ${periodOf(ANNUAL)}${
  SAVING_PCT !== null ? `, ${SAVING_PCT}% less than paying monthly` : ''
}`;

const EXPLORE_POINTS: { key: string; text: ReactNode }[] = [
  {
    key: 'annual',
    text: ANNUAL_OFFER ? (
      <>
        Explore Annual renews at {ANNUAL_RATE}.
      </>
    ) : (
      `Explore Annual is ${ANNUAL_RATE}`
    ),
  },
];

type CadenceKey = 'annual' | 'monthly';

interface Cadence {
  key: CadenceKey;
  label: string;
  // The Stripe lookup key, not a rendered string. Carrying a pre-formatted
  // amount meant CadenceKey and PriceLookupKey were parallel namespaces with
  // nothing tying them together, so a new cadence pointing at the wrong key
  // would compile cleanly and render a wrong price — the exact failure this
  // ticket exists to kill, one level up (core#36 review, M4). Typed this way,
  // a mismatch is a compile error.
  lookupKey: PriceLookupKey;
  best?: boolean;
}

// Cadences of ONE subscription, not separate tiers. Amounts come from
// src/app/data/pricing.ts, which mirrors Stripe by lookup key — a price change
// there reaches this page with no edit here (JAR-660). The rendered period
// ("per year"/"per month") is derived from the interval via periodOf(), never
// a parallel string (review deleg_dd2f886e).
const CADENCES: Cadence[] = [
  { key: 'annual', label: 'Annual', lookupKey: 'jt_explore_annual', best: true },
  { key: 'monthly', label: 'Monthly', lookupKey: 'jt_explore_monthly' },
];

// The two visual states a card can be in. Both keep a 1px border so nothing
// shifts when the highlight moves; the hero border matches its own ground.
const heroCard = 'bg-sky-600 border-sky-600';
const quietCard = 'bg-white border-gray-200';

// The same two states for each card's action. One of the two is always quiet, and
// it is the first a visitor sees, so it still has to read as an action.
// There is deliberately no quiet hover: entering a card moves the highlight to it,
// so the pointer turns the action amber before it reaches the button.
const heroAction = 'bg-amber-400 border-amber-400 text-gray-900 hover:bg-amber-300 hover:border-amber-300';
const quietAction = 'bg-transparent border-sky-600 text-sky-600';

export function PricingPage() {
  const [cadenceKey, setCadenceKey] = useState<CadenceKey>('annual');
  const cadence = CADENCES.find((c) => c.key === cadenceKey) ?? CADENCES[0];
  // The first-year price when the selected cadence has one (Annual), else null.
  const offer = earlyAccessPriceOf(cadence.lookupKey);

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
              <div className="mb-2 [font-variant-numeric:tabular-nums]">
                <span
                  className={`text-4xl font-bold transition-colors ${
                    tripActive ? 'text-gray-50' : 'text-gray-900'
                  }`}
                >
                  {priceOf('jt_trip_pass')}
                </span>
                <span
                  className={`ml-2 transition-colors ${
                    tripActive ? 'text-sky-200' : 'text-gray-500'
                  }`}
                >
                  per trip
                </span>
              </div>
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
                  would try to resolve it as an internal route. Whether signup is
                  open is the app's call, not this site's. */}
              <a
                href={appJoinUrl('jt_trip_pass')}
                className={`self-start px-8 py-3.5 rounded-xs font-semibold border transition-colors ${
                  tripActive ? heroAction : quietAction
                }`}
              >
                Start planning
              </a>
            </div>

            {/* Explore - the hero offer; holds the highlight unless Trip Pass
                has the visitor's attention. Entering Explore reclaims the
                highlight directly (not only via Trip Pass's mouseleave), so
                the shift back is immediate and robust. */}
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

              {/* Billing cadence - two ways to pay for the same subscription. */}
              <div
                role="group"
                aria-label="Explore billing options"
                className="grid gap-2 mb-6"
              >
                {CADENCES.map((option) => {
                  const selected = cadenceKey === option.key;
                  const optionOffer = earlyAccessPriceOf(option.lookupKey);
                  // Both states give a clear hover fill (Meridian sky tints),
                  // so the unselected cadence responds when the visitor moves
                  // over it - not just a border change.
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
                        {/* On the white card the badge sits on the selected option's
                            navy tint, which darkens its ground; its own white keeps
                            the 11px label readable. */}
                        {option.best && BADGE_PCT !== null && (
                          <span
                            className={`text-[11px] font-semibold tracking-wide uppercase border px-2 py-0.5 rounded-xs transition-colors ${
                              exploreHot
                                ? 'text-amber-400 bg-amber-400/[0.12] border-amber-400/30'
                                : 'text-amber-700 bg-white border-amber-700/40'
                            }`}
                          >
                            Save {BADGE_PCT}%
                          </span>
                        )}
                      </span>
                      {/* ml-auto keeps the price on the right when a narrow
                          screen wraps it under the label. */}
                      <span
                        className={`ml-auto text-right [font-variant-numeric:tabular-nums] transition-colors ${
                          exploreHot ? 'text-sky-100' : 'text-gray-600'
                        }`}
                      >
                        {optionOffer ? (
                          <>
                            <Struck>{priceOf(option.lookupKey)}</Struck> {optionOffer}
                            <span
                              className={`transition-colors ${
                                exploreHot ? 'text-sky-200' : 'text-gray-500'
                              }`}
                            >
                              {' '}first {periodOf(option.lookupKey)}
                            </span>
                            <span
                              className={`block text-xs transition-colors ${
                                exploreHot ? 'text-sky-200' : 'text-gray-500'
                              }`}
                            >
                              then {priceOf(option.lookupKey)}/{periodOf(option.lookupKey)}
                            </span>
                          </>
                        ) : (
                          <>
                            {priceOf(option.lookupKey)}
                            <span
                              className={`transition-colors ${
                                exploreHot ? 'text-sky-200' : 'text-gray-500'
                              }`}
                            >
                              /{periodOf(option.lookupKey)}
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mb-6 [font-variant-numeric:tabular-nums]">
                {offer && (
                  <span
                    className={`mr-2 text-2xl font-semibold transition-colors ${
                      exploreHot ? 'text-sky-200' : 'text-gray-500'
                    }`}
                  >
                    {/* A real space, not only the margin: without one the two
                        amounts reach a screen reader as one run, "$99$79". */}
                    <Struck>{priceOf(cadence.lookupKey)}</Struck>{' '}
                  </span>
                )}
                <span
                  className={`text-4xl font-bold transition-colors ${
                    exploreHot ? 'text-gray-50' : 'text-gray-900'
                  }`}
                >
                  {offer ?? priceOf(cadence.lookupKey)}
                </span>
                <span
                  className={`ml-2 transition-colors ${
                    exploreHot ? 'text-sky-200' : 'text-gray-500'
                  }`}
                >
                  {offer ? 'first' : 'per'} {periodOf(cadence.lookupKey)}
                </span>
                {offer && (
                  <p
                    className={`mt-2 text-sm transition-colors ${
                      exploreHot ? 'text-sky-100' : 'text-gray-600'
                    }`}
                  >
                    For a limited time. Renews at {priceOf(cadence.lookupKey)} per{' '}
                    {periodOf(cadence.lookupKey)}.
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {EXPLORE_POINTS.map(({ key, text }) => (
                  <li key={key} className="flex items-start gap-3">
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
                      {text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Carries whichever cadence the visitor selected above, so the
                  choice they just made survives into checkout instead of being
                  asked for a second time. */}
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
