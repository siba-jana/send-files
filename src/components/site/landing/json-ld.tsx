/**
 * Server-rendered JSON-LD script tag (structured data for crawlers).
 * Pages compose their own @graph and render it through this helper.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
