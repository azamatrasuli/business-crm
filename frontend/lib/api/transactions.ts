import apiClient from './client'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface FinancialSummary {
  // Баланс
  balance: number
  currencyCode: string
  
  // Поступления
  pendingIncome: number
  pendingInvoicesCount: number
  
  // Списания
  pendingDeduction: number
  pendingOrdersCount: number
  
  // Итого
  available: number
  projectedBalance: number
  overdraftLimit: number
  
  // Статус
  isLowBalance: boolean
  warningMessage: string | null
  date: string
}

// Status of operation
export type OperationStatus = 'COMPLETED' | 'PENDING_DEDUCTION' | 'PENDING_INCOME'

// Operation type
export type OperationType = 
  | 'DEPOSIT'
  | 'LUNCH_DEDUCTION'
  | 'GUEST_ORDER'
  | 'CLIENT_APP_ORDER'
  | 'REFUND'

// Unified financial operation
export interface FinancialOperation {
  id: string
  type: OperationType
  status: OperationStatus
  amount: number
  currencyCode: string
  description: string
  details: string | null
  createdAt: string
  executionDate: string | null
  isIncome: boolean
  itemsCount: number
}

export interface FinancialOperationsResponse {
  items: FinancialOperation[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Filter options
export type StatusFilter = 'all' | 'completed' | 'pending_deduction' | 'pending_income'
export type TypeFilter = 'all' | 'deposits' | 'deductions' | 'refunds'
export type SortField = 'date' | 'amount' | 'type' | 'status'

// Legacy types (for backward compatibility)
export type TransactionType = OperationType

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  description: string | null
  invoiceId: string | null
  dailyOrderId: string | null
  createdAt: string
}

export interface TransactionsResponse {
  items: Transaction[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ═══════════════════════════════════════════════════════════════
// PENDING OPERATIONS
// ═══════════════════════════════════════════════════════════════

export interface PendingOrderItem {
  id: string
  name: string
  comboType: string
  amount: number
  currencyCode: string
  orderDate: string
  settlementDate: string
  isGuestOrder: boolean
}

export interface PendingInvoiceItem {
  id: string
  externalId: string | null
  amount: number
  currencyCode: string
  status: string
  dueDate: string | null
  createdAt: string
}

export interface PendingOperationsResponse {
  pendingOrders: PendingOrderItem[]
  pendingInvoices: PendingInvoiceItem[]
}

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export const transactionsApi = {
  /**
   * Получить финансовую сводку
   */
  async getSummary(): Promise<FinancialSummary> {
    const response = await apiClient.get<FinancialSummary>('/transactions/summary')
    return response.data
  },

  /**
   * Получить unified операции с пагинацией и фильтрами
   */
  async getOperations(params?: {
    page?: number
    pageSize?: number
    status?: StatusFilter
    type?: TypeFilter
    sort?: SortField
    desc?: boolean
  }): Promise<FinancialOperationsResponse> {
    const response = await apiClient.get<FinancialOperationsResponse>('/transactions/operations', { params })
    return response.data
  },

  /**
   * [Legacy] Получить список транзакций с пагинацией и фильтрами
   */
  async getAll(params?: {
    page?: number
    pageSize?: number
    type?: TransactionType
    startDate?: string
    endDate?: string
  }): Promise<TransactionsResponse> {
    const response = await apiClient.get<TransactionsResponse>('/transactions', { params })
    return response.data
  },

  /**
   * Получить транзакцию по ID
   */
  async getById(id: string): Promise<Transaction> {
    const response = await apiClient.get<Transaction>(`/transactions/${id}`)
    return response.data
  },

  /**
   * Получить текущий баланс
   */
  async getBalance(): Promise<number> {
    const response = await apiClient.get<{ balance: number }>('/transactions/balance')
    return response.data.balance
  },

  /**
   * Получить ожидающие операции (заказы и счета)
   */
  async getPending(): Promise<PendingOperationsResponse> {
    const response = await apiClient.get<PendingOperationsResponse>('/transactions/pending')
    return response.data
  },
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  DEPOSIT: 'Пополнение',
  LUNCH_DEDUCTION: 'Обеды',
  GUEST_ORDER: 'Гостевой заказ',
  CLIENT_APP_ORDER: 'Заказ из приложения',
  REFUND: 'Возврат',
}

export const OPERATION_STATUS_LABELS: Record<OperationStatus, string> = {
  COMPLETED: 'Выполнено',
  PENDING_DEDUCTION: 'К списанию',
  PENDING_INCOME: 'К поступлению',
}

export const getOperationTypeLabel = (type: OperationType): string => {
  return OPERATION_TYPE_LABELS[type] || type
}

export const getOperationStatusLabel = (status: OperationStatus): string => {
  return OPERATION_STATUS_LABELS[status] || status
}

export const isPositiveOperation = (operation: FinancialOperation): boolean => {
  return operation.isIncome
}

// Legacy helper
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = OPERATION_TYPE_LABELS

export const getTransactionTypeLabel = (type: TransactionType): string => {
  return TRANSACTION_TYPE_LABELS[type] || type
}

export const getTransactionTypeColor = (type: TransactionType): string => {
  switch (type) {
    case 'DEPOSIT':
      return 'text-green-600'
    case 'REFUND':
      return 'text-green-600'
    case 'LUNCH_DEDUCTION':
    case 'GUEST_ORDER':
    case 'CLIENT_APP_ORDER':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

export const isPositiveTransaction = (type: TransactionType): boolean => {
  return type === 'DEPOSIT' || type === 'REFUND'
}
