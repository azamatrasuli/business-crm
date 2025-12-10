/**
 * @fileoverview Order State Machine
 * State machine for managing order lifecycle.
 * Provides predictable state transitions for orders.
 *
 * FREEZE FUNCTIONALITY DISABLED (2025-01-09)
 * The 'frozen' state is kept for type compatibility only.
 * Freeze transitions are removed from the state machine.
 */

import { logger } from '@/lib/logger'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Possible order states */
export type OrderState =
  | 'pending'     // Order created, not yet confirmed
  | 'confirmed'   // Order confirmed, awaiting preparation
  | 'preparing'   // Being prepared
  | 'ready'       // Ready for delivery/pickup
  | 'delivered'   // Successfully delivered
  | 'frozen'      // DISABLED: kept for type compatibility only
  | 'cancelled'   // Order cancelled

/** Events that can trigger state transitions */
export type OrderEvent =
  | { type: 'CONFIRM' }
  | { type: 'START_PREPARING' }
  | { type: 'MARK_READY' }
  | { type: 'DELIVER' }
  // FREEZE DISABLED: events kept for type compatibility
  | { type: 'FREEZE'; reason?: string }
  | { type: 'UNFREEZE' }
  | { type: 'CANCEL'; reason?: string }

/** Context data stored in the machine */
export interface OrderContext {
  /** Reason for cancel */
  reason?: string
  /** Was this order rescheduled */
  rescheduled: boolean
  /** Original date if rescheduled */
  originalDate?: string
  /** Timestamps */
  confirmedAt?: Date
  preparedAt?: Date
  deliveredAt?: Date
  cancelledAt?: Date
  // frozenAt?: Date // FREEZE DISABLED (2025-01-09)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Transition Map
// ═══════════════════════════════════════════════════════════════════════════════

type TransitionMap = {
  [S in OrderState]?: {
    [E in OrderEvent['type']]?: OrderState
  }
}

const transitions: TransitionMap = {
  pending: {
    CONFIRM: 'confirmed',
    // FREEZE: 'frozen', // FREEZE DISABLED (2025-01-09)
    CANCEL: 'cancelled',
  },
  confirmed: {
    START_PREPARING: 'preparing',
    // FREEZE: 'frozen', // FREEZE DISABLED (2025-01-09)
    CANCEL: 'cancelled',
  },
  preparing: {
    MARK_READY: 'ready',
    CANCEL: 'cancelled',
  },
  ready: {
    DELIVER: 'delivered',
    CANCEL: 'cancelled',
  },
  // FREEZE DISABLED (2025-01-09): frozen state transitions removed
  // frozen: {
  //   UNFREEZE: 'pending',
  //   CANCEL: 'cancelled',
  // },
  // delivered and cancelled are final states
}

// ═══════════════════════════════════════════════════════════════════════════════
// State Machine Class
// ═══════════════════════════════════════════════════════════════════════════════

export class OrderMachine {
  private _state: OrderState
  private _context: OrderContext

  constructor(
    initialState: OrderState = 'pending',
    initialContext?: Partial<OrderContext>
  ) {
    this._state = initialState
    this._context = {
      rescheduled: false,
      ...initialContext,
    }
  }

  /** Current state */
  get state(): OrderState {
    return this._state
  }

  /** Current context */
  get context(): OrderContext {
    return { ...this._context }
  }

  /** Check if current state is final */
  get isFinal(): boolean {
    return this._state === 'delivered' || this._state === 'cancelled'
  }

  /** Get available events for current state */
  get availableEvents(): OrderEvent['type'][] {
    const stateTransitions = transitions[this._state]
    return stateTransitions ? (Object.keys(stateTransitions) as OrderEvent['type'][]) : []
  }

  /** Check if an event can be sent */
  can(eventType: OrderEvent['type']): boolean {
    const stateTransitions = transitions[this._state]
    return stateTransitions?.[eventType] !== undefined
  }

  /** Send an event to the machine */
  send(event: OrderEvent): {
    state: OrderState
    context: OrderContext
    changed: boolean
  } {
    const stateTransitions = transitions[this._state]
    const nextState = stateTransitions?.[event.type]

    if (!nextState) {
      logger.warn(`No transition for event "${event.type}" in state "${this._state}"`)
      return { state: this._state, context: this._context, changed: false }
    }

    const previousState = this._state
    this._state = nextState

    // Update context based on event
    switch (event.type) {
      case 'CONFIRM':
        this._context.confirmedAt = new Date()
        break
      case 'START_PREPARING':
        this._context.preparedAt = new Date()
        break
      case 'DELIVER':
        this._context.deliveredAt = new Date()
        break
      // FREEZE DISABLED (2025-01-09): freeze events ignored
      // case 'FREEZE':
      //   this._context.frozenAt = new Date()
      //   this._context.reason = (event as { type: 'FREEZE'; reason?: string }).reason
      //   break
      // case 'UNFREEZE':
      //   this._context.frozenAt = undefined
      //   this._context.reason = undefined
      //   break
      case 'CANCEL':
        this._context.cancelledAt = new Date()
        this._context.reason = (event as { type: 'CANCEL'; reason?: string }).reason
        break
    }

    return {
      state: this._state,
      context: this._context,
      changed: previousState !== this._state,
    }
  }

  /** Create a snapshot */
  snapshot(): { state: OrderState; context: OrderContext } {
    return {
      state: this._state,
      context: { ...this._context },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new order machine.
 */
export function createOrderMachine(
  initialState?: OrderState,
  initialContext?: Partial<OrderContext>
): OrderMachine {
  return new OrderMachine(initialState, initialContext)
}

/**
 * Map API status to machine state.
 */
export function mapApiOrderStatusToState(apiStatus: string): OrderState {
  const statusMap: Record<string, OrderState> = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PREPARING: 'preparing',
    READY: 'ready',
    DELIVERED: 'delivered',
    // FROZEN: 'frozen', // FREEZE DISABLED (2025-01-09)
    CANCELLED: 'cancelled',
    // Legacy/alternative mappings
    ACTIVE: 'confirmed',
    COMPLETED: 'delivered',
    FROZEN: 'cancelled',  // Legacy frozen orders treated as cancelled
  }
  return statusMap[apiStatus.toUpperCase()] || 'pending'
}

/**
 * Get human-readable label for state.
 */
export function getOrderStateLabel(state: OrderState): string {
  const labels: Record<OrderState, string> = {
    pending: 'Ожидает',
    confirmed: 'Подтверждён',
    preparing: 'Готовится',
    ready: 'Готов',
    delivered: 'Доставлен',
    frozen: 'Отменён',  // FREEZE DISABLED: treat as cancelled
    cancelled: 'Отменён',
  }
  return labels[state]
}

/**
 * Get color for state (for badges).
 */
export function getOrderStateColor(state: OrderState): 'default' | 'secondary' | 'destructive' | 'outline' {
  const colors: Record<OrderState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    confirmed: 'default',
    preparing: 'default',
    ready: 'default',
    delivered: 'default',
    frozen: 'destructive',  // FREEZE DISABLED: treat as cancelled
    cancelled: 'destructive',
  }
  return colors[state]
}

/**
 * Check if order can be modified (not in final state).
 */
export function canModifyOrder(state: OrderState): boolean {
  return state !== 'delivered' && state !== 'cancelled' && state !== 'frozen'
}

/**
 * @deprecated FREEZE FUNCTIONALITY DISABLED (2025-01-09)
 * Always returns false. Use pause instead.
 */
export function canFreezeOrder(_state: OrderState): boolean {
  // FREEZE DISABLED: always return false
  return false
}

