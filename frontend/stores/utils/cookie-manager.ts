/**
 * Centralized cookie management utility
 * Handles auth_status cookie for middleware authentication check
 */

const AUTH_STATUS_COOKIE = 'auth_status'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

/**
 * Set authentication status cookie
 * This cookie is readable by middleware to check auth status
 * (HttpOnly tokens are managed by the server)
 */
export function setAuthStatusCookie(): void {
  if (typeof window === 'undefined') return
  document.cookie = `${AUTH_STATUS_COOKIE}=authenticated; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

/**
 * Clear authentication status cookie
 */
export function clearAuthStatusCookie(): void {
  if (typeof window === 'undefined') return
  document.cookie = `${AUTH_STATUS_COOKIE}=; path=/; max-age=0`
}

/**
 * Check if auth status cookie is present and valid
 */
export function hasAuthStatusCookie(): boolean {
  if (typeof window === 'undefined') return false
  const cookie = document.cookie
    .split(';')
    .find((c) => c.trim().startsWith(`${AUTH_STATUS_COOKIE}=`))
  return cookie?.includes('authenticated') ?? false
}

/**
 * Get cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

