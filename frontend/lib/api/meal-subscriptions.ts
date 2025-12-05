import apiClient from './client';

// Types
export interface MealSubscription {
  id: string;
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalAmount: number;
  paidAmount: number;
  isPaid: boolean;
  status: string;
  createdAt: string;
  totalAssignments: number;
  activeAssignments: number;
  frozenAssignments: number;
  pausedAssignments: number;
  pausedAt: string | null;
  pausedDaysCount: number;
}

export interface MealAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  assignmentDate: string;
  comboType: string;
  price: number;
  status: string;
  deliveryAddressId: string | null;
  deliveryAddressName: string | null;
  frozenAt: string | null;
  frozenReason: string | null;
  replacementDate: string | null;
}

export interface CalendarDay {
  date: string;
  totalAssignments: number;
  activeAssignments: number;
  frozenAssignments: number;
  deliveredAssignments: number;
  isWeekend: boolean;
  isPast: boolean;
}

export interface FreezeInfo {
  employeeId: string;
  remainingFreezes: number;
  usedThisWeek: number;
  weekLimit: number;
}

export interface EmployeeAssignment {
  employeeId: string;
  pattern: 'EVERY_DAY' | 'EVERY_OTHER_DAY' | 'CUSTOM';
  customDates?: string[];
  comboType: string;
  deliveryAddressId?: string;
}

export interface CreateSubscriptionRequest {
  projectId: string;
  startDate: string;
  endDate: string;
  employees: EmployeeAssignment[];
}

// API calls
export async function getSubscriptions(projectId: string): Promise<MealSubscription[]> {
  const response = await apiClient.get<MealSubscription[]>(`/meal-subscriptions?projectId=${projectId}`);
  return response.data;
}

export async function getSubscription(id: string): Promise<MealSubscription> {
  const response = await apiClient.get<MealSubscription>(`/meal-subscriptions/${id}`);
  return response.data;
}

export async function createSubscription(data: CreateSubscriptionRequest): Promise<MealSubscription> {
  const response = await apiClient.post<MealSubscription>('/meal-subscriptions', data);
  return response.data;
}

export async function cancelSubscription(id: string): Promise<void> {
  await apiClient.post(`/meal-subscriptions/${id}/cancel`);
}

export async function pauseSubscription(id: string): Promise<void> {
  await apiClient.post(`/meal-subscriptions/${id}/pause`);
}

export async function resumeSubscription(id: string): Promise<void> {
  await apiClient.post(`/meal-subscriptions/${id}/resume`);
}

export async function calculatePrice(data: CreateSubscriptionRequest): Promise<{ totalAmount: number }> {
  const response = await apiClient.post<{ totalAmount: number }>('/meal-subscriptions/price-preview', data);
  return response.data;
}

// Assignments
export async function getAssignments(subscriptionId: string, fromDate?: string, toDate?: string): Promise<MealAssignment[]> {
  const params = new URLSearchParams();
  if (fromDate) params.append('fromDate', fromDate);
  if (toDate) params.append('toDate', toDate);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get<MealAssignment[]>(`/meal-subscriptions/${subscriptionId}/assignments${query}`);
  return response.data;
}

export async function getEmployeeAssignments(employeeId: string, fromDate?: string, toDate?: string): Promise<MealAssignment[]> {
  const params = new URLSearchParams();
  if (fromDate) params.append('fromDate', fromDate);
  if (toDate) params.append('toDate', toDate);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get<MealAssignment[]>(`/meal-subscriptions/employees/${employeeId}/assignments${query}`);
  return response.data;
}

export async function updateAssignment(
  assignmentId: string,
  data: { comboType?: string; deliveryAddressId?: string }
): Promise<MealAssignment> {
  const response = await apiClient.put<MealAssignment>(`/meal-subscriptions/assignments/${assignmentId}`, data);
  return response.data;
}

export async function cancelAssignment(assignmentId: string): Promise<void> {
  await apiClient.post(`/meal-subscriptions/assignments/${assignmentId}/cancel`);
}

// Freeze
export async function getFreezeInfo(employeeId: string): Promise<FreezeInfo> {
  const response = await apiClient.get<FreezeInfo>(`/meal-subscriptions/employees/${employeeId}/freeze-info`);
  return response.data;
}

export async function freezeAssignment(assignmentId: string, reason?: string): Promise<MealAssignment> {
  const response = await apiClient.post<MealAssignment>(`/meal-subscriptions/assignments/${assignmentId}/freeze`, { reason });
  return response.data;
}

export async function unfreezeAssignment(assignmentId: string): Promise<MealAssignment> {
  const response = await apiClient.post<MealAssignment>(`/meal-subscriptions/assignments/${assignmentId}/unfreeze`);
  return response.data;
}

// Calendar
export async function getCalendar(projectId: string, startDate: string, endDate: string): Promise<CalendarDay[]> {
  const response = await apiClient.get<CalendarDay[]>(
    `/meal-subscriptions/calendar?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}`
  );
  return response.data;
}
