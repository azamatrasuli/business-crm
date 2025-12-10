import apiClient from './client';

// =============================================================================
// Types
// =============================================================================

export interface Order {
  id: string;
  companyId: string;
  projectId: string;
  employeeId: string | null;
  employeeName: string | null;
  guestName: string | null;
  isGuestOrder: boolean;
  comboType: string;
  price: number;
  currencyCode: string;
  status: string;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionInfo {
  id: string;
  endDate: string | null;
  totalDays: number;
}

// =============================================================================
// API Functions
// =============================================================================

// ═══════════════════════════════════════════════════════════════════════════════
// FREEZE FUNCTIONALITY DISABLED (2025-01-09)
// The freeze feature has been temporarily removed from the system.
// These stub functions throw errors to prevent accidental usage.
// Backend endpoints: OrdersController.cs - COMMENTED OUT
// ═══════════════════════════════════════════════════════════════════════════════

// Freeze types (stub - for type compatibility only)
export interface FreezeOrderResponse {
  order: Order;
  replacementOrder: Order | null;
  subscription: SubscriptionInfo;
}

export interface FreezePeriodResponse {
  frozenOrders: Order[];
  replacementOrders: Order[];
  subscription: SubscriptionInfo;
  frozenDaysCount: number;
}

export interface EmployeeFreezeInfo {
  employeeId: string;
  employeeName: string;
  freezesThisWeek: number;
  maxFreezesPerWeek: number;
  canFreeze: boolean;
  remainingFreezes: number;
  frozenOrders: Order[];
  subscription: SubscriptionInfo | null;
  weekStart: string;
  weekEnd: string;
}

/**
 * @deprecated FREEZE FUNCTIONALITY DISABLED
 * This function will throw an error. Do not use.
 */
export async function freezeOrder(_orderId: string, _reason?: string): Promise<FreezeOrderResponse> {
  throw new Error('FREEZE_DISABLED: Функционал заморозки временно отключён')
}

/**
 * @deprecated FREEZE FUNCTIONALITY DISABLED  
 * This function will throw an error. Do not use.
 */
export async function unfreezeOrder(_orderId: string): Promise<FreezeOrderResponse> {
  throw new Error('FREEZE_DISABLED: Функционал заморозки временно отключён')
}

/**
 * @deprecated FREEZE FUNCTIONALITY DISABLED
 * This function will throw an error. Do not use.
 */
export async function freezePeriod(
  _employeeId: string,
  _startDate: string,
  _endDate: string,
  _reason?: string
): Promise<FreezePeriodResponse> {
  throw new Error('FREEZE_DISABLED: Функционал заморозки временно отключён')
}

/**
 * @deprecated FREEZE FUNCTIONALITY DISABLED
 * Returns stub data to prevent UI crashes. Freeze info always shows 0 available.
 */
export async function getEmployeeFreezeInfo(employeeId: string): Promise<EmployeeFreezeInfo> {
  // Return stub data instead of throwing to prevent UI crashes
  return {
    employeeId,
    employeeName: '',
    freezesThisWeek: 2, // Max out to disable freeze buttons
    maxFreezesPerWeek: 2,
    canFreeze: false,
    remainingFreezes: 0,
    frozenOrders: [],
    subscription: null,
    weekStart: new Date().toISOString(),
    weekEnd: new Date().toISOString(),
  }
}

/**
 * Получить заказы сотрудника за период
 */
export async function getEmployeeOrders(
  employeeId: string,
  params?: { startDate?: string; endDate?: string }
): Promise<Order[]> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await apiClient.get<Order[]>(`/orders/employee/${employeeId}${query}`);
  return response.data;
}
