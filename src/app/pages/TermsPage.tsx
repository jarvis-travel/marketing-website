// Terms of Service — counsel-final documents of record (JAR-69). Content is the
// verbatim Procopio ToS in ./legal/content.ts; the page is the shared LegalDoc
// shell. Regenerate content from source rather than editing prose here.
import { LegalDoc } from './legal/LegalDoc';
import { termsDoc } from './legal/content';

export function TermsPage() {
  return <LegalDoc doc={termsDoc} />;
}
