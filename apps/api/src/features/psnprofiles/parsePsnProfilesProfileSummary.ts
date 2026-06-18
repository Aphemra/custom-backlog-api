export function parsePsnProfilesPageTitle(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);

  if (!titleMatch?.[1]) {
    return undefined;
  }

  return decodeBasicHtmlEntities(titleMatch[1].trim());
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}
