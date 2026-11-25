type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

// Keep JSON-LD data in a dedicated script tag. Escaping "<" prevents a value
// from accidentally terminating the script element if this component later
// receives content from a CMS or catalogue.
export function JsonLd({ data }: { data: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
