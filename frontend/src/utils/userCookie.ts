const USER_COOKIE_NAME = 'fypai_user_id'
const DEFAULT_USER_ID = 'user1'

function parseCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null

  const prefix = `${name}=`
  const parts = document.cookie.split(';')

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(prefix)) continue

    const value = trimmed.slice(prefix.length)
    if (!value) return null

    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  return null
}

export function getSelectedUserIdFromCookie(): string {
  return parseCookieValue(USER_COOKIE_NAME) || DEFAULT_USER_ID
}

export function setSelectedUserIdCookie(userId: string): void {
  if (typeof document === 'undefined') return
  if (!userId?.trim()) return

  // Session cookie by design (no explicit expires / max-age).
  document.cookie = `${USER_COOKIE_NAME}=${encodeURIComponent(userId.trim())}; path=/; SameSite=Lax`
}
