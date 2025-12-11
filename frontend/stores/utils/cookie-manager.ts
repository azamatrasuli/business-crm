/**
 * Centralized cookie management utility
 * Handles auth_status cookie for middleware authentication check
 */

const AUTH_STATUS_COOKIE = 'auth_status'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

/**
 * Check if we're in a secure (HTTPS) context
 * Safari requires Secure attribute for cookies on HTTPS
 */
function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.protocol === 'https:'
}

/**
 * Set authentication status cookie
 * This cookie is readable by middleware to check auth status
 * (HttpOnly tokens are managed by the server)
 * 
 * IMPORTANT: Safari requires Secure attribute for cookies on HTTPS,
 * and we use SameSite=None to match backend cookie policy for cross-origin requests
 */
export function setAuthStatusCookie(): void {
  if (typeof window === 'undefined') return
  
  const secure = isSecureContext()
  // For cross-origin (frontend on Vercel, backend on Render), use SameSite=None
  // SameSite=None requires Secure attribute
  const sameSite = secure ? 'None' : 'Lax'
  const secureFlag = secure ? '; Secure' : ''
  
  document.cookie = `${AUTH_STATUS_COOKIE}=authenticated; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=${sameSite}${secureFlag}`
}

/**
 * Clear authentication status cookie
 * Must use same attributes (Secure, SameSite) as when setting for proper deletion
 */
export function clearAuthStatusCookie(): void {
  if (typeof window === 'undefined') return
  
  const secure = isSecureContext()
  const sameSite = secure ? 'None' : 'Lax'
  const secureFlag = secure ? '; Secure' : ''
  
  document.cookie = `${AUTH_STATUS_COOKIE}=; path=/; max-age=0; SameSite=${sameSite}${secureFlag}`
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

