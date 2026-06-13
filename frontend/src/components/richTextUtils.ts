const EMPTY_HTML_PATTERNS = [
  /^$/,
  /^<p><\/p>$/,
  /^<p><br><\/p>$/,
  /^<p><br\s*\/?><\/p>$/,
]

export function isRichTextEmpty(html: string | undefined | null): boolean {
  const trimmed = html?.trim() ?? ''
  return EMPTY_HTML_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function normalizeRichText(html: string | undefined | null): string | undefined {
  if (isRichTextEmpty(html)) return undefined
  return html?.trim()
}
