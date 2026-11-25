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
import { appJoinUrl } from '../data/appLink';
import { PhotoBackdrop } from '../components/PhotoBackdrop';
import { ContourArcs } from '../components/ContourArcs';
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
    sub: 'Jarvis rates each day chill, balanced, or packed while you plan, so the busy ones don’t pile up.',
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
    desc: 'Jarvis drafts your days around your pace. You make the calls.',
    voice: 'accent',
  },
  {
    icon: TrendingUp,
    name: 'The Fatigue Index',
    desc: 'The tough days show up while you’re still planning, when they’re easy to fix.',
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
    desc: 'The story of your trip, built from what you did and what you spent, to look back on long after.',
    voice: 'journal',
  },
  {
    icon: MapIcon,
    name: 'The map',
    desc: 'Your whole trip on one map, numbered by day, so you can see how each day fits together.',
    voice: 'accent',
  },
  {
    icon: CloudSun,
    name: 'Weather & flights',
    desc: 'The forecast and your flights sit inside the plan, so a rainy day or a late flight shows up where you’re already looking.',
    voice: 'accent',
  },
];

// Who it's for, told as trips (JAR-4464): the family trip lead first. Each one
// rests on a shipped feature: sharing a trip (ShareModal), the journal, and a
// flight in the plan.
const MOMENTS = [
  {
    name: 'Thanksgiving with the kids.',
    desc: 'Share the plan with everyone who’s coming, so the whole family knows what’s next and where to be.',
  },
  {
    name: 'A weekend away for two.',
    desc: 'A slow morning, one great dinner at 7:30 PM, and a journal that keeps the trip once you’re home.',
  },
  {
    name: 'A work trip with a free afternoon.',
    desc: 'The meetings end at 3:00 PM and the flight leaves at 8:00 PM. Add the flight, and plan the hours in between around it.',
  },
];

// The four promises (JAR-4464): the three from "No catches." as they read on
// main, and "No app to download" folded in from its own section (JAR-3583).
const PROMISES = [
  {
    name: 'Nobody pays to be in your plan.',
    desc: 'Every suggestion is there because it fits your trip, not because a hotel or tour paid us.',
  },
  { name: 'No ads.', desc: 'Your plan doesn’t need billboards.' },
  {
    name: 'Your memories belong to you.',
    desc: 'Your journal is yours: the notes, the receipts, the places. We don’t sell it.',
  },
  {
    name: 'No app to download.',
    desc: 'It runs in your browser, with the same plan on your phone, laptop and tablet. Add it to your home screen and it opens like an app.',
  },
];

// Where AI is and isn't in the app (JAR-4464, carrying JAR-4295; Brent,
// 2026-11-12: AI is one part of a full planning app). From Hill's code audit
// (core 2f3c972a, web-app aa4d919a): chat, the trip brief and planning runs,
// receipt scan and stay details use AI; the Fatigue Index, budget, map, weather
// and flights don't. Stay details are Firecrawl's model, not Jarvis, which is
// why the list says "AI" and makes no "only Jarvis" claim.
const AI_IS = [
  'Drafting your days',
  'Answering your questions in chat',
  'Reading a receipt photo into your budget',
  'Filling in details about where you’re staying',
];
const AI_ISNT = [
  'Rating each day chill, balanced or packed',
  'Adding up your budget',
  'Drawing your map',
  'Showing your weather and flights',
];

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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-x-8 gap-y-5">
              <a
                href={appJoinUrl()}
                className="inline-block px-8 py-4 bg-amber-400 text-gray-900 rounded-xs font-semibold hover:bg-amber-300 transition-colors"
              >
                Start planning
              </a>
              <Link
                to="/pricing"
                className="font-medium text-gray-50 underline underline-offset-4 decoration-1 hover:text-sky-100 transition-colors"
              >
                See plans and pricing
              </Link>
            </div>
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
          {/* The re-plan (JAR-4464): the flight-day banner (FlightDayBanner, JAR-3105)
              and the weather one (WeatherRebalanceBanner, JAR-2726) both offer the
              change and wait for the tap. No claim about how fast a delay shows up. */}
          <p className="text-lg text-gray-600 leading-relaxed max-w-xl [text-wrap:pretty] mb-6">
            When the trip changes, the plan can change with it. Flight running
            late? Jarvis offers to re-plan the day around it. Rain on your day
            outside? It offers to move that stop to a better day.
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
              from home. Jarvis plans each one the same way.
            </p>
          </div>
        </PhotoBackdrop>
      </section>

      {/* Who it's for, as three trips. */}
      <section className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] max-w-2xl mb-10">
            Whoever you&rsquo;re traveling with.
          </h2>
          <ul className="grid md:grid-cols-3 gap-6">
            {MOMENTS.map((moment) => (
              <li key={moment.name} className="bg-white border border-gray-200 rounded-[14px] p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{moment.name}</h3>
                <p className="text-gray-600 leading-relaxed">{moment.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What you get: the product, in benefit language. */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-4">
              One plan, not twelve tabs.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              The days, the money, the map and the journal, together.
            </p>
          </div>
          {/* The claim, shown: the app's own trip screen, the phone in front of the desktop, on a solid plane. */}
          <div className="relative overflow-hidden rounded-[20px] bg-sky-600 p-4 sm:p-6 md:p-8 mb-12">
            <ContourArcs className="absolute -bottom-56 -right-40 w-[520px] h-[520px]" />
            <div className="relative">
              <DevicePair
                image={TRIP_HOME}
                alt="A trip's home screen for a week in Rome: today's schedule, what is left of the budget, and the week's pacing, with three days running heavy and a nudge that a lighter day would help after two packed days in a row."
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

      {/* Why you can trust the plan, as one section (JAR-4464; Brent, 2026-11-16: the
          AI, No catches and No app sections stacked up). Four promises side by
          side, then where AI is and isn't in the app, in plain words. "No app to
          download" joins the promises; it had a section of its own (JAR-3583). */}
      <section className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-10">
            No catches.
          </h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 mb-12">
            {PROMISES.map((promise) => (
              <li key={promise.name} className="border-t border-gray-300 pt-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{promise.name}</h3>
                <p className="text-gray-600 leading-relaxed">{promise.desc}</p>
              </li>
            ))}
          </ul>
          <div className="bg-white border border-gray-200 rounded-[14px] p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 [text-wrap:balance] mb-6">
              AI is one part of JarvisTravel, not the whole of it.
            </h3>
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-6 mb-6">
              {[
                { title: 'Where AI is', lines: AI_IS },
                { title: 'Where AI isn’t', lines: AI_ISNT },
              ].map((column) => (
                <div key={column.title}>
                  <h4 className="text-sm font-semibold text-gray-500 mb-3">{column.title}</h4>
                  <ul className="space-y-2">
                    {column.lines.map((line) => (
                      <li key={line} className="text-gray-700 leading-relaxed">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3 border-t border-gray-200 pt-5">
              <p className="font-semibold text-gray-900">
                Jarvis is sent your trip, not your identity.
              </p>
              <Link
                to="/data-security#ai"
                className="font-medium text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700 transition-colors"
              >
                How we use AI
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The plans, with no amounts (JAR-4464). Amounts and the November offer live
          on /pricing, which is moving to Stripe's live prices with the offer ending
          on its own clock (JAR-4286). An amount mirrored here would outlive it. */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-4">
            One trip, or every trip.
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed max-w-xl [text-wrap:pretty] mb-6">
            Plan one trip with a Trip Pass, or every trip you take with Explore.
          </p>
          <Link
            to="/pricing"
            className="font-medium text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700 transition-colors"
          >
            See plans and pricing
          </Link>
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
            href={appJoinUrl()}
            className="inline-block px-10 py-4 bg-amber-400 text-gray-900 rounded-xs font-semibold hover:bg-amber-300 transition-colors"
          >
            Start planning
          </a>
        </div>
      </section>
    </div>
  );
}
