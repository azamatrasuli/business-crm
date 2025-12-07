/**
 * @fileoverview Analytics Adapter
 * Abstraction layer for analytics services.
 * Supports multiple providers (Google Analytics, Mixpanel, etc.)
 */

import { useEffect, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnalyticsAdapter {
  /** Track page view */
  trackPageView(page: string, properties?: Record<string, unknown>): void
  
  /** Track custom event */
  trackEvent(event: string, properties?: Record<string, unknown>): void
  
  /** Identify user */
  identify(userId: string, traits?: Record<string, unknown>): void
  
  /** Reset identity (on logout) */
  reset(): void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Google Analytics Adapter
// ═══════════════════════════════════════════════════════════════════════════════

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

class GoogleAnalyticsAdapter implements AnalyticsAdapter {
  private measurementId: string

  constructor(measurementId: string) {
    this.measurementId = measurementId
  }

  trackPageView(page: string, properties?: Record<string, unknown>) {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('event', 'page_view', {
      page_path: page,
      page_title: document.title,
      ...properties,
    })
  }

  trackEvent(event: string, properties?: Record<string, unknown>) {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('event', event, properties)
  }

  identify(userId: string, traits?: Record<string, unknown>) {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('config', this.measurementId, {
      user_id: userId,
      ...traits,
    })
  }

  reset() {
    if (typeof window === 'undefined' || !window.gtag) return

    window.gtag('config', this.measurementId, {
      user_id: null,
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Console Adapter (Development)
// ═══════════════════════════════════════════════════════════════════════════════

class ConsoleAnalyticsAdapter implements AnalyticsAdapter {
  private prefix = '[Analytics]'

  trackPageView(page: string, properties?: Record<string, unknown>) {
    console.log(`${this.prefix} Page View:`, page, properties)
  }

  trackEvent(event: string, properties?: Record<string, unknown>) {
    console.log(`${this.prefix} Event:`, event, properties)
  }

  identify(userId: string, traits?: Record<string, unknown>) {
    console.log(`${this.prefix} Identify:`, userId, traits)
  }

  reset() {
    console.log(`${this.prefix} Reset`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Noop Adapter (when analytics is disabled)
// ═══════════════════════════════════════════════════════════════════════════════

class NoopAnalyticsAdapter implements AnalyticsAdapter {
  trackPageView() {}
  trackEvent() {}
  identify() {}
  reset() {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Multi Adapter (send to multiple providers)
// ═══════════════════════════════════════════════════════════════════════════════

class MultiAnalyticsAdapter implements AnalyticsAdapter {
  constructor(private adapters: AnalyticsAdapter[]) {}

  trackPageView(page: string, properties?: Record<string, unknown>) {
    this.adapters.forEach((a) => a.trackPageView(page, properties))
  }

  trackEvent(event: string, properties?: Record<string, unknown>) {
    this.adapters.forEach((a) => a.trackEvent(event, properties))
  }

  identify(userId: string, traits?: Record<string, unknown>) {
    this.adapters.forEach((a) => a.identify(userId, traits))
  }

  reset() {
    this.adapters.forEach((a) => a.reset())
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create analytics adapter based on environment.
 */
export function createAnalyticsAdapter(): AnalyticsAdapter {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const isDev = process.env.NODE_ENV === 'development'

  const adapters: AnalyticsAdapter[] = []

  // Add console adapter in dev
  if (isDev) {
    adapters.push(new ConsoleAnalyticsAdapter())
  }

  // Add GA adapter if configured
  if (gaMeasurementId && typeof window !== 'undefined') {
    adapters.push(new GoogleAnalyticsAdapter(gaMeasurementId))
  }

  // Return appropriate adapter
  if (adapters.length === 0) {
    return new NoopAnalyticsAdapter()
  }

  if (adapters.length === 1) {
    return adapters[0]
  }

  return new MultiAnalyticsAdapter(adapters)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let analyticsInstance: AnalyticsAdapter | null = null

export function getAnalytics(): AnalyticsAdapter {
  if (!analyticsInstance) {
    analyticsInstance = createAnalyticsAdapter()
  }
  return analyticsInstance
}

// ═══════════════════════════════════════════════════════════════════════════════
// React Hooks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook for tracking page views automatically.
 * Add to your root layout component.
 */
export function usePageViewTracking() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    getAnalytics().trackPageView(url)
  }, [pathname, searchParams])
}

/**
 * Hook for tracking custom events.
 * 
 * @example
 * const track = useTrackEvent()
 * track('button_clicked', { button_id: 'submit' })
 */
export function useTrackEvent() {
  return useCallback((event: string, properties?: Record<string, unknown>) => {
    getAnalytics().trackEvent(event, properties)
  }, [])
}

/**
 * Hook for identifying users.
 * Call after login.
 */
export function useIdentifyUser() {
  return useCallback((userId: string, traits?: Record<string, unknown>) => {
    getAnalytics().identify(userId, traits)
  }, [])
}

/**
 * Hook for resetting identity.
 * Call on logout.
 */
export function useResetAnalytics() {
  return useCallback(() => {
    getAnalytics().reset()
  }, [])
}

// ═══════════════════════════════════════════════════════════════════════════════
// Predefined Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Standard event names for consistency.
 */
export const AnalyticsEvents = {
  // Auth
  LOGIN: 'login',
  LOGOUT: 'logout',
  SIGNUP: 'signup',
  
  // Employees
  EMPLOYEE_VIEWED: 'employee_viewed',
  EMPLOYEE_CREATED: 'employee_created',
  EMPLOYEE_UPDATED: 'employee_updated',
  EMPLOYEE_DELETED: 'employee_deleted',
  
  // Orders
  ORDER_CREATED: 'order_created',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_FROZEN: 'order_frozen',
  
  // Subscriptions
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_PAUSED: 'subscription_paused',
  SUBSCRIPTION_RESUMED: 'subscription_resumed',
  
  // UI
  DIALOG_OPENED: 'dialog_opened',
  FILTER_APPLIED: 'filter_applied',
  SEARCH_PERFORMED: 'search_performed',
  EXPORT_DOWNLOADED: 'export_downloaded',
} as const

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]

