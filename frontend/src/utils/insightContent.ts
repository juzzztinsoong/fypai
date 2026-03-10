const HASHTAG_ONLY_LINE = /^\s*(#[A-Za-z0-9_-]+(?:\s+#[A-Za-z0-9_-]+)*)\s*$/

/**
 * Remove metadata hashtag-only lines from rendered insight content.
 * Keeps markdown headings (e.g. '# Title') and regular prose untouched.
 */
export function sanitizeInsightContent(content: string): string {
  const cleaned = content
    .split('\n')
    .filter((line) => !HASHTAG_ONLY_LINE.test(line.trim()))
    .join('\n')

  return cleaned.replace(/\n{3,}/g, '\n\n').trim()
}
