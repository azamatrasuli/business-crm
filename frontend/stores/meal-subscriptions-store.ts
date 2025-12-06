import { create } from 'zustand';
import apiClient from '@/lib/api/client';

export interface Subscription {
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
}

export interface MealAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  comboType: string;
  price: number;
  status: string;
  addressId?: string;
  addressName?: string;
  frozenAt?: string;
  frozenReason?: string;
  replacementDate?: string;
}

export interface CalendarDay {
  date: string;
  totalOrders: number;
  activeOrders: number;
  frozenOrders: number;
  deliveredOrders: number;
  isWeekend: boolean;
  isPast: boolean;
}

export interface FreezeInfo {
  employeeId: string;
  remainingFreezes: number;
  usedThisWeek: number;
  maxPerWeek: number;
}

export interface MealStats {
  todayActiveAssignments: number;
  activeSubscriptions: number;
  totalAssignments: number;
}

interface MealSubscriptionsState {
  subscriptions: Subscription[];
  calendarData: CalendarDay[];
  dayAssignments: MealAssignment[];
  freezeInfo: FreezeInfo | null;
  mealStats: MealStats | null;
  isLoading: boolean;
  isLoadingCalendar: boolean;
  isLoadingDay: boolean;
  isLoadingFreeze: boolean;
  error: string | null;
  
  fetchSubscriptions: (projectId: string) => Promise<void>;
  createSubscription: (data: CreateSubscriptionData) => Promise<void>;
  cancelSubscription: (subscriptionId: string) => Promise<void>;
  pauseSubscription: (subscriptionId: string) => Promise<void>;
  resumeSubscription: (subscriptionId: string) => Promise<void>;
  
  fetchCalendar: (projectId: string, startDate: string, endDate: string) => Promise<void>;
  fetchDayAssignments: (projectId: string, date: string) => Promise<void>;
  
  updateAssignment: (assignmentId: string, comboType?: string, addressId?: string) => Promise<void>;
  cancelAssignment: (assignmentId: string) => Promise<void>;
  freezeAssignment: (assignmentId: string, reason?: string) => Promise<void>;
  unfreezeAssignment: (assignmentId: string) => Promise<void>;
  
  getFreezeInfo: (employeeId: string) => Promise<void>;
  fetchMealStats: (projectId: string) => Promise<void>;
}

export interface CreateSubscriptionData {
  projectId: string;
  startDate: string;
  endDate: string;
  autoRenewal?: boolean;
  employees: Array<{
    employeeId: string;
    comboType: string;
    deliveryAddressId?: string;
    pattern: 'EVERY_DAY' | 'EVERY_OTHER_DAY' | 'CUSTOM';
    customDates?: string[];
  }>;
}

export const useMealSubscriptionsStore = create<MealSubscriptionsState>((set, get) => ({
  subscriptions: [],
  calendarData: [],
  dayAssignments: [],
  freezeInfo: null,
  mealStats: null,
  isLoading: false,
  isLoadingCalendar: false,
  isLoadingDay: false,
  isLoadingFreeze: false,
  error: null,

  fetchSubscriptions: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get<Subscription[]>(`/meal-subscriptions/projects/${projectId}`);
      set({ subscriptions: response.data, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Ошибка загрузки подписок',
        isLoading: false 
      });
    }
  },

  createSubscription: async (data: CreateSubscriptionData) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post('/meal-subscriptions', data);
      await get().fetchSubscriptions(data.projectId);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Ошибка создания подписки',
        isLoading: false 
      });
      throw error;
    }
  },

  cancelSubscription: async (subscriptionId: string) => {
    try {
      await apiClient.post(`/meal-subscriptions/${subscriptionId}/cancel`);
    } catch (error) {
      throw error;
    }
  },

  pauseSubscription: async (subscriptionId: string) => {
    try {
      await apiClient.post(`/meal-subscriptions/${subscriptionId}/pause`);
    } catch (error) {
      throw error;
    }
  },

  resumeSubscription: async (subscriptionId: string) => {
    try {
      await apiClient.post(`/meal-subscriptions/${subscriptionId}/resume`);
    } catch (error) {
      throw error;
    }
  },

  fetchCalendar: async (projectId: string, startDate: string, endDate: string) => {
    set({ isLoadingCalendar: true });
    try {
      const response = await apiClient.get<CalendarDay[]>(
        `/meal-subscriptions/projects/${projectId}/calendar`,
        { params: { startDate, endDate } }
      );
      set({ calendarData: response.data, isLoadingCalendar: false });
    } catch (error) {
      set({ isLoadingCalendar: false });
    }
  },

  fetchDayAssignments: async (projectId: string, date: string) => {
    set({ isLoadingDay: true });
    try {
      // Get assignments for specific date using calendar data and then individual queries
      const response = await apiClient.get<MealAssignment[]>(
        `/meal-subscriptions/projects/${projectId}/assignments`,
        { params: { fromDate: date, toDate: date } }
      );
      set({ dayAssignments: response.data, isLoadingDay: false });
    } catch (error) {
      set({ dayAssignments: [], isLoadingDay: false });
    }
  },

  updateAssignment: async (assignmentId: string, comboType?: string, addressId?: string) => {
    try {
      await apiClient.put(`/meal-subscriptions/assignments/${assignmentId}`, {
        comboType,
        deliveryAddressId: addressId
      });
    } catch (error) {
      throw error;
    }
  },

  cancelAssignment: async (assignmentId: string) => {
    try {
      await apiClient.post(`/meal-subscriptions/assignments/${assignmentId}/cancel`);
    } catch (error) {
      throw error;
    }
  },

  freezeAssignment: async (assignmentId: string, reason?: string) => {
    try {
      await apiClient.post(`/meal-subscriptions/assignments/${assignmentId}/freeze`, { reason });
    } catch (error) {
      throw error;
    }
  },

  unfreezeAssignment: async (assignmentId: string) => {
    try {
      await apiClient.post(`/meal-subscriptions/assignments/${assignmentId}/unfreeze`);
    } catch (error) {
      throw error;
    }
  },

  getFreezeInfo: async (employeeId: string) => {
    set({ isLoadingFreeze: true });
    try {
      const response = await apiClient.get<FreezeInfo>(
        `/meal-subscriptions/employees/${employeeId}/freeze-info`
      );
      set({ freezeInfo: response.data, isLoadingFreeze: false });
    } catch (error) {
      set({ freezeInfo: null, isLoadingFreeze: false });
    }
  },

  fetchMealStats: async (projectId: string) => {
    try {
      const response = await apiClient.get<MealStats>(
        `/meal-subscriptions/projects/${projectId}/stats`
      );
      set({ mealStats: response.data });
    } catch (error) {
      // Silent fail
    }
  },
}));











