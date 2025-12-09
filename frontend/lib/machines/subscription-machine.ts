/**
 * @fileoverview Subscription State Machine
 * XState-like state machine for managing subscription lifecycle.
 * Provides predictable state transitions and prevents invalid states.
 * 
 * Note: This is a lightweight implementation without XState dependency.
 * For more complex scenarios, consider installing xstate package.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Possible subscription states */
export type SubscriptionState =
  | 'pending'    // Created but not yet active
  | 'active'     // Currently active
  | 'paused'     // Temporarily paused
  | 'frozen'     // Specific dates frozen
  | 'expired'    // End date passed
  | 'cancelled'  // Manually cancelled
  | 'completed'  // Successfully completed

/** Events that can trigger state transitions */
export type SubscriptionEvent =
  | { type: 'ACTIVATE' }
  | { type: 'PAUSE'; reason?: string }
  | { type: 'RESUME' }
  | { type: 'FREEZE'; dates: string[] }
  | { type: 'UNFREEZE'; dates: string[] }
  | { type: 'CANCEL'; reason?: string }
  | { type: 'EXPIRE' }
  | { type: 'COMPLETE' }

/** Context data stored in the machine */
export interface SubscriptionContext {
  /** Number of times paused */
  pauseCount: number
  /** Total paused days */
  totalPausedDays: number
  /** Dates that are frozen */
  frozenDates: string[]
  /** Reason for pause/cancel */
  reason?: string
  /** Timestamps */
  activatedAt?: Date
  pausedAt?: Date
  cancelledAt?: Date
  completedAt?: Date
}

/** State machine configuration */
interface MachineConfig {
  initial: SubscriptionState
  context: SubscriptionContext
  states: Record<SubscriptionState, StateConfig>
}

interface StateConfig {
  on?: Partial<Record<SubscriptionEvent['type'], TransitionConfig>>
  entry?: (context: SubscriptionContext) => SubscriptionContext
  final?: boolean
}

interface TransitionConfig {
  target: SubscriptionState
  guard?: (context: SubscriptionContext, event: SubscriptionEvent) => boolean
  action?: (context: SubscriptionContext, event: SubscriptionEvent) => SubscriptionContext
}

// ═══════════════════════════════════════════════════════════════════════════════
// Machine Definition
// ═══════════════════════════════════════════════════════════════════════════════

const subscriptionMachineConfig: MachineConfig = {
  initial: 'pending',
  context: {
    pauseCount: 0,
    totalPausedDays: 0,
    frozenDates: [],
  },
  states: {
    pending: {
      on: {
        ACTIVATE: {
          target: 'active',
          action: (ctx) => ({
            ...ctx,
            activatedAt: new Date(),
          }),
        },
        CANCEL: {
          target: 'cancelled',
          action: (ctx, event) => ({
            ...ctx,
            reason: (event as { type: 'CANCEL'; reason?: string }).reason,
            cancelledAt: new Date(),
          }),
        },
      },
    },

    active: {
      on: {
        PAUSE: {
          target: 'paused',
          guard: (ctx) => ctx.pauseCount < 3, // Max 3 pauses
          action: (ctx, event) => ({
            ...ctx,
            pauseCount: ctx.pauseCount + 1,
            pausedAt: new Date(),
            reason: (event as { type: 'PAUSE'; reason?: string }).reason,
          }),
        },
        FREEZE: {
          target: 'active', // Stay in active state
          action: (ctx, event) => ({
            ...ctx,
            frozenDates: [
              ...new Set([
                ...ctx.frozenDates,
                ...(event as { type: 'FREEZE'; dates: string[] }).dates,
              ]),
            ],
          }),
        },
        UNFREEZE: {
          target: 'active',
          action: (ctx, event) => {
            const datesToRemove = (event as { type: 'UNFREEZE'; dates: string[] }).dates
            return {
              ...ctx,
              frozenDates: ctx.frozenDates.filter((d) => !datesToRemove.includes(d)),
            }
          },
        },
        CANCEL: {
          target: 'cancelled',
          action: (ctx, event) => ({
            ...ctx,
            reason: (event as { type: 'CANCEL'; reason?: string }).reason,
            cancelledAt: new Date(),
          }),
        },
        EXPIRE: {
          target: 'expired',
        },
        COMPLETE: {
          target: 'completed',
          action: (ctx) => ({
            ...ctx,
            completedAt: new Date(),
          }),
        },
      },
    },

    paused: {
      on: {
        RESUME: {
          target: 'active',
          action: (ctx) => {
            const pausedDays = ctx.pausedAt
              ? Math.ceil((Date.now() - ctx.pausedAt.getTime()) / (1000 * 60 * 60 * 24))
              : 0
            return {
              ...ctx,
              totalPausedDays: ctx.totalPausedDays + pausedDays,
              pausedAt: undefined,
              reason: undefined,
            }
          },
        },
        CANCEL: {
          target: 'cancelled',
          action: (ctx, event) => ({
            ...ctx,
            reason: (event as { type: 'CANCEL'; reason?: string }).reason,
            cancelledAt: new Date(),
          }),
        },
      },
    },

    frozen: {
      // Frozen is a sub-state of active, handled via frozenDates array
      on: {},
    },

    expired: {
      final: true,
    },

    cancelled: {
      final: true,
    },

    completed: {
      final: true,
    },
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// State Machine Class
// ═══════════════════════════════════════════════════════════════════════════════

export class SubscriptionMachine {
  private _state: SubscriptionState
  private _context: SubscriptionContext
  private config: MachineConfig

  constructor(
    initialState?: SubscriptionState,
    initialContext?: Partial<SubscriptionContext>
  ) {
    this.config = subscriptionMachineConfig
    this._state = initialState || this.config.initial
    this._context = { ...this.config.context, ...initialContext }
  }

  /** Current state */
  get state(): SubscriptionState {
    return this._state
  }

  /** Current context */
  get context(): SubscriptionContext {
    return { ...this._context }
  }

  /** Check if current state is final */
  get isFinal(): boolean {
    return this.config.states[this._state].final === true
  }

  /** Get available events for current state */
  get availableEvents(): SubscriptionEvent['type'][] {
    const stateConfig = this.config.states[this._state]
    return Object.keys(stateConfig.on || {}) as SubscriptionEvent['type'][]
  }

  /** Check if an event can be sent in current state */
  can(eventType: SubscriptionEvent['type']): boolean {
    const stateConfig = this.config.states[this._state]
    const transition = stateConfig.on?.[eventType]
    
    if (!transition) return false
    if (!transition.guard) return true
    
    // Create a minimal event for guard check
    const event = { type: eventType } as SubscriptionEvent
    return transition.guard(this._context, event)
  }

  /** Send an event to the machine */
  send(event: SubscriptionEvent): { state: SubscriptionState; context: SubscriptionContext; changed: boolean } {
    const stateConfig = this.config.states[this._state]
    const transition = stateConfig.on?.[event.type]

    // No transition defined
    if (!transition) {
      console.warn(`No transition for event "${event.type}" in state "${this._state}"`)
      return { state: this._state, context: this._context, changed: false }
    }

    // Check guard
    if (transition.guard && !transition.guard(this._context, event)) {
      console.warn(`Guard prevented transition for event "${event.type}"`)
      return { state: this._state, context: this._context, changed: false }
    }

    // Apply action if defined
    if (transition.action) {
      this._context = transition.action(this._context, event)
    }

    // Transition to new state
    const previousState = this._state
    this._state = transition.target

    // Apply entry action for new state
    const newStateConfig = this.config.states[this._state]
    if (newStateConfig.entry) {
      this._context = newStateConfig.entry(this._context)
    }

    return {
      state: this._state,
      context: this._context,
      changed: previousState !== this._state,
    }
  }

  /** Check if a date is frozen */
  isDateFrozen(date: string): boolean {
    return this._context.frozenDates.includes(date)
  }

  /** Get remaining freezable slots (if there's a limit) */
  get canPause(): boolean {
    return this.can('PAUSE')
  }

  /** Create a snapshot of current state */
  snapshot(): { state: SubscriptionState; context: SubscriptionContext } {
    return {
      state: this._state,
      context: { ...this._context },
    }
  }

  /** Restore from snapshot */
  restore(snapshot: { state: SubscriptionState; context: SubscriptionContext }): void {
    this._state = snapshot.state
    this._context = { ...snapshot.context }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory & Hook
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new subscription machine.
 */
export function createSubscriptionMachine(
  initialState?: SubscriptionState,
  initialContext?: Partial<SubscriptionContext>
): SubscriptionMachine {
  return new SubscriptionMachine(initialState, initialContext)
}

/**
 * Map API status to machine state.
 * Supports both Russian (from backend) and English status values.
 */
export function mapApiStatusToState(apiStatus: string): SubscriptionState {
  // Russian status map (from backend)
  const russianStatusMap: Record<string, SubscriptionState> = {
    'Активна': 'active',
    'Активный': 'active',
    'Приостановлена': 'paused',
    'На паузе': 'paused',  // DEPRECATED: Legacy alias
    'Завершена': 'completed',
    'Завершен': 'completed',
    'Отменена': 'cancelled',
    'Истекла': 'expired',
    'Заморожена': 'frozen',
  }
  
  // English status map (for compatibility)
  const englishStatusMap: Record<string, SubscriptionState> = {
    PENDING: 'pending',
    ACTIVE: 'active',
    PAUSED: 'paused',
    FROZEN: 'frozen',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
  }
  
  // Check Russian first, then English
  return russianStatusMap[apiStatus] || englishStatusMap[apiStatus.toUpperCase()] || 'pending'
}

/**
 * Get human-readable label for state.
 */
export function getStateLabel(state: SubscriptionState): string {
  const labels: Record<SubscriptionState, string> = {
    pending: 'Ожидает активации',
    active: 'Активна',
    paused: 'Приостановлена',  // NOTE: "На паузе" is deprecated
    frozen: 'Заморожена',
    expired: 'Истекла',
    cancelled: 'Отменена',
    completed: 'Завершена',
  }
  return labels[state]
}

/**
 * Get color for state (for badges).
 */
export function getStateColor(state: SubscriptionState): string {
  const colors: Record<SubscriptionState, string> = {
    pending: 'yellow',
    active: 'green',
    paused: 'orange',
    frozen: 'blue',
    expired: 'gray',
    cancelled: 'red',
    completed: 'green',
  }
  return colors[state]
}

