import { Mail } from 'lucide-react';
import { appSignInUrl } from '../data/appLink';

// Contact (JAR-432) - the previous form called setSubmitted(true), transmitted
// nothing, and told the visitor "Message Sent! We'll get back to you within
// 24 hours." Every path below is real: Join Now goes to the app's sign-in, where
// a visitor signs in or starts a sign-up, and the addresses are the ones already
// published on this site. A real contact form returns when the form endpoint exists (phase 1 of
// the redesign plan).

export function ContactPage() {
  return (
    <div className="pt-24">
      {/* Header - flat Ateneo band. */}
      <section className="bg-sky-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-400 mb-6">
            Contact
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-50 leading-tight [text-wrap:balance] max-w-3xl mb-6">
            Get in touch.
          </h1>
          <p className="text-lg text-sky-100 max-w-xl leading-relaxed [text-wrap:pretty]">
            Ready to plan your next trip? Join now below. For everything else,
            email reaches a person.
          </p>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 space-y-6">
          {/* Signup panel - links to the live signup flow. */}
          <div className="bg-white border border-gray-200 rounded-[14px] p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Start planning
            </h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              Join now and plan your next trip with Jarvis.
            </p>
            <a
              href={appSignInUrl()}
              className="inline-block px-8 py-4 bg-amber-400 text-gray-900 rounded-sm font-semibold hover:bg-amber-300 transition-colors"
            >
              Join Now
            </a>
          </div>

          {/* Email - the app's icon row recipe. */}
          <div className="bg-white border border-gray-200 rounded-[14px] p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Email</h2>
            <ul className="space-y-5">
              <li className="flex items-center gap-4">
                <span className="w-9 h-9 rounded-lg bg-sky-600/10 text-sky-600 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-gray-900">General</p>
                  <a
                    href="mailto:hello@jarvistravel.com"
                    className="text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700"
                  >
                    hello@jarvistravel.com
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <span className="w-9 h-9 rounded-lg bg-sky-600/10 text-sky-600 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-gray-900">Press</p>
                  <a
                    href="mailto:press@jarvistravel.com"
                    className="text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700"
                  >
                    press@jarvistravel.com
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <span className="w-9 h-9 rounded-lg bg-sky-600/10 text-sky-600 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-gray-900">Privacy</p>
                  <a
                    href="mailto:privacy@jarvistravel.com"
                    className="text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700"
                  >
                    privacy@jarvistravel.com
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
