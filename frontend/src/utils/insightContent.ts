const HASHTAG_ONLY_LINE = /^\s*(#[A-Za-z0-9_-]+(?:\s+#[A-Za-z0-9_-]+)*)\s*$/
const BULLET_ONLY_LINE = /^\s*[•●◦▪·]\s*$/u
const UNICODE_BULLET_LINE = /^(\s*)[•●◦▪·]\s+(.*)$/u

/**
 * Remove metadata hashtag-only lines from rendered insight content.
 * Keeps markdown headings (e.g. '# Title') and regular prose untouched.
 */
export function sanitizeInsightContent(content: string): string {
  const cleaned = content
    .split('\n')
    .filter((line) => !HASHTAG_ONLY_LINE.test(line.trim()))
    .filter((line) => !BULLET_ONLY_LINE.test(line.trim()))
    .map((line) => {
      const bulletMatch = line.match(UNICODE_BULLET_LINE)
      if (!bulletMatch) return line

      const indent = bulletMatch[1] || ''
      const body = bulletMatch[2]?.trim() || ''
      if (!body) return ''
      return `${indent}- ${body}`
    })
    .join('\n')

  return cleaned.replace(/\n{3,}/g, '\n\n').trim()
}
