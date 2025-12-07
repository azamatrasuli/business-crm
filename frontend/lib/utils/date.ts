/**
 * @fileoverview Date utility functions
 * Centralized date formatting and manipulation utilities.
 * Based on Code Quality Audit Framework - DRY principle.
 */

import { format, startOfDay, isBefore, isEqual, isAfter } from 'date-fns'

// ═══════════════════════════════════════════════════════════════════════════════
// Date Formatting
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format date as YYYY-MM-DD in local timezone (not UTC!)
 * Used for API requests and comparisons.
 */
export function formatISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format date for display (dd.MM.yyyy)
 */
export function formatDisplayDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return format(d, 'dd.MM.yyyy')
  } catch {
    return typeof date === 'string' ? date : '-'
  }
}

/**
 * Parse date string YYYY-MM-DD to local date (not UTC!)
 * Returns date at noon to avoid DST issues.
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-')
  const year = parseInt(parts[0] ?? '0', 10)
  const month = parseInt(parts[1] ?? '0', 10)
  const day = parseInt(parts[2] ?? '0', 10)
  return new Date(year, month - 1, day, 12, 0, 0)
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  return formatISODate(new Date())
}

// ═══════════════════════════════════════════════════════════════════════════════
// Date Comparisons
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a date is in the past (before today)
 */
export function isPastDate(date: Date | string | null | undefined): boolean {
  if (!date) return false
  const d = typeof date === 'string' ? new Date(date) : date
  const today = startOfDay(new Date())
  return isBefore(startOfDay(d), today)
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string | null | undefined): boolean {
  if (!date) return false
  const d = typeof date === 'string' ? new Date(date) : date
  const today = startOfDay(new Date())
  return isEqual(startOfDay(d), today)
}

/**
 * Check if a date is in the future (after today)
 */
export function isFutureDate(date: Date | string | null | undefined): boolean {
  if (!date) return false
  const d = typeof date === 'string' ? new Date(date) : date
  const today = startOfDay(new Date())
  return isAfter(startOfDay(d), today)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cutoff Time
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if cutoff time has passed for today.
 * @param cutoffTime - Time string in HH:mm format
 */
export function hasCutoffPassed(cutoffTime: string | null): boolean {
  if (!cutoffTime) return false
  
  const parts = cutoffTime.split(':')
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false
  
  const now = new Date()
  const cutoff = new Date()
  cutoff.setHours(hours, minutes, 0, 0)
  
  return now > cutoff
}

/**
 * Format cutoff time for display with message.
 */
export function formatCutoffMessage(cutoffTime: string | null): string {
  if (!cutoffTime) return 'Изменения на сегодня закрыты'
  return `Изменения на сегодня закрыты в ${cutoffTime}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Date Navigation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the previous day's date.
 */
export function getPreviousDay(date: Date | string): Date {
  const d = typeof date === 'string' ? parseLocalDate(date) : date
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12, 0, 0)
}

/**
 * Get the next day's date.
 */
export function getNextDay(date: Date | string): Date {
  const d = typeof date === 'string' ? parseLocalDate(date) : date
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12, 0, 0)
}

