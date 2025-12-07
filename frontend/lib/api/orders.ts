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
  frozenAt: string | null;
  frozenReason: string | null;
  replacementOrderId: string | null;
  replacementOrder: Order | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionInfo {
  id: string;
  originalEndDate: string | null;
  endDate: string | null;
  frozenDaysCount: number;
  totalDays: number;
}

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

export interface FreezeOrderRequest {
  reason?: string;
}

export interface FreezePeriodRequest {
  employeeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Заморозить заказ (отменить обед с переносом в конец подписки)
 */
export async function freezeOrder(orderId: string, reason?: string): Promise<FreezeOrderResponse> {
  const response = await apiClient.post<FreezeOrderResponse>(`/orders/${orderId}/freeze`, { reason });
  return response.data;
}

/**
 * Разморозить заказ (вернуть в активное состояние)
 */
export async function unfreezeOrder(orderId: string): Promise<FreezeOrderResponse> {
  const response = await apiClient.post<FreezeOrderResponse>(`/orders/${orderId}/unfreeze`);
  return response.data;
}

/**
 * Заморозить период (несколько дней, например отпуск)
 */
export async function freezePeriod(
  employeeId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<FreezePeriodResponse> {
  const response = await apiClient.post<FreezePeriodResponse>('/orders/freeze-period', {
    employeeId,
    startDate,
    endDate,
    reason,
  });
  return response.data;
}

/**
 * Получить информацию о заморозках сотрудника
 */
export async function getEmployeeFreezeInfo(employeeId: string): Promise<EmployeeFreezeInfo> {
  const response = await apiClient.get<EmployeeFreezeInfo>(`/orders/employee/${employeeId}/freeze-info`);
  return response.data;
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

