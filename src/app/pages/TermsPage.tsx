// Terms of Service (JAR-432) - Meridian shell (Ateneo header band, Moonlight
// ground). The seller-of-travel section (2) is the load-bearing legal copy
// and stays verbatim; the rest is placeholder pending final legal review.
// The prose plugin is not installed, so sections are styled directly.

interface Section {
  title: string;
  paragraphs: React.ReactNode[];
}

const SECTIONS: Section[] = [
  {
    title: '1. Acceptance of terms',
    paragraphs: [
      <>
        By using JarvisTravel, you agree to these terms. If you don&rsquo;t
        agree, please don&rsquo;t use our service.
      </>,
    ],
  },
  {
    title: '2. Service description',
    paragraphs: [
      <>
        JarvisTravel provides AI-powered travel planning, trip intelligence,
        budget tracking, and the Fatigue Index system. Features may vary
        by plan.
      </>,
      <>
        JarvisTravel is a software service. It is not a travel agency and is not
        a seller of travel: it does not sell, provide, furnish, contract for, or
        arrange air, sea, or ground transportation, lodging, tours, or any other
        travel services.
      </>,
      <>
        All travel arrangements are made by you, directly with airlines, hotels,
        tour operators, and other providers, on those providers&rsquo; own
        websites and under their terms. JarvisTravel is not a party to, receives
        no payment in connection with, and earns no commission on any such
        transaction. The only charges from JarvisTravel are subscription or
        single-trip access fees for the software itself.
      </>,
    ],
  },
  {
    title: '3. User responsibilities',
    paragraphs: [
      <>
        You&rsquo;re responsible for maintaining account security and providing
        accurate information. Misuse of the platform may result in account
        termination.
      </>,
    ],
  },
  {
    title: '4. Cancellation & refunds',
    paragraphs: [
      <>
        Cancel anytime from your account settings. Annual plans are refundable
        pro-rata within the first 30 days.
      </>,
    ],
  },
];

export function TermsPage() {
  return (
    <div className="pt-24">
      {/* Header - flat Ateneo band. */}
      <section className="bg-sky-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-400 mb-6">
            Legal
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-50 leading-tight [text-wrap:balance]">
            Terms of Service
          </h1>
          <p className="text-sky-200 text-sm mt-4">Last updated: July 2026</p>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="border-t border-gray-200">
            {SECTIONS.map((section) => (
              <div key={section.title} className="py-8 border-b border-gray-200">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-3">
                  {section.title}
                </h2>
                <div className="space-y-4">
                  {section.paragraphs.map((p, i) => (
                    <p key={i} className="text-lg text-gray-600 leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
