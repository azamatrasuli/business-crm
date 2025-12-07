/**
 * Factory function for creating data stores with common patterns
 * Provides consistent loading, error handling, and pagination
 */

import { create, StateCreator } from 'zustand'
import { getErrorMessage } from './error-handler'

// Common pagination state
export interface PaginationState {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
}

// Common async state
export interface AsyncState {
  isLoading: boolean
  error: string | null
}

// Common data store state
export interface DataStoreState<T> extends PaginationState, AsyncState {
  items: T[]
  selectedItem: T | null
}

// Common data store actions
export interface DataStoreActions<T, CreateDto, UpdateDto> {
  fetch: (page?: number) => Promise<void>
  fetchById: (id: string) => Promise<T>
  create: (data: CreateDto) => Promise<T>
  update: (id: string, data: UpdateDto) => Promise<T>
  remove: (id: string) => Promise<void>
  select: (item: T | null) => void
  clearError: () => void
  reset: () => void
}

// API functions type
export interface DataStoreApi<T, CreateDto, UpdateDto> {
  getList: (page: number, pageSize: number, ...args: unknown[]) => Promise<{
    items: T[]
    total: number
    page: number
    totalPages: number
  }>
  getById: (id: string) => Promise<T>
  create: (data: CreateDto) => Promise<T>
  update: (id: string, data: UpdateDto) => Promise<T>
  delete: (id: string) => Promise<void>
}

// Initial state factory
export function createInitialDataState<T>(): DataStoreState<T> {
  return {
    items: [],
    selectedItem: null,
    isLoading: false,
    error: null,
    currentPage: 1,
    totalPages: 1,
    total: 0,
    pageSize: 20,
  }
}

/**
 * Create a data store with common CRUD operations
 */
export function createDataStore<
  T extends { id: string },
  CreateDto,
  UpdateDto,
  ExtraState = object,
  ExtraActions = object
>(
  api: DataStoreApi<T, CreateDto, UpdateDto>,
  extraStateAndActions?: StateCreator<
    DataStoreState<T> & DataStoreActions<T, CreateDto, UpdateDto> & ExtraState & ExtraActions,
    [],
    [],
    ExtraState & ExtraActions
  >
) {
  type FullState = DataStoreState<T> & DataStoreActions<T, CreateDto, UpdateDto> & ExtraState & ExtraActions

  return create<FullState>((set, get, store) => {
    const baseState: DataStoreState<T> & DataStoreActions<T, CreateDto, UpdateDto> = {
      ...createInitialDataState<T>(),

      fetch: async (page = 1) => {
        set({ isLoading: true, error: null } as Partial<FullState>)
        try {
          const { pageSize } = get()
          const response = await api.getList(page, pageSize)
          set({
            items: response.items,
            total: response.total,
            currentPage: response.page,
            totalPages: response.totalPages,
            isLoading: false,
          } as Partial<FullState>)
        } catch (error) {
          set({
            error: getErrorMessage(error),
            isLoading: false,
          } as Partial<FullState>)
        }
      },

      fetchById: async (id: string) => {
        set({ isLoading: true, error: null } as Partial<FullState>)
        try {
          const item = await api.getById(id)
          set({ selectedItem: item, isLoading: false } as Partial<FullState>)
          return item
        } catch (error) {
          set({
            error: getErrorMessage(error),
            isLoading: false,
          } as Partial<FullState>)
          throw error
        }
      },

      create: async (data: CreateDto) => {
        set({ isLoading: true, error: null } as Partial<FullState>)
        try {
          const newItem = await api.create(data)
          await get().fetch(get().currentPage)
          return newItem
        } catch (error) {
          set({
            error: getErrorMessage(error),
            isLoading: false,
          } as Partial<FullState>)
          throw error
        }
      },

      update: async (id: string, data: UpdateDto) => {
        set({ isLoading: true, error: null } as Partial<FullState>)
        try {
          const updated = await api.update(id, data)
          await get().fetch(get().currentPage)

          // Update selected item if it's the same
          const { selectedItem } = get()
          if (selectedItem?.id === id) {
            set({ selectedItem: updated } as Partial<FullState>)
          }
          return updated
        } catch (error) {
          set({
            error: getErrorMessage(error),
            isLoading: false,
          } as Partial<FullState>)
          throw error
        }
      },

      remove: async (id: string) => {
        set({ isLoading: true, error: null } as Partial<FullState>)
        try {
          await api.delete(id)
          await get().fetch(get().currentPage)
        } catch (error) {
          set({
            error: getErrorMessage(error),
            isLoading: false,
          } as Partial<FullState>)
          throw error
        }
      },

      select: (item: T | null) => {
        set({ selectedItem: item } as Partial<FullState>)
      },

      clearError: () => {
        set({ error: null } as Partial<FullState>)
      },

      reset: () => {
        set(createInitialDataState<T>() as Partial<FullState>)
      },
    }

    // Merge with extra state and actions if provided
    if (extraStateAndActions) {
      const extra = extraStateAndActions(set, get, store)
      return { ...baseState, ...extra } as FullState
    }

    return baseState as FullState
  })
}

