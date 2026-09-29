// Cookie Policy — counsel-final documents of record (JAR-69). Content is the
// verbatim Procopio Cookie Policy in ./legal/content.ts (its effective date and
// contact placeholders filled to match the Privacy Policy, per Brent). Served
// at /cookies; the waitlist hands off here. Regenerate content from source.
import { LegalDoc } from './legal/LegalDoc';
import { cookieDoc } from './legal/content';

export function CookiesPage() {
  return <LegalDoc doc={cookieDoc} />;
}
