import { Link } from 'react-router-dom';
import { Instagram, Facebook } from 'lucide-react';
import { LogoLockup } from './Logo';

// The handle is @jarvistravelapp, not @jarvistravel.
const SOCIAL = [
  { name: 'Instagram', href: 'https://instagram.com/jarvistravelapp', icon: Instagram },
  { name: 'Facebook', href: 'https://facebook.com/jarvistravelapp', icon: Facebook },
] as const;

// Footer (JAR-432) - Ateneo ground per Meridian (the old bg-gray-900 was
// Neverything ink used as a web surface, which the brand bans). Every link
// resolves to a page that exists: Careers, Press and the duplicate Cookie
// Policy pointed nowhere and are gone until they have real destinations.
// Wordmark stands alone pending the commissioned mark (JAR-354).

const FOOTER_LINKS: Record<
  'Product' | 'Company' | 'Legal',
  { name: string; path: string }[]
> = {
  Product: [
    { name: 'How it works', path: '/features' },
    { name: 'Pricing', path: '/pricing' },
  ],
  Company: [
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ],
  Legal: [
    { name: 'Privacy Policy', path: '/privacy' },
    { name: 'Terms of Service', path: '/terms' },
    { name: 'Data Security', path: '/data-security' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-sky-600 text-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-5 gap-12">
          <div className="md:col-span-2">
            {/* Footer sits on Ateneo navy, so the inlined lockup inherits
                Moonlight from text-gray-50 on the <footer>. The TM lives on the
                copyright line below, not beside the mark. */}
            <div className="mb-6">
              <LogoLockup className="h-10 w-auto" title={null} />
            </div>
            <p className="text-sky-100 leading-relaxed max-w-sm">
              JarvisTravel plans the pace, the budget and the memories, so you
              can enjoy your vacation.
            </p>
            <div className="mt-6 flex items-center gap-5">
              {SOCIAL.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`JarvisTravel on ${s.name}`}
                  className="text-sky-100 hover:text-gray-50 transition-colors"
                >
                  <s.icon className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
                </a>
              ))}
              <span className="text-sky-200 text-sm">@jarvistravelapp</span>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h2 className="font-semibold mb-4 text-gray-50">{category}</h2>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.path}
                      className="text-sky-100 hover:text-white transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Legal notices. TM not (R): JARVISTRAVEL is a 1(b) intent-to-use
            application, so the registered symbol would be unlawful and could
            jeopardise the filing. The Fatigue Index is patent pending, which is
            a filing, NOT a trademark, so it never carries a mark symbol. */}
        <div className="border-t border-gray-50/15 mt-12 pt-8 space-y-2">
          <p className="text-sky-200 text-sm">
            © {new Date().getFullYear()} JarvisTravel, Inc. All rights reserved.
          </p>
          <p className="text-sky-200/80 text-xs leading-relaxed">
            JARVISTRAVEL is a trademark of JarvisTravel, Inc. Fatigue Index
            is patent pending.
          </p>
        </div>
      </div>
    </footer>
  );
}
