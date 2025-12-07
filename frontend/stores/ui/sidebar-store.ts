/**
 * @fileoverview Sidebar Store
 * UI state for sidebar navigation.
 * Part of the State Management Strategy: Zustand for UI state only.
 */

import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface SidebarState {
  /** Whether sidebar is collapsed (desktop) */
  isCollapsed: boolean
  /** Whether mobile menu is open */
  isMobileOpen: boolean
  /** Currently expanded menu group */
  expandedGroup: string | null
  /** Pinned menu items */
  pinnedItems: string[]
}

interface SidebarActions {
  /** Toggle sidebar collapsed state */
  toggleCollapsed: () => void
  /** Set collapsed state */
  setCollapsed: (collapsed: boolean) => void
  /** Toggle mobile menu */
  toggleMobile: () => void
  /** Set mobile menu state */
  setMobileOpen: (open: boolean) => void
  /** Expand a menu group */
  expandGroup: (group: string) => void
  /** Collapse all groups */
  collapseAllGroups: () => void
  /** Toggle group expansion */
  toggleGroup: (group: string) => void
  /** Pin a menu item */
  pinItem: (itemId: string) => void
  /** Unpin a menu item */
  unpinItem: (itemId: string) => void
  /** Toggle pin state */
  togglePinItem: (itemId: string) => void
}

type SidebarStore = SidebarState & SidebarActions

// ═══════════════════════════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════════════════════════

export const useSidebarStore = create<SidebarStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        isCollapsed: false,
        isMobileOpen: false,
        expandedGroup: null,
        pinnedItems: [],

        // Actions
        toggleCollapsed: () => {
          set((state) => ({ isCollapsed: !state.isCollapsed }), false, 'sidebar/toggleCollapsed')
        },

        setCollapsed: (collapsed) => {
          set({ isCollapsed: collapsed }, false, 'sidebar/setCollapsed')
        },

        toggleMobile: () => {
          set((state) => ({ isMobileOpen: !state.isMobileOpen }), false, 'sidebar/toggleMobile')
        },

        setMobileOpen: (open) => {
          set({ isMobileOpen: open }, false, 'sidebar/setMobileOpen')
        },

        expandGroup: (group) => {
          set({ expandedGroup: group }, false, 'sidebar/expandGroup')
        },

        collapseAllGroups: () => {
          set({ expandedGroup: null }, false, 'sidebar/collapseAll')
        },

        toggleGroup: (group) => {
          set(
            (state) => ({
              expandedGroup: state.expandedGroup === group ? null : group,
            }),
            false,
            'sidebar/toggleGroup'
          )
        },

        pinItem: (itemId) => {
          set(
            (state) => ({
              pinnedItems: state.pinnedItems.includes(itemId)
                ? state.pinnedItems
                : [...state.pinnedItems, itemId],
            }),
            false,
            'sidebar/pinItem'
          )
        },

        unpinItem: (itemId) => {
          set(
            (state) => ({
              pinnedItems: state.pinnedItems.filter((id) => id !== itemId),
            }),
            false,
            'sidebar/unpinItem'
          )
        },

        togglePinItem: (itemId) => {
          const { pinnedItems } = get()
          if (pinnedItems.includes(itemId)) {
            get().unpinItem(itemId)
          } else {
            get().pinItem(itemId)
          }
        },
      }),
      {
        name: 'sidebar-store',
        partialize: (state) => ({
          isCollapsed: state.isCollapsed,
          pinnedItems: state.pinnedItems,
        }),
      }
    ),
    { name: 'sidebar-store' }
  )
)

// ═══════════════════════════════════════════════════════════════════════════════
// Selectors
// ═══════════════════════════════════════════════════════════════════════════════

export const selectIsCollapsed = (state: SidebarStore) => state.isCollapsed
export const selectIsMobileOpen = (state: SidebarStore) => state.isMobileOpen
export const selectExpandedGroup = (state: SidebarStore) => state.expandedGroup
export const selectPinnedItems = (state: SidebarStore) => state.pinnedItems

