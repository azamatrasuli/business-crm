/**
 * @fileoverview State Machines barrel export
 * Finite State Machines for complex business logic.
 */

// Subscription machine
export {
  SubscriptionMachine,
  createSubscriptionMachine,
  mapApiStatusToState,
  getStateLabel,
  getStateColor,
  type SubscriptionState,
  type SubscriptionEvent,
  type SubscriptionContext,
} from './subscription-machine'

// Order machine
export {
  OrderMachine,
  createOrderMachine,
  mapApiOrderStatusToState,
  getOrderStateLabel,
  getOrderStateColor,
  canModifyOrder,
  canFreezeOrder,
  type OrderState,
  type OrderEvent,
  type OrderContext,
} from './order-machine'

