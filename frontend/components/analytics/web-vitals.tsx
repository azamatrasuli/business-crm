'use client'

import { useEffect } from 'react'
import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals'
import { logger } from '@/lib/logger'

/**
 * Web Vitals thresholds (Google's recommendations)
 */
const THRESHOLDS = {
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  INP: { good: 200, needsImprovement: 500 },
  LCP: { good: 2500, needsImprovement: 4000 },
  TTFB: { good: 800, needsImprovement: 1800 },
} as const

type MetricName = keyof typeof THRESHOLDS

/**
 * Get rating for a metric value
 */
function getRating(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name]
  if (value <= threshold.good) return 'good'
  if (value <= threshold.needsImprovement) return 'needs-improvement'
  return 'poor'
}

/**
 * Report metric to analytics/monitoring
 */
function reportMetric(metric: Metric) {
  const rating = getRating(metric.name as MetricName, metric.value)
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    const color = rating === 'good' ? '#22c55e' : rating === 'needs-improvement' ? '#eab308' : '#ef4444'
    console.log(
      `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${rating})`,
      `color: ${color}; font-weight: bold;`
    )
  }

  // Log to our logger for production
  logger.info(`Web Vital: ${metric.name}`, {
    name: metric.name,
    value: metric.value,
    rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  })

  // Send to analytics (Google Analytics, Vercel Analytics, etc.)
  // You can uncomment and configure based on your analytics provider:
  
  // // Google Analytics 4
  // if (typeof window.gtag === 'function') {
  //   window.gtag('event', metric.name, {
  //     value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
  //     event_category: 'Web Vitals',
  //     event_label: metric.id,
  //     non_interaction: true,
  //   })
  // }

  // // Vercel Analytics (if using @vercel/analytics)
  // if (typeof window.va === 'function') {
  //   window.va('track', metric.name, {
  //     value: metric.value,
  //     rating,
  //   })
  // }

  // Alert on poor performance in development
  if (process.env.NODE_ENV === 'development' && rating === 'poor') {
    console.warn(
      `⚠️ Poor ${metric.name} detected: ${metric.value.toFixed(2)}. ` +
      `Target: < ${THRESHOLDS[metric.name as MetricName].good}`
    )
  }
}

/**
 * Web Vitals monitoring component
 * 
 * Add this component to your root layout to automatically
 * track and report Core Web Vitals metrics.
 * 
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { WebVitals } from '@/components/analytics/web-vitals'
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <WebVitals />
 *         {children}
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export function WebVitals() {
  useEffect(() => {
    // Core Web Vitals (the 3 main metrics Google uses)
    onCLS(reportMetric)   // Cumulative Layout Shift
    onINP(reportMetric)   // Interaction to Next Paint (replaced FID)
    onLCP(reportMetric)   // Largest Contentful Paint

    // Additional metrics
    onFCP(reportMetric)   // First Contentful Paint
    onTTFB(reportMetric)  // Time to First Byte
  }, [])

  // This component doesn't render anything
  return null
}

/**
 * Hook to get Web Vitals data
 * Useful for displaying performance info in dev tools
 */
export function useWebVitals(callback?: (metric: Metric) => void) {
  useEffect(() => {
    const handler = callback || reportMetric
    
    onCLS(handler)
    onINP(handler)
    onLCP(handler)
    onFCP(handler)
    onTTFB(handler)
  }, [callback])
}

// Extend window type for analytics globals
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    va?: (event: string, name: string, data?: Record<string, unknown>) => void
  }
}

