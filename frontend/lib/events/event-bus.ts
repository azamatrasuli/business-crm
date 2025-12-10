/**
 * @fileoverview Event Bus
 * Simple pub/sub event system for cross-component communication.
 * Useful when React Query invalidation isn't enough.
 */

import { useEffect, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

type EventCallback<T = unknown> = (data: T) => void
type UnsubscribeFn = () => void

// ═══════════════════════════════════════════════════════════════════════════════
// Event Bus Class
// ═══════════════════════════════════════════════════════════════════════════════

class EventBus {
  private listeners = new Map<string, Set<EventCallback>>()

  /**
   * Subscribe to an event
   * @returns Unsubscribe function
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): UnsubscribeFn {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as EventCallback)

    return () => this.off(event, callback)
  }

  /**
   * Unsubscribe from an event
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback as EventCallback)
  }

  /**
   * Emit an event
   */
  emit<T = unknown>(event: string, data: T): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data)
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error)
      }
    })
  }

  /**
   * Subscribe to an event once
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): UnsubscribeFn {
    const wrappedCallback: EventCallback<T> = (data) => {
      this.off(event, wrappedCallback)
      callback(data)
    }
    return this.on(event, wrappedCallback)
  }

  /**
   * Remove all listeners for an event (or all events)
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * Get listener count for debugging
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

export const eventBus = new EventBus()

// ═══════════════════════════════════════════════════════════════════════════════
// Application Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type-safe event names for the application.
 * Add new events here as needed.
 */
export const AppEvents = {
  // Employee events
  EMPLOYEE_CREATED: 'employee:created',
  EMPLOYEE_UPDATED: 'employee:updated',
  EMPLOYEE_DELETED: 'employee:deleted',
  EMPLOYEE_ACTIVATED: 'employee:activated',
  EMPLOYEE_DEACTIVATED: 'employee:deactivated',

  // Order events
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_CANCELLED: 'order:cancelled',
  // FREEZE DISABLED (2025-01-09): events kept for type compatibility
  ORDER_FROZEN: 'order:frozen',      // DEPRECATED: do not use
  ORDER_UNFROZEN: 'order:unfrozen',  // DEPRECATED: do not use

  // Subscription events
  SUBSCRIPTION_CREATED: 'subscription:created',
  SUBSCRIPTION_UPDATED: 'subscription:updated',
  SUBSCRIPTION_PAUSED: 'subscription:paused',
  SUBSCRIPTION_RESUMED: 'subscription:resumed',
  SUBSCRIPTION_CANCELLED: 'subscription:cancelled',

  // Auth events
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_SESSION_EXPIRED: 'auth:session-expired',

  // UI events
  DIALOG_OPENED: 'ui:dialog-opened',
  DIALOG_CLOSED: 'ui:dialog-closed',
  TOAST_SHOWN: 'ui:toast-shown',

  // Data refresh events
  REFRESH_DASHBOARD: 'refresh:dashboard',
  REFRESH_EMPLOYEES: 'refresh:employees',
  REFRESH_ORDERS: 'refresh:orders',
} as const

export type AppEvent = (typeof AppEvents)[keyof typeof AppEvents]

// ═══════════════════════════════════════════════════════════════════════════════
// Event Payload Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface EventPayloads {
  [AppEvents.EMPLOYEE_CREATED]: { id: string; name: string }
  [AppEvents.EMPLOYEE_UPDATED]: { id: string; changes: Record<string, unknown> }
  [AppEvents.EMPLOYEE_DELETED]: { id: string }
  [AppEvents.EMPLOYEE_ACTIVATED]: { id: string }
  [AppEvents.EMPLOYEE_DEACTIVATED]: { id: string }

  [AppEvents.ORDER_CREATED]: { id: string; employeeId?: string }
  [AppEvents.ORDER_UPDATED]: { id: string }
  [AppEvents.ORDER_CANCELLED]: { id: string; reason?: string }
  [AppEvents.ORDER_FROZEN]: { id: string; date: string }
  [AppEvents.ORDER_UNFROZEN]: { id: string; date: string }

  [AppEvents.SUBSCRIPTION_CREATED]: { id: string; employeeId: string; type: 'LUNCH' | 'COMPENSATION' }
  [AppEvents.SUBSCRIPTION_UPDATED]: { id: string }
  [AppEvents.SUBSCRIPTION_PAUSED]: { id: string }
  [AppEvents.SUBSCRIPTION_RESUMED]: { id: string }
  [AppEvents.SUBSCRIPTION_CANCELLED]: { id: string }

  [AppEvents.AUTH_LOGIN]: { userId: string }
  [AppEvents.AUTH_LOGOUT]: Record<string, never>
  [AppEvents.AUTH_SESSION_EXPIRED]: Record<string, never>

  [AppEvents.DIALOG_OPENED]: { id: string }
  [AppEvents.DIALOG_CLOSED]: { id: string }
  [AppEvents.TOAST_SHOWN]: { message: string; type: 'success' | 'error' | 'info' }

  [AppEvents.REFRESH_DASHBOARD]: Record<string, never>
  [AppEvents.REFRESH_EMPLOYEES]: Record<string, never>
  [AppEvents.REFRESH_ORDERS]: Record<string, never>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Type-Safe Emit Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type-safe event emission
 */
export function emitEvent<E extends AppEvent>(
  event: E,
  data: E extends keyof EventPayloads ? EventPayloads[E] : never
): void {
  eventBus.emit(event, data)
}

// ═══════════════════════════════════════════════════════════════════════════════
// React Hook
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * React hook for subscribing to events.
 * Automatically unsubscribes on unmount.
 *
 * @example
 * // Subscribe to employee created event
 * useEventBus(AppEvents.EMPLOYEE_CREATED, (data) => {
 *   console.log('Employee created:', data.id)
 *   refetch()
 * })
 *
 * @example
 * // Subscribe to multiple events
 * useEventBus([AppEvents.EMPLOYEE_CREATED, AppEvents.EMPLOYEE_UPDATED], () => {
 *   refetch()
 * })
 */
export function useEventBus<E extends AppEvent>(
  event: E | E[],
  callback: E extends keyof EventPayloads
    ? (data: EventPayloads[E]) => void
    : (data: unknown) => void
): void {
  const stableCallback = useCallback(callback, [callback])

  useEffect(() => {
    const events = Array.isArray(event) ? event : [event]
    const unsubscribes = events.map((e) => eventBus.on(e, stableCallback as EventCallback))

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }, [event, stableCallback])
}

/**
 * Hook that returns an emit function for a specific event.
 *
 * @example
 * const emitEmployeeCreated = useEmitEvent(AppEvents.EMPLOYEE_CREATED)
 * // Later...
 * emitEmployeeCreated({ id: '123', name: 'John' })
 */
export function useEmitEvent<E extends AppEvent>(event: E) {
  return useCallback(
    (data: E extends keyof EventPayloads ? EventPayloads[E] : never) => {
      emitEvent(event, data)
    },
    [event]
  )
}

