import { Check } from 'lucide-react';

// Data Security (JAR-432) - every claim here is either true today or clearly
// framed as a forward commitment. Removed (audit findings): "PCI DSS
// Compliant" (an attested status we do not hold - payments, when live, are
// processed by Stripe), "third-party security experts regularly audit our
// systems" (the only audit on record was internal), and the "256-bit /
// bank-level" specifics. Payment information is not collected today.

const PROTECTIONS = [
  {
    name: 'Encrypted in transit',
    desc: 'Connections to JarvisTravel are encrypted. Your plans and journal entries are not sent in the clear.',
  },
  {
    name: 'Minimal collection',
    desc: 'We collect what planning a trip requires: account details, preferences, the trips you build, and basic usage data. Nothing else.',
  },
  {
    name: 'Payments run through Stripe',
    desc: 'Card details are handled by Stripe, a dedicated payment processor. They never touch our servers.',
  },
];

const COMMITMENTS = [
  'We don’t sell your personal information.',
  'Your data is shared only with the services that run JarvisTravel.',
  'We don’t track you across other sites.',
];

const RIGHTS = [
  'Request a copy of your data',
  'Request deletion of your account and its data',
  'Opt out of marketing email with one click',
  'Update your information at any time',
];

export function DataSecurityPage() {
  return (
    <div className="pt-24">
      {/* Header - flat Ateneo band. */}
      <section className="bg-sky-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-400 mb-6">
            Data security
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-50 leading-tight [text-wrap:balance] max-w-3xl mb-6">
            Your data, your control.
          </h1>
          <p className="text-lg text-sky-100 max-w-xl leading-relaxed [text-wrap:pretty]">
            What we protect, what we will never do, and the rights you keep.
          </p>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-14">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              How we protect it
            </h2>
            <ul className="border-t border-gray-200">
              {PROTECTIONS.map((item) => (
                <li key={item.name} className="py-5 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              What we will never do
            </h2>
            <ul className="space-y-3">
              {COMMITMENTS.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Check
                    className="w-4 h-4 text-sky-600 flex-shrink-0 mt-1.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="text-gray-600 text-lg">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              Your rights
            </h2>
            <ul className="space-y-3 mb-6">
              {RIGHTS.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Check
                    className="w-4 h-4 text-sky-600 flex-shrink-0 mt-1.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="text-gray-600 text-lg">{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-gray-600">
              For any of these, write to{' '}
              <a
                href="mailto:privacy@jarvistravel.com"
                className="text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700"
              >
                privacy@jarvistravel.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
