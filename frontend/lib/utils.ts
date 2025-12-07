/**
 * @fileoverview Utility Functions
 * Common utility functions for the application.
 * Based on Code Quality Audit Framework - DRY principle.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ═══════════════════════════════════════════════════════════════════════════════
// Styling Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Merge Tailwind CSS classes with clsx.
 * Handles conflicting classes intelligently.
 *
 * @example
 * cn('px-2 py-1', 'px-4') // Returns 'py-1 px-4'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ═══════════════════════════════════════════════════════════════════════════════
// String Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Truncate string to a maximum length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}...`
}

/**
 * Remove all non-digit characters from a string.
 */
export function digitsOnly(str: string): string {
  return str.replace(/\D/g, '')
}

/**
 * Format phone number for display.
 */
export function formatPhone(phone: string): string {
  const digits = digitsOnly(phone)
  if (digits.length === 12 && digits.startsWith('971')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  return phone
}

// ═══════════════════════════════════════════════════════════════════════════════
// Number Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format number as currency (AED).
 */
export function formatCurrency(amount: number, currency = 'AED'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format number with thousand separators.
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ru-RU').format(num)
}

/**
 * Format percentage.
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Clamp a number between min and max values.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Date Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format date for display.
 */
export function formatDate(date: Date | string, locale = 'ru-RU'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Format date and time for display.
 */
export function formatDateTime(date: Date | string, locale = 'ru-RU'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format date for API (ISO format, date only).
 */
export function toApiDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

/**
 * Get relative time string (e.g., "2 hours ago").
 */
export function getRelativeTime(date: Date | string, locale = 'ru-RU'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (diffDay > 0) return rtf.format(-diffDay, 'day')
  if (diffHour > 0) return rtf.format(-diffHour, 'hour')
  if (diffMin > 0) return rtf.format(-diffMin, 'minute')
  return rtf.format(-diffSec, 'second')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Array Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Group array items by a key.
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = keyFn(item)
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(item)
      return acc
    },
    {} as Record<K, T[]>
  )
}

/**
 * Remove duplicates from array by key.
 */
export function uniqueBy<T, K>(items: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>()
  return items.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Sort array by multiple keys.
 */
export function sortBy<T>(
  items: T[],
  ...comparators: Array<(a: T, b: T) => number>
): T[] {
  return [...items].sort((a, b) => {
    for (const comparator of comparators) {
      const result = comparator(a, b)
      if (result !== 0) return result
    }
    return 0
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Object Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object).
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Remove null/undefined values from object.
 */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== null && value !== undefined)
  ) as Partial<T>
}

/**
 * Deep clone an object.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}

// ═══════════════════════════════════════════════════════════════════════════════
// Async Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sleep for a specified duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxRetries) {
        await sleep(baseDelay * Math.pow(2, attempt))
      }
    }
  }

  throw lastError
}

// ═══════════════════════════════════════════════════════════════════════════════
// Browser Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if code is running in browser.
 */
export const isBrowser = typeof window !== 'undefined'

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!isBrowser) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Download a file from a URL or blob.
 */
export function downloadFile(url: string, filename: string): void {
  if (!isBrowser) return
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
