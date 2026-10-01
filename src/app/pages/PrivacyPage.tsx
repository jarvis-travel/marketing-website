// Privacy Policy — counsel-final documents of record (JAR-69). Content is the
// verbatim Procopio Privacy Policy in ./legal/content.ts; the page is the
// shared LegalDoc shell. Regenerate content from source rather than editing
// prose here.
import { LegalDoc } from './legal/LegalDoc';
import { privacyDoc } from './legal/content';

export function PrivacyPage() {
  return <LegalDoc doc={privacyDoc} />;
}
