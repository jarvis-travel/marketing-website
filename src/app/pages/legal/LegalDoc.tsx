// Shared shell for the counsel legal pages (Terms, Privacy, Cookie) — one
// Meridian layout (Ateneo header band, Moonlight ground) fed by the verbatim
// content in ./content.ts (JAR-69). Body text is rendered from string data via
// expression containers, never as JSX text, so apostrophes and quotes in the
// legal copy don't need HTML-entity escaping and never trip no-unescaped-
// entities. The reading column stays narrow (max-w-2xl) per JAR-1701.
import type { ReactNode } from 'react';
import type { LegalBlock, LegalDocContent } from './content';

// Split on contact emails and render them as mailto links; everything else is
// plain text. A capturing split puts each email at an odd index.
const EMAIL = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/;
function linkify(text: string): ReactNode[] {
  return text.split(EMAIL).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={`mailto:${part}`}
        className="text-sky-600 underline underline-offset-4 decoration-1 hover:text-sky-700"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.ul) {
    return (
      <ul className="list-disc pl-6 space-y-2 text-lg text-gray-600 leading-relaxed">
        {block.ul.map((item, i) => (
          <li key={i}>{linkify(item)}</li>
        ))}
      </ul>
    );
  }
  return <p className="text-lg text-gray-600 leading-relaxed">{linkify(block.p ?? '')}</p>;
}

export function LegalDoc({ doc }: { doc: LegalDocContent }) {
  // The eyebrow already says "Legal", so drop the brand prefix from the H1.
  const heading = doc.title.replace(/^JarvisTravel\s+/, '');
  return (
    <div className="pt-24">
      {/* Header - flat Ateneo band. */}
      <section className="bg-sky-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-400 mb-6">
            Legal
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-50 leading-tight [text-wrap:balance]">
            {heading}
          </h1>
          <p className="text-sky-200 text-sm mt-4">{doc.effective}</p>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="border-t border-gray-200">
            {doc.sections.map((section) => (
              <section key={section.heading} className="py-8 border-b border-gray-200">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-3">
                  {section.heading}
                </h2>
                <div className="space-y-4">
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
