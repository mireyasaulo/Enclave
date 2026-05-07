/**
 * Server component that emits a single <script type="application/ld+json">
 * block. Pass any JSON-LD data shape; we run JSON.stringify and embed it
 * via dangerouslySetInnerHTML (the only correct way per Next.js docs).
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: required for JSON-LD
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
