// About (JAR-432) - the company story, in "we" voice by brand-owner
// direction (no founder name, no first person singular, no signature).
// Replaces the fabricated company page; every claim maps to the shipped
// product or the Terms.

export function AboutPage() {
  return (
    <div className="pt-24">
      {/* Header - flat Ateneo band. */}
      <section className="bg-sky-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-400 mb-6">
            About
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-50 leading-tight [text-wrap:balance] max-w-3xl">
            Why we built JarvisTravel.
          </h1>
        </div>
      </section>

      {/* The story - one company voice. */}
      <section className="bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
            <p>
              We started JarvisTravel after too many trips that looked perfect
              on paper and felt like work in person. The tools we had were good
              at collecting places and terrible at telling us what a day would
              actually cost: in hours, in miles, in energy.
            </p>
            <p>
              So we built the pacing model first. Jarvis rates every day of a
              plan chill, balanced, or packed, based on what actually
              drains you: the time-zone shift, the transit, the walking, and
              the downtime you have left. The itinerary hangs off that rating,
              not the other way around.
            </p>
            <p>
              Two commitments have shaped everything since. JarvisTravel plans;
              it never sells travel. No commissions, no placements; nothing
              appears in your plan because someone paid for the spot. And the
              trip you take is yours: the journal, the photos, the places
              belong to you.
            </p>
            <p>
              And &ldquo;trip&rdquo; means any trip. The long weekend, the
              staycation, the two weeks abroad, the drive down the coast. If
              planning one has ever felt like a second job, we built
              JarvisTravel for you.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
