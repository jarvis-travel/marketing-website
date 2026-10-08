import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

// Data Security (JAR-2333): how JarvisTravel is built to protect people's data,
// and why, in plain words. The Terms, Privacy Policy and Cookie Policy are the
// documents of record (JAR-69). Each line here matches them or the code it
// describes, and needs re-checking before it is edited:
//   - Jarvis's context carries no name, email or login (Privacy §6).
//   - A precise location answers one search and is discarded (core
//     internal/location; the Privacy Policy's location section).
//   - A bank connection's Plaid token is encrypted at rest, and a disconnect or
//     an account erasure removes the Item at Plaid (core plaid.Service
//     revokeItem and EraseForUser).
//   - Payment runs on Stripe's hosted checkout (web-app redirects to its URL).
//   - The Fatigue Index has no person attached (fatigue_logs has no user_id).
//   - A destination photo request carries no account details and doesn't name
//     the destination, and no phone number is shared for marketing (Privacy §5).
//   - Text alerts are opt-in (Terms, SMS text message alerts).
//   - TLS 1.2/1.3, HSTS, the CSP, X-Frame-Options and nosniff are core
//     infra/nginx/sites-jarvistravel.conf. Database connections use
//     sslmode=verify-full (core deployments/podman-compose.yml), and the
//     database is DigitalOcean managed PostgreSQL: LUKS AES-256 at rest, with
//     encrypted backups (DigitalOcean's PostgreSQL security docs). Bank tokens
//     use AES-256-GCM (core shared/security/encryption.go).
// Present tense only: no absolute or forward-looking promises about data
// (jarvistravel-copy rule 9, and the lint:absolute-claims guard).

const BUILT = [
  {
    name: 'Jarvis gets your trip, not your identity.',
    desc: 'To plan your days, Jarvis needs to know where you’re going, when, your budget and your plans. It doesn’t need to know who you are, so your name, email and login aren’t part of what we send it. The companies whose AI models power Jarvis aren’t allowed to train their own AI on it. What you type is sent as you wrote it, so leave out anything private.',
  },
  {
    name: 'Your exact location is used once, then dropped.',
    desc: 'Location is off until you allow it, and you choose how precise: your city, your neighborhood, the area where you’re staying, or one exact spot for a single search. An exact spot answers that search and is discarded, so it doesn’t become a record of where you’ve been.',
  },
  {
    name: 'Your bank login stays with Plaid.',
    desc: 'Connecting a bank is optional. It lets your budget count what you really spend. You sign in to your bank in Plaid’s own window, so your bank password doesn’t reach us. The key to that connection is stored encrypted, and disconnecting your bank, or deleting your account, closes the connection at Plaid too.',
  },
  {
    name: 'Your card number goes to Stripe.',
    desc: 'You pay on Stripe’s own checkout page, so your card number doesn’t pass through our servers.',
  },
  {
    name: 'The Fatigue Index rates the day, not you.',
    desc: 'It works from your itinerary, so what gets rated is how full a day is, not the person living it.',
  },
  {
    name: 'Destination photos load without your name on them.',
    desc: 'Your device fetches each photo straight from the photo provider. The provider sees what any website sees, like your IP address, but not your name, email or account, and we ask for the photo without naming where you’re going.',
  },
];

const TECHNICAL = [
  {
    name: 'Encryption in transit',
    desc: 'Every connection to JarvisTravel uses HTTPS with TLS 1.2 or 1.3, and HSTS tells your browser not to connect to us any other way. Our servers reach our database over TLS too, with its certificate checked.',
  },
  {
    name: 'Encryption at rest',
    desc: 'The database that holds your account and your trips is encrypted at rest with AES-256, and so are its backups.',
  },
  {
    name: 'A second lock on bank connections',
    desc: 'The token that links your bank is encrypted with AES-256-GCM before it’s stored, on top of the database’s own encryption.',
  },
  {
    name: 'Browser protections',
    desc: 'A Content Security Policy limits which scripts can run on our pages, X-Frame-Options stops other sites from framing the app, and X-Content-Type-Options stops browsers from guessing file types.',
  },
];

const DONT = [
  'We don’t sell your personal information.',
  'We don’t run ads, and we don’t take money to put anything in your plan.',
  'We don’t track you across other websites. The cookies we rely on keep you signed in and secure.',
  'We don’t share your phone number for anyone’s marketing, and text alerts stay off until you turn them on.',
];

const CHOICES = [
  'Download your data',
  'Delete your account and its data',
  'Choose how precise your location is',
  'Disconnect your bank',
  'Turn off text alerts, or text STOP',
  'Unsubscribe from marketing email in one click',
];

const LINK = 'text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700';

function DetailList({ items }: { items: { name: string; desc: string }[] }) {
  return (
    <ul className="border-t border-gray-200">
      {items.map((item) => (
        <li key={item.name} className="py-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
          <p className="text-gray-600 leading-relaxed">{item.desc}</p>
        </li>
      ))}
    </ul>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((line) => (
        <li key={line} className="flex items-start gap-3">
          <Check
            className="w-4 h-4 text-sky-600 shrink-0 mt-1.5"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span className="text-gray-600 text-lg">{line}</span>
        </li>
      ))}
    </ul>
  );
}

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
            What we built to protect your trips, and why we built it that way.
          </p>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-14">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              How it’s built
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              Each part of JarvisTravel, and each service that helps run it, gets only
              what it needs to do its job.
            </p>
            <DetailList items={BUILT} />
          </div>

          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              The technical details
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              For anyone who wants the specifics.
            </p>
            <DetailList items={TECHNICAL} />
          </div>

          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              What we don’t do
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              You pay for JarvisTravel, and that’s how we make money. So your data
              isn’t what we sell.
            </p>
            <CheckList items={DONT} />
          </div>

          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              Your choices
            </h2>
            <div className="mb-6">
              <CheckList items={CHOICES} />
            </div>
            <p className="text-gray-600">
              For anything else, or if you&rsquo;d rather we did it for you, write to{' '}
              <a href="mailto:privacy@jarvistravel.com" className={LINK}>
                privacy@jarvistravel.com
              </a>
              .
            </p>
          </div>

          <p className="text-gray-600 leading-relaxed border-t border-gray-200 pt-8">
            This page explains how we handle your data, and why. It doesn&rsquo;t replace our{' '}
            <Link to="/privacy" className={LINK}>Privacy Policy</Link>,{' '}
            <Link to="/cookies" className={LINK}>Cookie Policy</Link> and{' '}
            <Link to="/terms" className={LINK}>Terms of Service</Link>, which have the full
            details.
          </p>
        </div>
      </section>
    </div>
  );
}
