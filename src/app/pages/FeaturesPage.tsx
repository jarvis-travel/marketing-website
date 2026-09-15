import { Link } from 'react-router-dom';
import { DevicePair } from '../components/DevicePair';
import {
  BUDGET,
  DAY_DETAIL,
  DAY_ROUTE,
  JOURNAL,
  LIGHTER_DAY,
  type AppCaptureImage,
} from '../data/appCaptures';
import { FI_BANDS, fiToneForDay } from '../data/fatigueIndex';

// "How it works" (JAR-432, reworked per brand-owner direction 2026-07-21):
// the Fatigue Index deep-dive lives HERE (the home page tells the story;
// this page shows the machinery). FI numbers are always numeric digits.
// The scale graphic mirrors how the app itself displays FI (data/fatigueIndex.ts),
// with the app's ring treatment on the active reading.
// Each moment below ends with its "so what" - the benefit, not the feature.

interface Moment {
  name: string;
  desc: string;
  soWhat: string;
  /** The app screen that shows this moment. The first has none: the real
   *  day plan sits directly above the list. */
  capture?: { image: AppCaptureImage; alt: string };
}

const MOMENTS: Moment[] = [
  {
    name: 'Your days, drafted for you',
    desc: 'Jarvis puts your days in a sensible order, with the forecast and your budget right there in the plan. Move a stop and the numbers move with it. A long weekend or two weeks abroad, it works the same way.',
    soWhat: 'So the plan gets finished, and you get your evenings back.',
  },
  {
    name: 'Spot the tough days early',
    desc: 'When a day comes up packed, you’ll know while you’re still planning, and Jarvis can show you a lighter version of the same day. See what dropping one thing buys you.',
    soWhat: 'So you fix Tuesday at home, not mid-afternoon in a crowded plaza.',
    capture: {
      image: LIGHTER_DAY,
      alt: 'A packed day in Rome beside a lighter version of it. Now, the day is rated 7, packed. Lighter, it is rated 6, balanced, with lunch moved to a lighter day and less spent that day. Below them, why the lighter day flows better.',
    },
  },
  {
    name: 'Your day on one map',
    desc: 'Your stops in order, on the route you’d walk, with the backtracking already taken out.',
    soWhat: 'So you see the whole day before your feet commit to it.',
    capture: {
      image: DAY_ROUTE,
      alt: 'A walking route through central Rome with numbered stops. Dashed lines mark the cross-town detours Jarvis skipped, about 23 minutes and 1.1 miles less on foot.',
    },
  },
  {
    name: 'Keep the budget in view',
    desc: 'Your budget lives inside the plan: what you’ve set aside, what you’ve spent and what’s left, right next to your days.',
    soWhat: 'So the budget is a decision you make, not news you get.',
    capture: {
      image: BUDGET,
      alt: 'The budget tracker for a week in Rome: spending on a healthy pace and projected to finish under budget, with what is spent so far, what is left, and how it splits between card and cash.',
    },
  },
  {
    name: 'Bring the trip home with you',
    desc: 'Your notes, photos, receipts and places come together in a journal worth rereading. It’s yours to keep.',
    soWhat: 'So the trip doesn’t evaporate when the tan does.',
    capture: {
      image: JOURNAL,
      alt: 'A day in the trip journal for Rome, with the Colosseum tour open: the spend confirmed from its receipt, the receipt line by line, and a place to add a note.',
    },
  },
];

export function FeaturesPage() {
  return (
    <div className="pt-24">
      {/* Header - flat Ateneo band. */}
      <section className="bg-sky-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-50 leading-tight [text-wrap:balance] max-w-3xl mb-6">
            From the first idea to the flight home.
          </h1>
          <p className="text-lg text-sky-100 max-w-2xl leading-relaxed">
            Jarvis drafts your days, flags the tough ones, and keeps the map
            and the budget in one place.
          </p>
        </div>
      </section>

      {/* The Fatigue Index - the machinery, shown the way the app shows it. */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-4">
              Know how every day will feel.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed max-w-xl [text-wrap:pretty] mb-2">
              The Fatigue Index rates each day chill, balanced or packed while
              you plan.
            </p>
            {/* Filed; attached to the feature itself, never a site-wide badge.
                Diarize the provisional's 12-month expiry: the line comes down
                if the filing lapses. */}
            <p className="text-sm font-medium text-gray-500 mb-6">Patent pending</p>
            <p className="text-lg text-gray-600 leading-relaxed max-w-xl [text-wrap:pretty] mb-8">
              It looks at how far your body clock moves, how long you&rsquo;re in
              transit, how far you walk, how much is packed in and how
              much downtime is left.
            </p>

            {/* The scale, as the app displays it: a chip per day in its colour
                step, grouped by band with the band's word under each group. The
                groups share one row down to a 375px phone. The words above carry
                the meaning, so no caption; screen readers get the mapping from
                the aria-label. */}
            <div
              role="img"
              aria-label="The Fatigue Index scale: days 1 to 3 are rated chill, 4 to 6 balanced, and 7 to 9 packed, with 9 the peak. The example shows a day rated 7."
              className="grid max-w-[29rem] grid-cols-3 gap-3 mb-8"
            >
              {FI_BANDS.map((band) => (
                <div key={band.word} aria-hidden="true">
                  <div className="grid grid-cols-3 gap-1.5">
                    {band.days.map((day) => {
                      const tone = fiToneForDay(day);
                      return (
                        <span
                          key={day}
                          style={{ color: tone.ink, backgroundColor: `${tone.color}1A` }}
                          className={`aspect-square rounded-xl flex items-center justify-center text-base sm:text-lg font-bold [font-variant-numeric:tabular-nums] ${
                            day === 7 ? 'ring-2 ring-current' : ''
                          }`}
                        >
                          {day}
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-center text-sm font-semibold" style={{ color: band.tone.ink }}>
                    {band.word}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-gray-600 leading-relaxed">
              It&rsquo;s a heads-up, not medical advice.
            </p>
          </div>
        </div>
      </section>

      {/* A real plan, on a ledge: the app's own Trip Plan for the demo week in
          Rome, with day one open (data/appCaptures.ts). */}
      <section className="bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-4">
              Every day, laid out.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed max-w-xl [text-wrap:pretty]">
              Each stop in order with its time, and the day&rsquo;s rating right
              at the top. This is day one of a week in Rome.
            </p>
          </div>

          {/* The ledge: the screen sits frameless on a solid Ateneo plane with
              one contour arc behind it. No device chrome. */}
          <div className="relative overflow-hidden rounded-[20px] bg-sky-600 p-4 sm:p-6 md:p-8">
            <svg
              className="pointer-events-none absolute -bottom-40 -right-32 w-[440px] h-[440px]"
              viewBox="0 0 440 440"
              fill="none"
              aria-hidden="true"
            >
              {[110, 145, 180, 215].map((r) => (
                <circle key={r} cx="220" cy="220" r={r} stroke="#F0EEEB" strokeOpacity="0.13" strokeWidth="1" />
              ))}
            </svg>

            <div className="relative">
              <DevicePair
                image={DAY_DETAIL}
                alt="A week in Rome in the trip plan. Day one is rated balanced, with a note on why it is full but manageable, and its stops in order from a 9:30 airport arrival."
                ground="plane"
                sizes={{ desktop: '(min-width: 1024px) 730px, 80vw', phone: '(min-width: 1024px) 221px, 24vw' }}
              />
            </div>
          </div>

          {/* What Jarvis does, each ending with what the traveler gets, in the
              same band as the plan above so no empty band sits between them.
              No numbers: the order is not a sequence the reader needs. */}
          <div className="max-w-3xl mt-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 [text-wrap:balance] mb-8">
              Jarvis does the heavy lifting.
            </h2>
            <ul className="border-t border-gray-200 list-none m-0 p-0">
              {MOMENTS.map((moment) => (
                <li key={moment.name} className="py-8 border-b border-gray-200">
                  <div>
                    <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
                      {moment.name}
                    </h3>
                    <p className="text-gray-600 leading-relaxed max-w-lg [text-wrap:pretty] mb-3">{moment.desc}</p>
                    <p className="font-medium text-gray-900 max-w-lg [text-wrap:pretty]">{moment.soWhat}</p>
                    {moment.capture && (
                      <div className="mt-6">
                        <DevicePair
                          image={moment.capture.image}
                          alt={moment.capture.alt}
                          ground="page"
                          sizes={{ desktop: '(min-width: 1024px) 660px, 80vw', phone: '(min-width: 1024px) 200px, 24vw' }}
                        />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center mt-12">
            <Link
              to="/pricing"
              className="inline-block px-8 py-4 bg-amber-400 text-gray-900 rounded-sm font-semibold hover:bg-amber-300 transition-colors"
            >
              Join Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
