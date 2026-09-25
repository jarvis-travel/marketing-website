import { useState } from 'react';
import {
  BookOpen,
  CloudSun,
  Map as MapIcon,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { appSignInUrl } from '../data/appLink';
import { PhotoBackdrop } from '../components/PhotoBackdrop';
import { FI_BANDS } from '../data/fatigueIndex';
import { DevicePair } from '../components/DevicePair';
import { TRIP_HOME } from '../data/appCaptures';
import type { LucideIcon } from 'lucide-react';

// Home (JAR-431). Benefit-led story per the jarvistravel-copy voice skill:
// what a traveler misses without JarvisTravel and what planning wrong costs.
// The Fatigue Index deep-dive lives on /features; FI appears here only as a
// benefit, in the app's band words (chill, balanced, packed) since raw
// numbers mean nothing to a first-time visitor. Digits appear only on the
// How it works explainer. No em dashes anywhere (brand rule).
//
// The hero rotates: one of five approved headline pairs is picked per visit,
// so two visitors may see different messaging (lightweight A/B signal).
// The pick is client-side; if prerendering lands (plan phase 3), move the
// pick to a post-hydration effect to avoid a server/client mismatch.

interface Hero {
  headline: string;
  sub: string;
}

const HEROES: Hero[] = [
  {
    headline: 'Your vacation should be a break, not a second job.',
    sub: 'JarvisTravel plans the pace, the budget and the map in one place, so the trip you take feels like the trip you imagined.',
  },
  {
    headline: 'Travel smarter, not harder.',
    sub: 'One plan for the days, the money and the memories. Jarvis does the homework; you take the trip.',
  },
  {
    headline: 'Leave room for the good part.',
    sub: 'Jarvis plans the pace, the budget and the map together, so your days keep room for the moments you didn’t plan.',
  },
  {
    headline: 'Come home with stories, not exhaustion.',
    sub: 'Jarvis rates every day of your plan as chill, balanced, or packed, so the tough ones show up before you do.',
  },
  {
    headline: 'Some days should be slow.',
    sub: 'Jarvis rates each day chill, balanced or packed while you plan, so the busy ones don’t pile up.',
  },
];

/** The hero photograph rotates like the headline, one city per visit. Each slot
 *  is pinned to a reviewed photo in scripts/fetch-unsplash-manifest.mjs. */
const HERO_PHOTO_SLOTS = [
  'home.hero.rome',
  'home.hero.new-york',
  'home.hero.paris',
  'home.hero.sydney',
  'home.hero.lisbon',
];

interface Feature {
  icon: LucideIcon;
  name: string;
  desc: string;
  voice: 'accent' | 'journal';
}

// Shipped features only, written as benefits. Icons follow the app's row
// recipe. Coral belongs to the journal and appears nowhere else.
const FEATURES: Feature[] = [
  {
    icon: Sparkles,
    name: 'Trip planning',
    desc: 'Jarvis drafts your days around your pace and the daylight you actually have. You decide; it does the homework.',
    voice: 'accent',
  },
  {
    icon: TrendingUp,
    name: 'The Fatigue Index',
    desc: 'Every day is rated chill, balanced, or packed before you commit, so the tough days show up while you can still fix them.',
    voice: 'accent',
  },
  {
    icon: Wallet,
    name: 'Budget',
    desc: 'Totals that move while you plan, not a surprise after you land back home.',
    voice: 'accent',
  },
  {
    icon: BookOpen,
    name: 'Trip journal',
    desc: 'Notes, photos, receipts and places become a story worth rereading. Yours to keep.',
    voice: 'journal',
  },
  {
    icon: MapIcon,
    name: 'The map',
    desc: 'Your whole trip on one map, numbered by day, with the walk between stops visible.',
    voice: 'accent',
  },
  {
    icon: CloudSun,
    name: 'Weather & flights',
    desc: 'The forecast and your flights sit inside the plan. Fewer surprises, fewer tabs.',
    voice: 'accent',
  },
];

/** Concentric contour rings, the Meridian motif: Moonlight at 13% on navy.
 *  pointer-events-none so the overlay can never intercept clicks on content. */
function ContourArcs({ className }: { className: string }) {
  return (
    <svg
      className={`pointer-events-none ${className}`}
      viewBox="0 0 520 520"
      fill="none"
      aria-hidden="true"
    >
      {[130, 170, 210, 250].map((r) => (
        <circle
          key={r}
          cx="260"
          cy="260"
          r={r}
          stroke="#F0EEEB"
          strokeOpacity="0.13"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

export function HomePage() {
  // Picked once per mount so the message is stable while the visitor reads.
  const [hero] = useState<Hero>(
    () => HEROES[Math.floor(Math.random() * HEROES.length)]
  );
  const [heroPhotoSlot] = useState(
    () => HERO_PHOTO_SLOTS[Math.floor(Math.random() * HERO_PHOTO_SLOTS.length)]
  );
  return (
    <div>
      {/* Hero: the story, not the mechanics. */}
      <section className="relative overflow-hidden bg-sky-600">
        <PhotoBackdrop slot={heroPhotoSlot}>
          <ContourArcs className="absolute -top-44 -left-44 w-[520px] h-[520px]" />
          <ContourArcs className="absolute -bottom-56 -right-40 w-[520px] h-[520px]" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 md:pt-44 md:pb-32 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-50 leading-tight [text-wrap:balance] mb-6">
              {hero.headline}
            </h1>
            <p className="text-lg md:text-xl text-sky-100 leading-relaxed max-w-2xl mx-auto mb-10">
              {hero.sub}
            </p>
            <a
              href={appSignInUrl()}
              className="inline-block px-8 py-4 bg-amber-400 text-gray-900 rounded-sm font-semibold hover:bg-amber-300 transition-colors"
            >
              Join Now
            </a>
          </div>
        </PhotoBackdrop>
      </section>

      {/* The cost of planning wrong: what you miss without it. */}
      <section className="bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-6">
            The trip you waited a year for shouldn&rsquo;t wear you out by
            Tuesday.
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed max-w-xl [text-wrap:pretty] mb-6">
            A shared spreadsheet will get you a plan. What it won&rsquo;t tell
            you is that day 2 has six hours of walking after a red-eye, or that
            the museum, the market and the dinner across town won&rsquo;t fit in
            one afternoon. That&rsquo;s how you come home needing a vacation from
            the vacation.
          </p>
          <p className="text-lg text-gray-600 leading-relaxed max-w-xl [text-wrap:pretty] mb-6">
            So Jarvis rates every day while you build it: chill, balanced, or
            packed. A packed day shows up before you&rsquo;re standing in it,
            with a lighter version one tap away.
          </p>
          {/* The three band words, as the Fatigue Index's visual on Home: no
              digits here, since the scale is explained on How it works. The
              sentence above already says them, so screen readers skip the
              chips. Patent pending sits with the feature it describes, never as
              a site-wide badge, and comes down if the filing lapses. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-8">
            <div className="flex gap-2" aria-hidden="true">
              {FI_BANDS.map((band) => (
                <span
                  key={band.word}
                  style={{ color: band.tone.ink, backgroundColor: `${band.tone.color}1A` }}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                >
                  {band.word}
                </span>
              ))}
            </div>
            <p className="text-sm font-medium text-gray-500">Patent pending</p>
          </div>
          <Link
            to="/features"
            className="font-medium text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700 transition-colors"
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* Every trip counts, as a full-bleed editorial band over its photograph.
          A slot with no photo keeps the plain navy band and its motif. */}
      <section className="relative overflow-hidden bg-sky-600 min-h-[46vh] flex items-center">
        <PhotoBackdrop slot="home.planning">
          <ContourArcs className="absolute -top-40 -left-40 w-[520px] h-[520px]" />
          <ContourArcs className="absolute -bottom-52 -right-36 w-[520px] h-[520px]" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-50 [text-wrap:balance] mb-6">
              Not just the big trip.
            </h2>
            <p className="text-lg md:text-xl text-sky-100 leading-relaxed max-w-2xl">
              A long weekend, a staycation, two weeks abroad, a road trip an hour
              from home. Jarvis plans them all: the pace, the budget, the map, the
              memories.
            </p>
          </div>
        </PhotoBackdrop>
      </section>

      {/* What you get: the product, in benefit language. */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-4">
              One plan, not twelve tabs.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Everything that makes a trip work, and everything you&rsquo;d
              rather not juggle, in one place.
            </p>
          </div>
          {/* The claim, shown: the app's own trip screen, the phone in front of the desktop, on a solid plane. */}
          <div className="relative overflow-hidden rounded-[20px] bg-sky-600 p-4 sm:p-6 md:p-8 mb-12">
            <ContourArcs className="absolute -bottom-56 -right-40 w-[520px] h-[520px]" />
            <div className="relative">
              <DevicePair
                image={TRIP_HOME}
                alt="A trip's home screen for a week in Rome: today's schedule, what is left of the budget, and the week's pacing, with two days running packed."
                ground="plane"
                sizes={{ desktop: '(min-width: 1152px) 860px, 80vw', phone: '(min-width: 1152px) 260px, 24vw' }}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.name}
                  className="bg-gray-50 border border-gray-200 rounded-[14px] p-6"
                >
                  <span
                    className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${
                      feature.voice === 'journal'
                        ? 'bg-coral-600/10 text-coral-600'
                        : 'bg-sky-600/10 text-sky-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold text-gray-900 mb-2">{feature.name}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why you can trust the plan: no catches, in plain speak. */}
      <section className="bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-10">
            No catches.
          </h2>
          <ul className="border-t border-gray-200">
            <li className="py-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Nobody pays to be in your plan.
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Every suggestion is there because it fits your trip, never
                because a hotel or tour paid us.
              </p>
            </li>
            <li className="py-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No ads.
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Your plan doesn&rsquo;t need billboards.
              </p>
            </li>
            <li className="py-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Your memories belong to you.
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Your journal is yours: the notes, the photos, the places. We
                do not sell it.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* The invitation. */}
      <section className="relative overflow-hidden bg-slate-900">
        <ContourArcs className="absolute -top-40 -left-48 w-[520px] h-[520px]" />
        <ContourArcs className="absolute -bottom-52 -right-44 w-[520px] h-[520px]" />
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-50 [text-wrap:balance] mb-4">
            Enjoy Your Vacation.
          </h2>
          <p className="text-lg text-sky-100 mb-10">
            Planning is hard. Jarvis does the heavy lifting.
          </p>
          <a
            href={appSignInUrl()}
            className="inline-block px-10 py-4 bg-amber-400 text-gray-900 rounded-sm font-semibold hover:bg-amber-300 transition-colors"
          >
            Join Now
          </a>
        </div>
      </section>
    </div>
  );
}
