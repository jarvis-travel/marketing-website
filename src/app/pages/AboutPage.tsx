// About (JAR-432) - the company story, in "we" voice by brand-owner
// direction (no founder name, no first person singular, no signature).
// Replaces the fabricated company page; every claim maps to the shipped
// product or the Terms.

import { appJoinUrl } from '../data/appLink';
import { ContourArcs } from '../components/ContourArcs';

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
            Why we started JarvisTravel.
          </h1>
        </div>
      </section>

      {/* The story - one company voice. */}
      <section className="bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
            <p>
              JarvisTravel started three years ago, with a trip to Italy.
              Planning it, we kept seeing the same hotels and the same handful
              of sights on every big travel site. On the maps, we couldn&rsquo;t
              tell whether a place showed up because it was good or because it
              paid to be seen. And site after site wanted our details, whether
              we bought anything or not.
            </p>
            <p>
              We wanted a few weeks in Italy that felt like ours, not shaped by
              ads, influencers or anyone&rsquo;s commission. Planning it that way
              took so much research it felt impossible. And what about the
              little places locals love, the ones with no marketing budget?
            </p>
            <p>
              Everything we used seemed to want us to fill every hour. But
              sometimes a lazy day in a piazza is all you need, and a day that
              goes too hard can cost you the next one.
            </p>
            <p>
              So we asked: what if a planner could build a trip around you, not
              around whoever paid to show up in search results? What if it could
              balance your days so you don&rsquo;t burn out, and show you what
              each day will really feel like before you land?
            </p>
            <p>
              When today&rsquo;s AI arrived, we wondered if it could help pull
              all of that together: a great trip, planned fast, and still shaped
              around the way you travel. Not as the whole answer, but as one
              good tool. And only if it could be done responsibly, with your
              privacy first.
            </p>
            <p className="font-semibold text-gray-900">
              That&rsquo;s how JarvisTravel and the Fatigue Index&trade; were
              born.
            </p>
            <p>
              It&rsquo;s still how we use AI. Jarvis drafts your days, and the
              plan stays yours to change. What we send Jarvis is your trip, not
              who you are: your name, email and login stay out of it. And
              nothing it suggests is there because someone paid.
            </p>
            <p>
              JarvisTravel plans your trip; it doesn&rsquo;t sell you travel.
              It&rsquo;s paid for by the people who use it.
            </p>
            <p>
              We&rsquo;re just getting started, and there&rsquo;s a lot more to
              come. Thanks for being here.
            </p>
          </div>
        </div>
      </section>

      {/* The sign-off - the home page's closing band. */}
      <section className="relative overflow-hidden bg-slate-900">
        <ContourArcs className="absolute -top-40 -left-48 w-[520px] h-[520px]" />
        <ContourArcs className="absolute -bottom-52 -right-44 w-[520px] h-[520px]" />
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
          <p className="text-xl md:text-2xl font-semibold text-amber-400 mb-3">
            No Ads. No Data Selling.
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-50 [text-wrap:balance] mb-10">
            Enjoy Your Vacation.
          </h2>
          <a
            href={appJoinUrl()}
            className="inline-block px-10 py-4 bg-amber-400 text-gray-900 rounded-xs font-semibold hover:bg-amber-300 transition-colors"
          >
            Join Now
          </a>
        </div>
      </section>
    </div>
  );
}
