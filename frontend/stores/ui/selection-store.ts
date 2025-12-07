/**
 * @fileoverview Selection Store
 * UI state for table/list selections.
 * Part of the State Management Strategy: Zustand for UI state only.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface SelectionState {
  /** Selected item IDs by context (e.g., 'employees', 'orders') */
  selections: Record<string, Set<string>>
  /** Last selected item ID by context (for shift+click range selection) */
  lastSelected: Record<string, string | null>
}

interface SelectionActions {
  /** Select a single item */
  select: (context: string, id: string) => void
  /** Deselect a single item */
  deselect: (context: string, id: string) => void
  /** Toggle selection */
  toggle: (context: string, id: string) => void
  /** Select multiple items */
  selectMany: (context: string, ids: string[]) => void
  /** Deselect multiple items */
  deselectMany: (context: string, ids: string[]) => void
  /** Select all (from provided list) */
  selectAll: (context: string, ids: string[]) => void
  /** Clear all selections for a context */
  clearSelection: (context: string) => void
  /** Clear all selections */
  clearAllSelections: () => void
  /** Check if item is selected */
  isSelected: (context: string, id: string) => boolean
  /** Get selected IDs for a context */
  getSelectedIds: (context: string) => string[]
  /** Get selection count */
  getSelectionCount: (context: string) => number
  /** Range select (for shift+click) */
  selectRange: (context: string, allIds: string[], targetId: string) => void
}

type SelectionStore = SelectionState & SelectionActions

// ═══════════════════════════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════════════════════════

export const useSelectionStore = create<SelectionStore>()(
  devtools(
    (set, get) => ({
      // State
      selections: {},
      lastSelected: {},

      // Actions
      select: (context, id) => {
        set(
          (state) => {
            const current = state.selections[context] || new Set()
            const updated = new Set(current)
            updated.add(id)
            return {
              selections: { ...state.selections, [context]: updated },
              lastSelected: { ...state.lastSelected, [context]: id },
            }
          },
          false,
          'selection/select'
        )
      },

      deselect: (context, id) => {
        set(
          (state) => {
            const current = state.selections[context] || new Set()
            const updated = new Set(current)
            updated.delete(id)
            return {
              selections: { ...state.selections, [context]: updated },
            }
          },
          false,
          'selection/deselect'
        )
      },

      toggle: (context, id) => {
        const { isSelected, select, deselect } = get()
        if (isSelected(context, id)) {
          deselect(context, id)
        } else {
          select(context, id)
        }
      },

      selectMany: (context, ids) => {
        set(
          (state) => {
            const current = state.selections[context] || new Set()
            const updated = new Set(current)
            ids.forEach((id) => updated.add(id))
            return {
              selections: { ...state.selections, [context]: updated },
              lastSelected: { ...state.lastSelected, [context]: ids[ids.length - 1] || null },
            }
          },
          false,
          'selection/selectMany'
        )
      },

      deselectMany: (context, ids) => {
        set(
          (state) => {
            const current = state.selections[context] || new Set()
            const updated = new Set(current)
            ids.forEach((id) => updated.delete(id))
            return {
              selections: { ...state.selections, [context]: updated },
            }
          },
          false,
          'selection/deselectMany'
        )
      },

      selectAll: (context, ids) => {
        set(
          (state) => ({
            selections: { ...state.selections, [context]: new Set(ids) },
          }),
          false,
          'selection/selectAll'
        )
      },

      clearSelection: (context) => {
        set(
          (state) => ({
            selections: { ...state.selections, [context]: new Set() },
            lastSelected: { ...state.lastSelected, [context]: null },
          }),
          false,
          'selection/clear'
        )
      },

      clearAllSelections: () => {
        set({ selections: {}, lastSelected: {} }, false, 'selection/clearAll')
      },

      isSelected: (context, id) => {
        const { selections } = get()
        return selections[context]?.has(id) || false
      },

      getSelectedIds: (context) => {
        const { selections } = get()
        return Array.from(selections[context] || [])
      },

      getSelectionCount: (context) => {
        const { selections } = get()
        return selections[context]?.size || 0
      },

      selectRange: (context, allIds, targetId) => {
        const { lastSelected, selections } = get()
        const lastId = lastSelected[context]

        if (!lastId) {
          get().select(context, targetId)
          return
        }

        const startIndex = allIds.indexOf(lastId)
        const endIndex = allIds.indexOf(targetId)

        if (startIndex === -1 || endIndex === -1) {
          get().select(context, targetId)
          return
        }

        const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
        const rangeIds = allIds.slice(from, to + 1)

        set(
          (state) => {
            const current = state.selections[context] || new Set()
            const updated = new Set(current)
            rangeIds.forEach((id) => updated.add(id))
            return {
              selections: { ...state.selections, [context]: updated },
              lastSelected: { ...state.lastSelected, [context]: targetId },
            }
          },
          false,
          'selection/selectRange'
        )
      },
    }),
    { name: 'selection-store' }
  )
)

// ═══════════════════════════════════════════════════════════════════════════════
// Hooks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook for managing selections in a specific context.
 *
 * @example
 * const { selectedIds, toggle, selectAll, clear, isSelected, count } = useSelection('orders')
 *
 * <Checkbox
 *   checked={isSelected(order.id)}
 *   onCheckedChange={() => toggle(order.id)}
 * />
 */
export function useSelection(context: string) {
  const store = useSelectionStore()

  return {
    selectedIds: store.getSelectedIds(context),
    count: store.getSelectionCount(context),
    isSelected: (id: string) => store.isSelected(context, id),
    select: (id: string) => store.select(context, id),
    deselect: (id: string) => store.deselect(context, id),
    toggle: (id: string) => store.toggle(context, id),
    selectMany: (ids: string[]) => store.selectMany(context, ids),
    selectAll: (ids: string[]) => store.selectAll(context, ids),
    selectRange: (allIds: string[], targetId: string) => store.selectRange(context, allIds, targetId),
    clear: () => store.clearSelection(context),
  }
}

