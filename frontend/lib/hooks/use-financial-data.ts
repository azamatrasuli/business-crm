'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  transactionsApi,
  type FinancialSummary,
  type FinancialOperation,
  type StatusFilter,
  type TypeFilter,
  type SortField,
  type StatusCounts,
} from '@/lib/api/transactions'

interface UseFinancialDataReturn {
  // Summary data
  summary: FinancialSummary | null
  summaryLoading: boolean
  summaryError: string | null

  // Operations data (unified)
  operations: FinancialOperation[]
  operationsLoading: boolean
  operationsError: string | null
  operationsTotal: number
  operationsTotalPages: number

  // Status counts for tabs
  statusCounts: StatusCounts

  // Pagination & Filters
  page: number
  pageSize: number
  showAll: boolean
  statusFilter: StatusFilter
  typeFilter: TypeFilter
  searchQuery: string
  dateFrom: string | null
  dateTo: string | null
  sortField: SortField
  sortDesc: boolean

  // Computed
  hasActiveFilters: boolean

  // Actions
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setShowAll: (value: boolean) => void
  setStatusFilter: (filter: StatusFilter) => void
  setTypeFilter: (filter: TypeFilter) => void
  setSearchQuery: (query: string) => void
  setDateFrom: (date: string | null) => void
  setDateTo: (date: string | null) => void
  setSortField: (field: SortField) => void
  setSortDesc: (desc: boolean) => void
  toggleSort: (field: SortField) => void
  resetFilters: () => void
  refresh: () => Promise<void>
}

export function useFinancialData(): UseFinancialDataReturn {
  // Summary state
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // Operations state
  const [operations, setOperations] = useState<FinancialOperation[]>([])
  const [operationsLoading, setOperationsLoading] = useState(true)
  const [operationsError, setOperationsError] = useState<string | null>(null)
  const [operationsTotal, setOperationsTotal] = useState(0)
  const [operationsTotalPages, setOperationsTotalPages] = useState(0)

  // Status counts (from all operations, not just current page)
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0,
    completed: 0,
    pending_deduction: 0,
    pending_income: 0,
  })

  // Pagination & Filters
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [showAll, setShowAll] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDesc, setSortDesc] = useState(true)

  // Computed: check if any filter is active
  const hasActiveFilters = typeFilter !== 'all' || searchQuery !== '' || dateFrom !== null || dateTo !== null

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true)
      setSummaryError(null)
      const data = await transactionsApi.getSummary()
      setSummary(data)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  // Fetch status counts (for tabs) - always fetches all statuses counts
  const fetchStatusCounts = useCallback(async () => {
    try {
      // Get counts for each status by fetching with pageSize=1 just to get totals
      const [allData, completedData, pendingDeductionData, pendingIncomeData] = await Promise.all([
        transactionsApi.getOperations({ page: 1, pageSize: 1, type: typeFilter === 'all' ? undefined : typeFilter }),
        transactionsApi.getOperations({ page: 1, pageSize: 1, status: 'completed', type: typeFilter === 'all' ? undefined : typeFilter }),
        transactionsApi.getOperations({ page: 1, pageSize: 1, status: 'pending_deduction', type: typeFilter === 'all' ? undefined : typeFilter }),
        transactionsApi.getOperations({ page: 1, pageSize: 1, status: 'pending_income', type: typeFilter === 'all' ? undefined : typeFilter }),
      ])
      setStatusCounts({
        all: allData.total,
        completed: completedData.total,
        pending_deduction: pendingDeductionData.total,
        pending_income: pendingIncomeData.total,
      })
    } catch {
      // Silent fail for counts
    }
  }, [typeFilter])

  // Fetch operations
  const fetchOperations = useCallback(async () => {
    try {
      setOperationsLoading(true)
      setOperationsError(null)
      // If showAll is true, fetch all records
      const effectivePage = showAll ? 1 : page
      const effectivePageSize = showAll ? 10000 : pageSize
      const data = await transactionsApi.getOperations({
        page: effectivePage,
        pageSize: effectivePageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        sort: sortField,
        desc: sortDesc,
      })
      setOperations(data.items)
      setOperationsTotal(data.total)
      setOperationsTotalPages(data.totalPages)
    } catch (err) {
      setOperationsError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setOperationsLoading(false)
    }
  }, [page, pageSize, showAll, statusFilter, typeFilter, sortField, sortDesc])

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([fetchSummary(), fetchOperations()])
  }, [fetchSummary, fetchOperations])

  // Toggle sort direction or change field
  const toggleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortDesc(!sortDesc)
    } else {
      setSortField(field)
      setSortDesc(true)
    }
  }, [sortField, sortDesc])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setStatusFilter('all')
    setTypeFilter('all')
    setSearchQuery('')
    setDateFrom(null)
    setDateTo(null)
    setPage(1)
    setShowAll(false)
  }, [])

  // Initial load (only once on mount)
  useEffect(() => {
    fetchSummary()
    fetchStatusCounts()
  }, [fetchSummary, fetchStatusCounts])

  // Load operations when filters change
  useEffect(() => {
    fetchOperations()
  }, [fetchOperations])

  // Refresh status counts when typeFilter changes
  useEffect(() => {
    fetchStatusCounts()
  }, [fetchStatusCounts])

  // Reset page and showAll when filters change
  useEffect(() => {
    setPage(1)
    setShowAll(false)
  }, [statusFilter, typeFilter])

  return {
    summary,
    summaryLoading,
    summaryError,
    operations,
    operationsLoading,
    operationsError,
    operationsTotal,
    operationsTotalPages,
    statusCounts,
    page,
    pageSize,
    showAll,
    statusFilter,
    typeFilter,
    searchQuery,
    dateFrom,
    dateTo,
    sortField,
    sortDesc,
    hasActiveFilters,
    setPage,
    setPageSize,
    setShowAll,
    setStatusFilter,
    setTypeFilter,
    setSearchQuery,
    setDateFrom,
    setDateTo,
    setSortField,
    setSortDesc,
    toggleSort,
    resetFilters,
    refresh,
  }
}
