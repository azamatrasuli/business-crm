'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  transactionsApi,
  type FinancialSummary,
  type FinancialOperation,
  type StatusFilter,
  type TypeFilter,
  type SortField,
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

  // Pagination & Filters
  page: number
  pageSize: number
  statusFilter: StatusFilter
  typeFilter: TypeFilter
  sortField: SortField
  sortDesc: boolean

  // Actions
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setStatusFilter: (filter: StatusFilter) => void
  setTypeFilter: (filter: TypeFilter) => void
  setSortField: (field: SortField) => void
  setSortDesc: (desc: boolean) => void
  toggleSort: (field: SortField) => void
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

  // Pagination & Filters
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDesc, setSortDesc] = useState(true)

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

  // Fetch operations
  const fetchOperations = useCallback(async () => {
    try {
      setOperationsLoading(true)
      setOperationsError(null)
      const data = await transactionsApi.getOperations({
        page,
        pageSize,
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
  }, [page, pageSize, statusFilter, typeFilter, sortField, sortDesc])

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

  // Initial load (only once on mount)
  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Load operations when filters change
  useEffect(() => {
    fetchOperations()
  }, [fetchOperations])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
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
    page,
    pageSize,
    statusFilter,
    typeFilter,
    sortField,
    sortDesc,
    setPage,
    setPageSize,
    setStatusFilter,
    setTypeFilter,
    setSortField,
    setSortDesc,
    toggleSort,
    refresh,
  }
}
